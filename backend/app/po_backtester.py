# Pocket Option Backtesting Service
# Сервис для тестирования стратегий на исторических данных
# На основе https://github.com/VitalySvyatyuk/pocket_option_trading_bot

import numpy as np
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import logging

from app.po_strategies import get_strategy, TradingStrategy, MartingaleStrategy, IndicatorStrategy, MLStrategy
from app.po_models import SignalDirection, SignalResult, StrategyType

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class BacktestTrade:
    """Результат одной сделки в бэктесте"""
    trade_id: int
    timestamp: str
    asset: str
    direction: str  # call/put
    entry_price: float
    exit_price: float
    amount: float
    result: str  # win/loss/draw
    profit_loss: float
    confidence: float
    indicators: Dict


@dataclass
class BacktestResult:
    """Результаты бэктестинга"""
    strategy: str
    asset: str
    timeframe: int
    
    # Период теста
    start_date: str
    end_date: str
    
    # Статистика
    total_trades: int
    winning_trades: int
    losing_trades: int
    draw_trades: int
    win_rate: float
    
    # Финансовые результаты
    initial_balance: float
    final_balance: float
    total_profit: float
    max_drawdown: float
    max_profit: float
    profit_factor: float
    
    # Параметры стратегии
    strategy_params: Dict
    
    # Детали trades
    trades: List[BacktestTrade]
    
    # Метрики
    avg_win: float
    avg_loss: float
    largest_win: float
    largest_loss: float
    consecutive_wins: int
    consecutive_losses: int
    
    # Для Мартингейла
    max_consecutive_losses: int
    max_bet_size: float


