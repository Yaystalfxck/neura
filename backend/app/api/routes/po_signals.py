# Pocket Option Signals API
# API для генерации сигналов на основе стратегий из Pocket Option Trading Bot
# https://github.com/VitalySvyatyuk/pocket_option_trading_bot

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional, List
from datetime import datetime, timedelta
import json

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.po_models import (
    POSignal, POMartingaleState, POTrade, POAsset,
    SignalDirection, SignalStrength, SignalStatus, SignalResult, StrategyType
)
from app.po_strategies import get_strategy, MartingaleStrategy, IndicatorStrategy, MLStrategy
from app.po_websocket_service import get_pocket_option_websocket, create_pocket_option_websocket
from app.tradingview_collector import TradingViewCollector
from app.po_backtester import PocketOptionBacktester, run_quick_backtest

router = APIRouter(prefix="/api/po", tags=["Pocket Option Signals"])


# === Глобальные переменные для хранения состояния ===
_active_ws_connections: dict = {}  # user_id -> WebSocket connection


@router.post("/signal/generate", response_model=dict)
async def generate_po_signal(
    strategy: str = "indicators",
    asset: str = "EUR/USD",
    timeframe: int = 60,
    amount: float = 1.0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Генерация торгового сигнала с использованием стратегий Pocket Option
    
    Стратегии:
    - **martingale**: Стратегия Мартингейла с прогрессией ставок
    - **indicators**: Комбинация технических индикаторов (RSI, MACD, CCI, AO)
    - **ml**: Machine Learning на основе Random Forest
    
    Параметры:
    - **strategy**: Тип стратегии
    - **asset**: Валютная пара (EUR/USD, GBP/USD, и т.д.)
    - **timeframe**: Время экспирации в секундах (60, 300, 900)
    - **amount**: Сумма сделки
    """
    try:
        print(f"\n🎯 ========== ЗАПРОС PO СИГНАЛА ==========")
        print(f"Пользователь: {current_user.email} (ID: {current_user.id})")
        print(f"Стратегия: {strategy}")
        print(f"Актив: {asset}")
        print(f"Таймфрейм: {timeframe}s")
        print(f"Сумма: ${amount}")

        # 1. Получаем рыночные данные
        collector = TradingViewCollector()
        market = "otc" if "OTC" in asset.upper() else "market"
        
        market_data = await collector.get_current_data(market, str(timeframe // 60))
        
        # Ищем нужный актив
        target_pair = None
        for pair in market_data:
            if asset.upper() in pair.name.upper():
                target_pair = pair
                break
        
        if not target_pair:
            # Используем первый доступный актив
            target_pair = market_data[0] if market_data else None
            
        if not target_pair or not target_pair.candles:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Не удалось получить данные для {asset}"
            )

        prices = [c.close for c in target_pair.candles]
        print(f"✅ Получено {len(prices)} цен для анализа")

        # 2. Генерируем сигнал с помощью стратегии
        po_strategy = get_strategy(strategy, base_amount=amount)
        signal_data = po_strategy.generate_signal(prices)

        if not signal_data:
            # Возвращаем нейтральный сигнал если не удалось сгенерировать
            return {
                "success": True,
                "signal": None,
                "message": "Нет сигналов для текущих рыночных условий",
                "market_data": {
                    "asset": asset,
                    "current_price": target_pair.current_price,
                    "rsi": target_pair.indicators.rsi if target_pair.indicators else 50,
                    "trend": target_pair.indicators.trend if target_pair.indicators else "neutral"
                }
            }

        # 3. Определяем направление и силу сигнала
        signal_type = SignalDirection(signal_data["signal_type"])
        strength = SignalStrength(signal_data.get("strength", "medium"))
        confidence = signal_data.get("confidence", 50.0)

        # 4. Сохраняем сигнал в БД
        po_signal = POSignal(
            signal_type=signal_type,
            strength=strength,
            confidence=confidence,
            asset_id=1,  # TODO: Получить из POAsset
            asset_name=asset,
            amount=amount,
            timeframe=timeframe,
            current_price=target_pair.current_price,
            entry_price=target_pair.current_price,
            rsi=signal_data.get("indicators", {}).get("rsi"),
            macd_line=signal_data.get("indicators", {}).get("macd_line"),
            macd_signal=signal_data.get("indicators", {}).get("macd_signal"),
            macd_histogram=signal_data.get("indicators", {}).get("macd_histogram"),
            cci=signal_data.get("indicators", {}).get("cci"),
            ao=signal_data.get("indicators", {}).get("ao"),
            strategy_type=StrategyType(strategy.upper()),
            strategy_data=signal_data,
            status=SignalStatus.PENDING,
            user_id=current_user.id,
            expires_at=datetime.utcnow() + timedelta(seconds=timeframe * 2),
            notes=f"Signal generated using {strategy} strategy"
        )
        
        db.add(po_signal)
        await db.commit()
        await db.refresh(po_signal)

        # 5. Форматируем ответ
        direction = "BUY (CALL)" if signal_type == SignalDirection.CALL else "SELL (PUT)"
        
        response = {
            "success": True,
            "signal": {
                "id": po_signal.id,
                "asset": asset,
                "direction": direction,
                "signal_type": signal_type.value,
                "strength": strength.value,
                "confidence": f"{confidence:.1f}%",
                "amount": f"${amount}",
                "expiry": f"{timeframe // 60} мин" if timeframe >= 60 else f"{timeframe} сек",
                "entry_price": f"{target_pair.current_price:.5f}",
                "strategy": strategy,
                "indicators": signal_data.get("indicators", {}),
                "signals": signal_data.get("signals", []),
                "generated_at": po_signal.created_at.isoformat(),
                "expires_at": po_signal.expires_at.isoformat() if po_signal.expires_at else None
            },
            "market_data": {
                "asset": asset,
                "current_price": f"{target_pair.current_price:.5f}",
                "rsi": target_pair.indicators.rsi if target_pair.indicators else 50,
                "trend": target_pair.indicators.trend if target_pair.indicators else "neutral",
                "macd": target_pair.indicators.macd_signal_direction if target_pair.indicators else "neutral"
            },
            "balance": current_user.balance
        }

        print(f"\n✅ СИГНАЛ СОЗДАН:")
        print(f"   ID: {po_signal.id}")
        print(f"   Направление: {direction}")
        print(f"   Уверенность: {confidence:.1f}%")
        print(f"   Стратегия: {strategy}")

        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка генерации PO сигнала: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации сигнала: {str(e)}"
        )


@router.post("/signal/{signal_id}/activate", response_model=dict)
async def activate_signal(
    signal_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Активация сигнала (начало торговли)
    """
    try:
        # Получаем сигнал
        result = await db.execute(
            select(POSignal).where(
                POSignal.id == signal_id,
                POSignal.user_id == current_user.id
            )
        )
        signal = result.scalar_one_or_none()

        if not signal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Сигнал не найден"
            )

        if signal.status != SignalStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Сигнал уже в статусе {signal.status.value}"
            )

        # Активируем сигнал
        signal.status = SignalStatus.ACTIVE
        signal.activated_at = datetime.utcnow()
        
        await db.commit()

        # TODO: Разместить ордер в Pocket Option через WebSocket
        # ws = get_pocket_option_websocket()
        # await ws.place_order(
        #     asset_id=signal.asset_id,
        #     amount=signal.amount,
        #     direction=signal.signal_type.value,
        #     timeframe=signal.timeframe
        # )

        return {
            "success": True,
            "message": f"Сигнал #{signal_id} активирован",
            "signal": {
                "id": signal.id,
                "status": signal.status.value,
                "activated_at": signal.activated_at.isoformat()
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка активации сигнала: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка активации: {str(e)}"
        )


@router.post("/signal/{signal_id}/result", response_model=dict)
async def update_signal_result(
    signal_id: int,
    result: str,
    profit_loss: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Обновление результата сигнала (win/loss)
    """
    try:
        # Получаем сигнал
        result_query = await db.execute(
            select(POSignal).where(
                POSignal.id == signal_id,
                POSignal.user_id == current_user.id
            )
        )
        signal = result_query.scalar_one_or_none()

        if not signal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Сигнал не найден"
            )

        # Обновляем результат
        signal.result = SignalResult(result)
        signal.status = SignalStatus.COMPLETED
        signal.completed_at = datetime.utcnow()
        
        if profit_loss is not None:
            signal.profit_loss = profit_loss
            
            # Обновляем баланс пользователя при выигрыше
            if result == "win" and profit_loss > 0:
                current_user.balance += profit_loss

        # Обновляем статистику Мартингейла
        if signal.strategy_type == StrategyType.MARTINGALE:
            martingale_result = await db.execute(
                select(POMartingaleState).where(
                    POMartingaleState.user_id == current_user.id
                )
            )
            ms = martingale_result.scalar_one_or_none()
            
            if ms:
                if result == "win":
                    ms.record_win()
                    ms.total_profit += profit_loss if profit_loss else 0
                elif result == "loss":
                    ms.record_loss()

        await db.commit()

        return {
            "success": True,
            "message": f"Результат сигнала #{signal_id} обновлен: {result}",
            "signal": {
                "id": signal.id,
                "result": signal.result.value,
                "profit_loss": signal.profit_loss,
                "completed_at": signal.completed_at.isoformat()
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка обновления результата: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обновления: {str(e)}"
        )


@router.get("/signals", response_model=dict)
async def get_signals(
    status_filter: Optional[str] = None,
    strategy: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение списка сигналов пользователя
    """
    try:
        query = select(POSignal).where(POSignal.user_id == current_user.id)

        if status_filter:
            try:
                status_enum = SignalStatus(status_filter)
                query = query.where(POSignal.status == status_enum)
            except ValueError:
                pass

        if strategy:
            try:
                strategy_enum = StrategyType(strategy.upper())
                query = query.where(POSignal.strategy_type == strategy_enum)
            except ValueError:
                pass

        query = query.order_by(desc(POSignal.created_at)).limit(limit)
        
        result = await db.execute(query)
        signals = result.scalars().all()

        signals_list = [
            {
                "id": s.id,
                "asset": s.asset_name,
                "signal_type": s.signal_type.value,
                "strength": s.strength.value,
                "confidence": f"{s.confidence:.1f}%",
                "amount": f"${s.amount}",
                "status": s.status.value,
                "result": s.result.value if s.result else None,
                "profit_loss": s.profit_loss,
                "strategy": s.strategy_type.value,
                "created_at": s.created_at.isoformat(),
                "completed_at": s.completed_at.isoformat() if s.completed_at else None
            }
            for s in signals
        ]

        # Статистика
        stats_query = await db.execute(
            select(
                func.count(POSignal.id),
                func.sum(func.case((POSignal.result == SignalResult.WIN, 1), else_=0)),
                func.sum(func.case((POSignal.result == SignalResult.LOSS, 1), else_=0)),
                func.sum(POSignal.profit_loss)
            ).where(
                POSignal.user_id == current_user.id,
                POSignal.status == SignalStatus.COMPLETED
            )
        )
        stats = stats_query.one()

        total = stats[0] or 0
        wins = stats[1] or 0
        losses = stats[2] or 0
        win_rate = (wins / total * 100) if total > 0 else 0
        total_profit = stats[3] or 0

        return {
            "success": True,
            "signals": signals_list,
            "total": len(signals_list),
            "statistics": {
                "total_signals": total,
                "wins": wins,
                "losses": losses,
                "win_rate": f"{win_rate:.1f}%",
                "total_profit": f"${total_profit:.2f}"
            }
        }

    except Exception as e:
        print(f"❌ Ошибка получения сигналов: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения сигналов: {str(e)}"
        )


@router.get("/signal/{signal_id}", response_model=dict)
async def get_signal_details(
    signal_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение детальной информации о сигнале
    """
    try:
        result = await db.execute(
            select(POSignal).where(
                POSignal.id == signal_id,
                POSignal.user_id == current_user.id
            )
        )
        signal = result.scalar_one_or_none()

        if not signal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Сигнал не найден"
            )

        return {
            "success": True,
            "signal": {
                "id": signal.id,
                "asset": signal.asset_name,
                "signal_type": signal.signal_type.value,
                "strength": signal.strength.value,
                "confidence": f"{signal.confidence:.1f}%",
                "amount": f"${signal.amount}",
                "timeframe": f"{signal.timeframe // 60} мин" if signal.timeframe >= 60 else f"{signal.timeframe} сек",
                "entry_price": f"{signal.entry_price:.5f}" if signal.entry_price else None,
                "current_price": f"{signal.current_price:.5f}" if signal.current_price else None,
                "status": signal.status.value,
                "result": signal.result.value if signal.result else None,
                "profit_loss": signal.profit_loss,
                "strategy": signal.strategy_type.value,
                "indicators": {
                    "rsi": signal.rsi,
                    "macd": signal.macd_line,
                    "cci": signal.cci,
                    "ao": signal.ao
                },
                "created_at": signal.created_at.isoformat(),
                "activated_at": signal.activated_at.isoformat() if signal.activated_at else None,
                "completed_at": signal.completed_at.isoformat() if signal.completed_at else None,
                "notes": signal.notes
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка получения сигнала: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения сигнала: {str(e)}"
        )


@router.get("/strategies", response_model=dict)
async def get_strategies():
    """
    Получение списка доступных стратегий
    """
    return {
        "success": True,
        "strategies": [
            {
                "name": "martingale",
                "display_name": "Мартингейл",
                "description": "Стратегия с удвоением ставки после проигрыша",
                "risk": "high",
                "min_confidence": 70,
                "features": ["Прогрессия ставок", "Автоматический сброс", "Защита от банкролла"]
            },
            {
                "name": "indicators",
                "display_name": "Технические индикаторы",
                "description": "Комбинация RSI, MACD, CCI и Awesome Oscillator",
                "risk": "medium",
                "min_confidence": 60,
                "features": ["RSI", "MACD", "CCI", "Awesome Oscillator", "Комплексный анализ"]
            },
            {
                "name": "ml",
                "display_name": "Machine Learning",
                "description": "Предсказание на основе Random Forest Classifier",
                "risk": "medium",
                "min_confidence": 65,
                "features": ["ML модель", "Обучение на истории", "Адаптивность"]
            }
        ]
    }


@router.post("/martingale/start", response_model=dict)
async def start_martingale(
    base_amount: float = 1.0,
    multiplier: float = 2.0,
    max_steps: int = 5,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Запуск стратегии Мартингейла для пользователя
    """
    try:
        # Проверяем существующее состояние
        result = await db.execute(
            select(POMartingaleState).where(
                POMartingaleState.user_id == current_user.id
            )
        )
        existing_state = result.scalar_one_or_none()

        if existing_state:
            # Обновляем существующее
            existing_state.base_amount = base_amount
            existing_state.multiplier = multiplier
            existing_state.max_steps = max_steps
            state = existing_state
        else:
            # Создаем новое
            state = POMartingaleState(
                user_id=current_user.id,
                base_amount=base_amount,
                multiplier=multiplier,
                max_steps=max_steps,
                current_step=0,
                consecutive_losses=0
            )
            db.add(state)

        await db.commit()
        await db.refresh(state)

        return {
            "success": True,
            "message": "Стратегия Мартингейла активирована",
            "state": {
                "base_amount": state.base_amount,
                "multiplier": state.multiplier,
                "max_steps": state.max_steps,
                "current_step": state.current_step,
                "next_bet": state.base_amount * (state.multiplier ** state.current_step)
            }
        }

    except Exception as e:
        print(f"❌ Ошибка запуска Мартингейла: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка запуска: {str(e)}"
        )


@router.get("/martingale/state", response_model=dict)
async def get_martingale_state(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение текущего состояния Мартингейла
    """
    try:
        result = await db.execute(
            select(POMartingaleState).where(
                POMartingaleState.user_id == current_user.id
            )
        )
        state = result.scalar_one_or_none()

        if not state:
            return {
                "success": True,
                "state": None,
                "message": "Стратегия Мартингейла не активна"
            }

        next_bet = state.base_amount * (state.multiplier ** state.current_step)

        return {
            "success": True,
            "state": {
                "base_amount": state.base_amount,
                "multiplier": state.multiplier,
                "max_steps": state.max_steps,
                "current_step": state.current_step,
                "consecutive_losses": state.consecutive_losses,
                "total_wins": state.total_wins,
                "total_losses": state.total_losses,
                "win_rate": f"{(state.total_wins / (state.total_wins + state.total_losses) * 100) if (state.total_wins + state.total_losses) > 0 else 0:.1f}%",
                "total_profit": f"${state.total_profit:.2f}",
                "next_bet": f"${next_bet:.2f}",
                "max_possible_loss": f"${sum(state.base_amount * (state.multiplier ** i) for i in range(state.max_steps)):.2f}"
            }
        }

    except Exception as e:
        print(f"❌ Ошибка получения состояния: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения: {str(e)}"
        )


@router.post("/backtest", response_model=dict)
async def run_backtest(
    strategy: str,
    asset: str = "EUR/USD",
    timeframe: int = 60,
    initial_balance: float = 1000.0,
    bars: int = 1000,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Запуск бэктестинга стратегии на исторических данных
    
    Параметры:
    - **strategy**: Тип стратегии (martingale, indicators, ml)
    - **asset**: Валютная пара
    - **timeframe**: Таймфрейм в секундах
    - **initial_balance**: Начальный баланс для теста
    - **bars**: Количество баров для теста
    """
    try:
        print(f"\n🧪 ========== БЭКТЕСТИНГ ==========")
        print(f"Пользователь: {current_user.email}")
        print(f"Стратегия: {strategy}")
        print(f"Актив: {asset}")
        print(f"Баланс: ${initial_balance}")
        print(f"Баров: {bars}")

        # Получаем исторические данные
        collector = TradingViewCollector()
        market = "otc" if "OTC" in asset.upper() else "market"
        
        market_data = await collector.get_current_data(market, str(timeframe // 60))
        
        # Используем первые доступные данные
        if not market_data:
            # Генерируем синтетические данные для теста
            import numpy as np
            np.random.seed(42)
            returns = np.random.normal(0.0001, 0.001, bars)
            prices = [1.0850]
            for r in returns:
                prices.append(prices[-1] * (1 + r))
            
            from datetime import datetime, timedelta
            base_time = datetime.utcnow() - timedelta(minutes=bars)
            timestamps = [base_time + timedelta(minutes=i) for i in range(bars)]
        else:
            pair = market_data[0]
            prices = [c.close for c in pair.candles[:bars]]
            timestamps = [datetime.utcnow() - timedelta(minutes=bars-i) for i in range(len(prices))]

        # Запускаем бэктест
        backtester = PocketOptionBacktester(initial_balance=initial_balance)
        result = backtester.run_backtest(
            strategy_type=strategy,
            prices=prices,
            timestamps=timestamps,
            asset=asset,
            timeframe=timeframe,
            amount=1.0
        )

        # Сохраняем результат в БД
        from app.po_models import POBacktestResult
        backtest_result = POBacktestResult(
            user_id=current_user.id,
            strategy_type=StrategyType(strategy.upper()),
            asset_name=asset,
            timeframe=timeframe,
            start_date=result.start_date,
            end_date=result.end_date,
            total_trades=result.total_trades,
            winning_trades=result.winning_trades,
            losing_trades=result.losing_trades,
            win_rate=result.win_rate,
            initial_balance=result.initial_balance,
            final_balance=result.final_balance,
            total_profit=result.total_profit,
            max_drawdown=result.max_drawdown,
            profit_factor=result.profit_factor,
            strategy_params=result.strategy_params
        )
        
        db.add(backtest_result)
        await db.commit()

        # Генерируем отчет
        report = backtester.generate_report(result)

        print(f"\n✅ БЭКТЕСТИНГ ЗАВЕРШЕН:")
        print(f"   Всего сделок: {result.total_trades}")
        print(f"   Win Rate: {result.win_rate:.1f}%")
        print(f"   Прибыль: ${result.total_profit:.2f}")
        print(f"   Max Drawdown: {result.max_drawdown:.1f}%")

        return {
            "success": True,
            "report": report,
            "detailed_results": {
                "total_trades": result.total_trades,
                "winning_trades": result.winning_trades,
                "losing_trades": result.losing_trades,
                "win_rate": f"{result.win_rate}%",
                "initial_balance": f"${result.initial_balance:.2f}",
                "final_balance": f"${result.final_balance:.2f}",
                "total_profit": f"${result.total_profit:.2f}",
                "max_drawdown": f"{result.max_drawdown}%",
                "profit_factor": result.profit_factor,
                "avg_win": f"${result.avg_win:.2f}",
                "avg_loss": f"${result.avg_loss:.2f}",
                "largest_win": f"${result.largest_win:.2f}",
                "largest_loss": f"${result.largest_loss:.2f}",
                "consecutive_wins": result.consecutive_wins,
                "consecutive_losses": result.consecutive_losses,
                "max_consecutive_losses": result.max_consecutive_losses,
                "equity_curve": backtester.get_equity_curve()[-100:]  # Последние 100 точек
            },
            "backtest_id": backtest_result.id
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка бэктестинга: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка бэктестинга: {str(e)}"
        )


@router.get("/backtest/history", response_model=dict)
async def get_backtest_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение истории бэктестов пользователя
    """
    try:
        from app.po_models import POBacktestResult
        from sqlalchemy import desc
        
        result = await db.execute(
            select(POBacktestResult)
            .where(POBacktestResult.user_id == current_user.id)
            .order_by(desc(POBacktestResult.created_at))
            .limit(limit)
        )
        backtests = result.scalars().all()

        return {
            "success": True,
            "backtests": [
                {
                    "id": bt.id,
                    "strategy": bt.strategy_type.value,
                    "asset": bt.asset_name,
                    "timeframe": f"{bt.timeframe // 60} мин" if bt.timeframe >= 60 else f"{bt.timeframe} сек",
                    "total_trades": bt.total_trades,
                    "win_rate": f"{bt.win_rate}%",
                    "total_profit": f"${bt.total_profit:.2f}",
                    "max_drawdown": f"{bt.max_drawdown}%",
                    "created_at": bt.created_at.isoformat()
                }
                for bt in backtests
            ],
            "total": len(backtests)
        }

    except Exception as e:
        print(f"❌ Ошибка получения истории: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения: {str(e)}"
        )