class PocketOptionBacktester:
    """
    Сервис для бэктестинга стратегий на исторических данных
    """

    def __init__(self, initial_balance: float = 1000.0):
        """
        Инициализация бэктестера
        
        Args:
            initial_balance: Начальный баланс для тестирования
        """
        self.initial_balance = initial_balance
        self.balance = initial_balance
        self.trades: List[BacktestTrade] = []
        self.equity_curve: List[float] = []

    def run_backtest(
        self,
        strategy_type: str,
        prices: List[float],
        timestamps: List[datetime],
        asset: str = "EUR/USD",
        timeframe: int = 60,
        amount: float = 1.0,
        **strategy_kwargs
    ) -> BacktestResult:
        """
        Запуск бэктестинга стратегии
        
        Args:
            strategy_type: Тип стратегии ("martingale", "indicators", "ml")
            prices: Список исторических цен
            timestamps: Временные метки цен
            asset: Название актива
            timeframe: Таймфрейм в секундах
            amount: Базовая сумма сделки
            **strategy_kwargs: Дополнительные параметры стратегии
            
        Returns:
            BacktestResult: Результаты бэктестинга
        """
        logger.info(f"\n🚀 Запуск бэктестинга: {strategy_type} на {asset}")
        logger.info(f"Данных: {len(prices)} цен, период: {len(timestamps)} баров")

        # Сброс состояния
        self.balance = self.initial_balance
        self.trades = []
        self.equity_curve = [self.initial_balance]

        # Создаем стратегию
        strategy = get_strategy(strategy_type, base_amount=amount, **strategy_kwargs)
        
        # Параметры для отчета
        strategy_params = {
            "base_amount": amount,
            **strategy_kwargs
        }

        # Скользящее окно для анализа
        window_size = 50 if strategy_type != "ml" else 100
        trade_id = 0

        # Проходим по историческим данным
        for i in range(window_size, len(prices)):
            # Берем данные для анализа
            historical_prices = prices[i-window_size:i]
            current_time = timestamps[i]
            
            # Генерируем сигнал
            signal = strategy.generate_signal(historical_prices)
            
            if signal and signal.get("confidence", 0) >= strategy.min_confidence:
                trade_id += 1
                
                # Симуляция сделки
                entry_price = historical_prices[-1]
                
                # Определяем результат через N баров (экспирация)
                expiry_bars = max(1, timeframe // 60)  # Для 1 минуты = 1 бар
                exit_idx = min(i + expiry_bars, len(prices) - 1)
                exit_price = prices[exit_idx]
                
                # Рассчитываем результат
                direction = signal["signal_type"]
                result, profit_loss = self._calculate_trade_result(
                    direction, entry_price, exit_price, amount
                )
                
                # Обновляем баланс
                self.balance += profit_loss
                self.equity_curve.append(self.balance)
                
                # Обновляем состояние стратегии (для Мартингейла)
                if isinstance(strategy, MartingaleStrategy):
                    if result == "win":
                        strategy.record_win()
                    elif result == "loss":
                        strategy.record_loss()
                
                # Сохраняем trade
                trade = BacktestTrade(
                    trade_id=trade_id,
                    timestamp=current_time.isoformat(),
                    asset=asset,
                    direction=direction,
                    entry_price=entry_price,
                    exit_price=exit_price,
                    amount=amount,
                    result=result,
                    profit_loss=profit_loss,
                    confidence=signal.get("confidence", 0),
                    indicators=signal.get("indicators", {})
                )
                self.trades.append(trade)

        # Создаем результат
        return self._create_backtest_result(
            strategy_type=strategy_type,
            asset=asset,
            timeframe=timeframe,
            start_date=timestamps[0].isoformat() if timestamps else "",
            end_date=timestamps[-1].isoformat() if timestamps else "",
            strategy_params=strategy_params
        )

    def _calculate_trade_result(
        self,
        direction: str,
        entry_price: float,
        exit_price: float,
        amount: float,
        payout_percent: float = 80.0
    ) -> Tuple[str, float]:
        """
        Расчет результата сделки
        
        Args:
            direction: Направление (call/put)
            entry_price: Цена входа
            exit_price: Цена выхода
            amount: Сумма сделки
            payout_percent: Процент выплаты
            
        Returns:
            (result, profit_loss): Результат и прибыль/убыток
        """
        if direction == "call":
            is_win = exit_price > entry_price
        else:  # put
            is_win = exit_price < entry_price
        
        if is_win:
            profit = amount * (payout_percent / 100)
            return "win", profit
        else:
            return "loss", -amount

    def _create_backtest_result(
        self,
        strategy_type: str,
        asset: str,
        timeframe: int,
        start_date: str,
        end_date: str,
        strategy_params: Dict
    ) -> BacktestResult:
        """Создание объекта результатов бэктестинга"""
        
        if not self.trades:
            return BacktestResult(
                strategy=strategy_type,
                asset=asset,
                timeframe=timeframe,
                start_date=start_date,
                end_date=end_date,
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                draw_trades=0,
                win_rate=0.0,
                initial_balance=self.initial_balance,
                final_balance=self.initial_balance,
                total_profit=0.0,
                max_drawdown=0.0,
                max_profit=0.0,
                profit_factor=0.0,
                strategy_params=strategy_params,
                trades=[],
                avg_win=0.0,
                avg_loss=0.0,
                largest_win=0.0,
                largest_loss=0.0,
                consecutive_wins=0,
                consecutive_losses=0,
                max_consecutive_losses=0,
                max_bet_size=0.0
            )

        # Статистика
        total_trades = len(self.trades)
        winning_trades = sum(1 for t in self.trades if t.result == "win")
        losing_trades = sum(1 for t in self.trades if t.result == "loss")
        draw_trades = sum(1 for t in self.trades if t.result == "draw")
        
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        # Финансовые результаты
        total_profit = self.balance - self.initial_balance
        max_balance = max(self.equity_curve)
        min_balance = min(self.equity_curve)
        max_drawdown = ((max_balance - min_balance) / max_balance * 100) if max_balance > 0 else 0
        
        # Profit factor
        gross_profit = sum(t.profit_loss for t in self.trades if t.profit_loss > 0)
        gross_loss = abs(sum(t.profit_loss for t in self.trades if t.profit_loss < 0))
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else 0
        
        # Детальная статистика
        wins = [t.profit_loss for t in self.trades if t.result == "win"]
        losses = [t.profit_loss for t in self.trades if t.result == "loss"]
        
        avg_win = np.mean(wins) if wins else 0
        avg_loss = np.mean(losses) if losses else 0
        largest_win = max(wins) if wins else 0
        largest_loss = min(losses) if losses else 0
        
        # Серии
        consecutive_wins = self._max_consecutive(self.trades, "win")
        consecutive_losses = self._max_consecutive(self.trades, "loss")
        max_consecutive_losses = consecutive_losses
        
        # Макс. ставка (для Мартингейла)
        max_bet_size = max(t.amount for t in self.trades) if self.trades else 0

        return BacktestResult(
            strategy=strategy_type,
            asset=asset,
            timeframe=timeframe,
            start_date=start_date,
            end_date=end_date,
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            draw_trades=draw_trades,
            win_rate=round(win_rate, 2),
            initial_balance=self.initial_balance,
            final_balance=round(self.balance, 2),
            total_profit=round(total_profit, 2),
            max_drawdown=round(max_drawdown, 2),
            max_profit=round(max_balance - self.initial_balance, 2),
            profit_factor=round(profit_factor, 2),
            strategy_params=strategy_params,
            trades=self.trades,
            avg_win=round(avg_win, 2),
            avg_loss=round(avg_loss, 2),
            largest_win=round(largest_win, 2),
            largest_loss=round(largest_loss, 2),
            consecutive_wins=consecutive_wins,
            consecutive_losses=consecutive_losses,
            max_consecutive_losses=max_consecutive_losses,
            max_bet_size=round(max_bet_size, 2)
        )

    def _max_consecutive(self, trades: List[BacktestTrade], result: str) -> int:
        """Подсчет максимальной серии"""
        max_consecutive = 0
        current_consecutive = 0
        
        for trade in trades:
            if trade.result == result:
                current_consecutive += 1
                max_consecutive = max(max_consecutive, current_consecutive)
            else:
                current_consecutive = 0
        
        return max_consecutive

    def get_equity_curve(self) -> List[float]:
        """Получение кривой доходности"""
        return self.equity_curve

    def generate_report(self, result: BacktestResult) -> Dict:
        """
        Генерация отчета о бэктестинге
        
        Args:
            result: Результаты бэктестинга
            
        Returns:
            Dict: Отчет в формате JSON
        """
        return {
            "summary": {
                "strategy": result.strategy,
                "asset": result.asset,
                "period": f"{result.start_date} - {result.end_date}",
                "total_trades": result.total_trades,
                "win_rate": f"{result.win_rate}%",
                "profit_factor": result.profit_factor,
            },
            "financials": {
                "initial_balance": f"${result.initial_balance:.2f}",
                "final_balance": f"${result.final_balance:.2f}",
                "total_profit": f"${result.total_profit:.2f}",
                "max_drawdown": f"{result.max_drawdown}%",
                "max_profit": f"${result.max_profit:.2f}"
            },
            "performance": {
                "avg_win": f"${result.avg_win:.2f}",
                "avg_loss": f"${result.avg_loss:.2f}",
                "largest_win": f"${result.largest_win:.2f}",
                "largest_loss": f"${result.largest_loss:.2f}",
                "consecutive_wins": result.consecutive_wins,
                "consecutive_losses": result.consecutive_losses,
                "max_consecutive_losses": result.max_consecutive_losses
            },
            "strategy_params": result.strategy_params,
            "trades_count": len(result.trades),
            "recommendation": self._get_recommendation(result)
        }

    def _get_recommendation(self, result: BacktestResult) -> str:
        """Получение рекомендации по стратегии"""
        if result.win_rate >= 70 and result.profit_factor >= 1.5:
            return "✅ Отличные результаты. Рекомендуется к использованию."
        elif result.win_rate >= 60 and result.profit_factor >= 1.2:
            return "👍 Хорошие результаты. Можно использовать с осторожностью."
        elif result.win_rate >= 50:
            return "⚠️ Удовлетворительные результаты. Требуется доработка."
        else:
            return "❌ Плохие результаты. Не рекомендуется к использованию."


# Функция для быстрого запуска бэктеста
async def run_quick_backtest(
    strategy: str = "indicators",
    prices: Optional[List[float]] = None,
    initial_balance: float = 1000.0,
    **kwargs
) -> Dict:
    """
    Быстрый запуск бэктестинга
    
    Args:
        strategy: Тип стратегии
        prices: Цены для теста (если None, генерируются случайные)
        initial_balance: Начальный баланс
        
    Returns:
        Dict: Результаты теста
    """
    # Генерируем тестовые данные если не предоставлены
    if prices is None:
        np.random.seed(42)
        # Генерируем случайное блуждание
        returns = np.random.normal(0.0001, 0.001, 1000)
        prices = [1.0850]
        for r in returns:
            prices.append(prices[-1] * (1 + r))
    
    # Создаем timestamps
    base_time = datetime.utcnow() - timedelta(minutes=len(prices))
    timestamps = [base_time + timedelta(minutes=i) for i in range(len(prices))]
    
    # Запускаем бэктест
    backtester = PocketOptionBacktester(initial_balance=initial_balance)
    result = backtester.run_backtest(
        strategy_type=strategy,
        prices=prices,
        timestamps=timestamps,
        **kwargs
    )
    
    # Генерируем отчет
    report = backtester.generate_report(result)
    
    return report
