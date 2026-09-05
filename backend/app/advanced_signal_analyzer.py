"""
Продвинутый анализ сигналов с множественными стратегиями,
динамической экспирацией и оптимизацией входа
"""

from typing import Dict, List, Optional, Tuple
import numpy as np
from dataclasses import dataclass

@dataclass
class StrategyResult:
    """Результат одной стратегии"""
    strategy_name: str
    signal: Optional[str]  # 'call' или 'put'
    confidence: float  # 0-100
    entry_score: float  # 0-100 (качество входа)
    optimal_expiry: int  # в минутах
    indicators: Dict  # используемые индикаторы
    reasoning: str  # объяснение сигнала

class AdvancedSignalAnalyzer:
    """Продвинутый анализ с множеством стратегий"""
    
    def __init__(self):
        self.min_candles = 50
        self.strategies = [
            'trend_following',
            'mean_reversion',
            'momentum',
            'volatility_breakout',
            'support_resistance',
            'macd_crossover'
        ]
    
    def analyze_all_strategies(self, candles: List[Dict]) -> Dict:
        """Анализ всеми стратегиями одновременно"""
        if len(candles) < self.min_candles:
            return {'error': 'Insufficient data'}
        
        closes = np.array([float(c['close']) for c in candles], dtype=float)
        highs = np.array([float(c['high']) for c in candles], dtype=float)
        lows = np.array([float(c['low']) for c in candles], dtype=float)
        volumes = np.array([float(c.get('volume', 1)) for c in candles], dtype=float)
        
        # Расчет основных индикаторов (один раз)
        indicators = self._calculate_indicators(closes, highs, lows, volumes)
        
        # Анализ каждой стратегией
        strategy_results = []
        for strategy_name in self.strategies:
            result = self._analyze_strategy(
                strategy_name, closes, highs, lows, indicators
            )
            if result.signal:
                strategy_results.append(result)
        
        # Объединение результатов
        best_signal = self._merge_strategies(strategy_results, indicators)
        
        return {
            'signal': best_signal,
            'strategies': strategy_results,
            'all_indicators': indicators,
            'market_regime': self._determine_regime(indicators)
        }
    
    def _calculate_indicators(self, closes, highs, lows, volumes) -> Dict:
        """Расчет всех базовых индикаторов"""
        indicators = {}
        
        # RSI
        indicators['rsi'] = self._calculate_rsi(closes)
        
        # MACD
        macd_line, signal_line, histogram = self._calculate_macd(closes)
        indicators['macd'] = macd_line
        indicators['macd_signal'] = signal_line
        indicators['macd_histogram'] = histogram
        
        # Bollinger Bands
        sma20 = np.mean(closes[-20:])
        std20 = np.std(closes[-20:])
        indicators['bb_upper'] = sma20 + (2 * std20)
        indicators['bb_lower'] = sma20 - (2 * std20)
        indicators['bb_middle'] = sma20
        indicators['bb_position'] = (closes[-1] - indicators['bb_lower']) / (indicators['bb_upper'] - indicators['bb_lower'])
        
        # ATR (волатильность)
        indicators['atr'] = self._calculate_atr(highs, lows, closes)
        indicators['volatility'] = indicators['atr'] / closes[-1] * 100
        
        # EMA
        indicators['ema_9'] = self._calculate_ema(closes, 9)
        indicators['ema_21'] = self._calculate_ema(closes, 21)
        indicators['ema_50'] = self._calculate_ema(closes, 50)
        
        # Stochastic
        stoch_k, stoch_d = self._calculate_stochastic(closes, highs, lows)
        indicators['stoch_k'] = stoch_k
        indicators['stoch_d'] = stoch_d
        
        # CCI
        indicators['cci'] = self._calculate_cci(closes, highs, lows)
        
        # Momentum
        indicators['momentum'] = closes[-1] - closes[-10]
        indicators['momentum_pct'] = (indicators['momentum'] / closes[-10]) * 100
        
        # Price levels
        indicators['highest_50'] = np.max(closes[-50:])
        indicators['lowest_50'] = np.min(closes[-50:])
        indicators['current_price'] = closes[-1]
        
        return indicators
    
    def _analyze_strategy(self, strategy: str, closes, highs, lows, indicators) -> StrategyResult:
        """Анализ одной стратегией"""
        
        if strategy == 'trend_following':
            return self._trend_following(closes, indicators)
        elif strategy == 'mean_reversion':
            return self._mean_reversion(closes, indicators)
        elif strategy == 'momentum':
            return self._momentum_strategy(closes, indicators)
        elif strategy == 'volatility_breakout':
            return self._volatility_breakout(closes, highs, lows, indicators)
        elif strategy == 'support_resistance':
            return self._support_resistance(closes, indicators)
        elif strategy == 'macd_crossover':
            return self._macd_crossover(closes, indicators)
        
        return StrategyResult(strategy, None, 0, 0, 5, {}, "No signal")
    
    def _trend_following(self, closes, indicators) -> StrategyResult:
        """Стратегия следования за трендом"""
        rsi = indicators['rsi']
        ema9 = indicators['ema_9']
        ema21 = indicators['ema_21']
        ema50 = indicators['ema_50']
        current = closes[-1]
        momentum = indicators['momentum']
        atr = indicators['atr']
        
        signal = None
        confidence = 0
        entry_score = 0
        optimal_expiry = 5
        reasoning = "Нет условий для следования за трендом"
        
        # Восходящий тренд
        if current > ema9 > ema21 > ema50 and momentum > 0 and rsi < 70:
            signal = 'call'
            trend_strength = ((current - ema50) / ema50) * 100
            confidence = min(85, 50 + trend_strength * 5)
            entry_score = 70 if rsi < 50 else 50
            optimal_expiry = 5 if indicators['volatility'] > 0.5 else 8
            reasoning = f"Uptrend: EMA alignment, momentum={momentum:.6f}, RSI={rsi:.0f}"
        
        # Нисходящий тренд
        elif current < ema9 < ema21 < ema50 and momentum < 0 and rsi > 30:
            signal = 'put'
            trend_strength = ((ema50 - current) / ema50) * 100
            confidence = min(85, 50 + trend_strength * 5)
            entry_score = 70 if rsi > 50 else 50
            optimal_expiry = 5 if indicators['volatility'] > 0.5 else 8
            reasoning = f"Downtrend: EMA alignment, momentum={momentum:.6f}, RSI={rsi:.0f}"
        
        return StrategyResult('trend_following', signal, confidence, entry_score, 
                            optimal_expiry, {'trend': momentum}, reasoning)
    
    def _mean_reversion(self, closes, indicators) -> StrategyResult:
        """Стратегия возврата к среднему"""
        rsi = indicators['rsi']
        bb_position = indicators['bb_position']
        bb_upper = indicators['bb_upper']
        bb_lower = indicators['bb_lower']
        current = closes[-1]
        
        signal = None
        confidence = 0
        entry_score = 0
        optimal_expiry = 5
        reasoning = "Нет условий для возврата к среднему"
        
        # Цена у нижней границы BB + перепродан RSI
        if current < bb_lower and rsi < 30:
            signal = 'call'
            confidence = min(85, 50 + (30 - rsi) * 2)
            entry_score = 80 if rsi < 20 else 65
            optimal_expiry = 3  # Быстрый отскок
            reasoning = f"Oversold: RSI={rsi:.0f}, BB_lower={bb_lower:.6f}"
        
        # Цена у верхней границы BB + перекуплен RSI
        elif current > bb_upper and rsi > 70:
            signal = 'put'
            confidence = min(85, 50 + (rsi - 70) * 2)
            entry_score = 80 if rsi > 80 else 65
            optimal_expiry = 3  # Быстрый откат
            reasoning = f"Overbought: RSI={rsi:.0f}, BB_upper={bb_upper:.6f}"
        
        return StrategyResult('mean_reversion', signal, confidence, entry_score,
                            optimal_expiry, {'bb_position': bb_position, 'rsi': rsi}, reasoning)
    
    def _momentum_strategy(self, closes, indicators) -> StrategyResult:
        """Стратегия моментума"""
        momentum_pct = indicators['momentum_pct']
        volume_trend = len(closes) > 1 and closes[-1] != closes[-2]
        macd_hist = indicators['macd_histogram']
        stoch_k = indicators['stoch_k']
        
        signal = None
        confidence = 0
        entry_score = 0
        optimal_expiry = 5
        reasoning = "Нет подтвержденного моментума"
        
        # Положительный моментум
        if momentum_pct > 0.05 and macd_hist > 0 and stoch_k < 80:
            signal = 'call'
            confidence = min(80, 55 + abs(momentum_pct) * 100)
            entry_score = 65
            optimal_expiry = 4
            reasoning = f"Bullish momentum: {momentum_pct:.3f}%, MACD_hist>0, Stoch={stoch_k:.0f}"
        
        # Отрицательный моментум
        elif momentum_pct < -0.05 and macd_hist < 0 and stoch_k > 20:
            signal = 'put'
            confidence = min(80, 55 + abs(momentum_pct) * 100)
            entry_score = 65
            optimal_expiry = 4
            reasoning = f"Bearish momentum: {momentum_pct:.3f}%, MACD_hist<0, Stoch={stoch_k:.0f}"
        
        return StrategyResult('momentum', signal, confidence, entry_score,
                            optimal_expiry, {'momentum': momentum_pct}, reasoning)
    
    def _volatility_breakout(self, closes, highs, lows, indicators) -> StrategyResult:
        """Стратегия пробоя по волатильности"""
        volatility = indicators['volatility']
        atr = indicators['atr']
        current = closes[-1]
        highest = indicators['highest_50']
        lowest = indicators['lowest_50']
        
        signal = None
        confidence = 0
        entry_score = 0
        optimal_expiry = 5
        reasoning = "Нет подтвержденного пробоя"
        
        # Пробой выше при растущей волатильности
        if current >= highest - atr * 0.5 and volatility > 0.3:
            signal = 'call'
            confidence = min(75, 50 + volatility * 10)
            entry_score = 60
            optimal_expiry = 6  # Пробой требует времени
            reasoning = f"Bullish breakout: volatility={volatility:.2f}%, ATR={atr:.6f}"
        
        # Пробой ниже при растущей волатильности
        elif current <= lowest + atr * 0.5 and volatility > 0.3:
            signal = 'put'
            confidence = min(75, 50 + volatility * 10)
            entry_score = 60
            optimal_expiry = 6
            reasoning = f"Bearish breakout: volatility={volatility:.2f}%, ATR={atr:.6f}"
        
        return StrategyResult('volatility_breakout', signal, confidence, entry_score,
                            optimal_expiry, {'volatility': volatility}, reasoning)
    
    def _support_resistance(self, closes, indicators) -> StrategyResult:
        """Стратегия на основе поддержки/сопротивления"""
        highest = indicators['highest_50']
        lowest = indicators['lowest_50']
        current = closes[-1]
        distance_to_high = (highest - current) / current * 100
        distance_to_low = (current - lowest) / current * 100
        rsi = indicators['rsi']
        
        signal = None
        confidence = 0
        entry_score = 0
        optimal_expiry = 5
        reasoning = "Нет подтвержденного отскока от уровня"
        
        # Отскок от поддержки
        if distance_to_low < 0.5 and rsi < 40:
            signal = 'call'
            confidence = 60 + (40 - rsi) * 0.5
            entry_score = 75
            optimal_expiry = 4
            reasoning = f"Support bounce: distance={distance_to_low:.2f}%, RSI={rsi:.0f}"
        
        # Откат от сопротивления
        elif distance_to_high < 0.5 and rsi > 60:
            signal = 'put'
            confidence = 60 + (rsi - 60) * 0.5
            entry_score = 75
            optimal_expiry = 4
            reasoning = f"Resistance rejection: distance={distance_to_high:.2f}%, RSI={rsi:.0f}"
        
        return StrategyResult('support_resistance', signal, confidence, entry_score,
                            optimal_expiry, {'distance_high': distance_to_high}, reasoning)
    
    def _macd_crossover(self, closes, indicators) -> StrategyResult:
        """Стратегия на основе MACD кроссовера"""
        macd = indicators['macd']
        macd_signal = indicators['macd_signal']
        macd_hist = indicators['macd_histogram']
        
        signal = None
        confidence = 0
        entry_score = 0
        optimal_expiry = 5
        reasoning = "Нет подтвержденного пересечения MACD"
        
        # MACD выше сигнальной линии (bullish)
        if macd > macd_signal and macd_hist > 0:
            signal = 'call'
            confidence = min(75, 55 + abs(macd_hist) * 1000)
            entry_score = 65
            optimal_expiry = 5
            reasoning = f"MACD bullish crossover: MACD={macd:.6f}, Signal={macd_signal:.6f}"
        
        # MACD ниже сигнальной линии (bearish)
        elif macd < macd_signal and macd_hist < 0:
            signal = 'put'
            confidence = min(75, 55 + abs(macd_hist) * 1000)
            entry_score = 65
            optimal_expiry = 5
            reasoning = f"MACD bearish crossover: MACD={macd:.6f}, Signal={macd_signal:.6f}"
        
        return StrategyResult('macd_crossover', signal, confidence, entry_score,
                            optimal_expiry, {'macd_hist': macd_hist}, reasoning)
    
    def _merge_strategies(self, results: List[StrategyResult], indicators: Dict) -> Dict:
        """Объединение сигналов из разных стратегий"""
        # Инициализация по умолчанию для всех переменных
        final_signal = None
        final_confidence = 0
        final_entry_score = 0
        final_expiry = 5
        best_strategy = None
        
        if not results:
            return {
                'signal': final_signal, 
                'confidence': final_confidence,
                'entry_score': final_entry_score,
                'optimal_expiry': final_expiry,
                'best_strategy': best_strategy,
                'all_strategies': []
            }
        
        # Группировка по направлениям
        calls = [r for r in results if r.signal == 'call']
        puts = [r for r in results if r.signal == 'put']
        
        # Берём направление с большинством сигналов
        if len(calls) > len(puts):
            final_signal = 'call'
            # Берём лучший сигнал CALL по confidence
            best = max(calls, key=lambda x: x.confidence)
            final_confidence = best.confidence
            final_entry_score = best.entry_score
            final_expiry = best.optimal_expiry
            best_strategy = best.strategy_name
            
            # Бонус если несколько стратегий согласны
            if len(calls) >= 2:
                final_confidence = min(95, final_confidence + 10)
        
        elif len(puts) > len(calls):
            final_signal = 'put'
            best = max(puts, key=lambda x: x.confidence)
            final_confidence = best.confidence
            final_entry_score = best.entry_score
            final_expiry = best.optimal_expiry
            best_strategy = best.strategy_name
            
            if len(puts) >= 2:
                final_confidence = min(95, final_confidence + 10)
        
        else:
            # Равное количество - берём по confidence
            if len(calls) > 0 or len(puts) > 0:
                all_strategies = calls + puts
                best = max(all_strategies, key=lambda x: x.confidence)
                final_signal = best.signal
                final_confidence = best.confidence
                final_entry_score = best.entry_score
                final_expiry = best.optimal_expiry
                best_strategy = best.strategy_name
        
        # Корректировка экспирации по волатильности
        if final_signal:  # только если есть сигнал
            volatility = indicators.get('volatility', 0.5)
            if volatility > 1.0:
                final_expiry = min(15, final_expiry + 2)
            elif volatility < 0.2:
                final_expiry = max(2, final_expiry - 1)
        
        return {
            'signal': final_signal,
            'confidence': final_confidence,
            'entry_score': final_entry_score,
            'optimal_expiry': final_expiry,
            'best_strategy': best_strategy,
            'all_strategies': [
                {
                    'name': r.strategy_name,
                    'signal': r.signal,
                    'confidence': r.confidence,
                    'reasoning': r.reasoning
                }
                for r in results
            ]
        }
    
    def _determine_regime(self, indicators: Dict) -> str:
        """Определение режима рынка"""
        rsi = indicators['rsi']
        volatility = indicators['volatility']
        
        if volatility > 1.5:
            return 'HIGHLY_VOLATILE'
        elif volatility > 0.7:
            return 'VOLATILE'
        elif rsi > 70:
            return 'OVERBOUGHT'
        elif rsi < 30:
            return 'OVERSOLD'
        else:
            return 'NEUTRAL'
    
    # === Вспомогательные функции расчета индикаторов ===
    
    def _calculate_rsi(self, closes, period=14):
        """Расчет RSI"""
        deltas = np.diff(closes)
        seed = deltas[:period+1]
        up = seed[seed >= 0].sum() / period
        down = -seed[seed < 0].sum() / period
        rs = up / down if down != 0 else 1
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    def _calculate_ema(self, closes, period):
        """Расчет EMA"""
        if len(closes) < period:
            return closes[-1]
        
        multiplier = 2 / (period + 1)
        ema = np.mean(closes[:period])
        
        for close in closes[period:]:
            ema += (close - ema) * multiplier
        
        return ema
    
    def _calculate_macd(self, closes, fast=12, slow=26, signal=9):
        """Расчет MACD"""
        ema_fast = self._calculate_ema(closes, fast) if len(closes) >= fast else closes[-1]
        ema_slow = self._calculate_ema(closes, slow) if len(closes) >= slow else closes[-1]
        macd_line = ema_fast - ema_slow
        
        # Signal line (упрощённо)
        signal_line = self._calculate_ema(np.array([macd_line]), signal) if len(closes) >= signal else macd_line
        histogram = macd_line - signal_line
        
        return macd_line, signal_line, histogram
    
    def _calculate_atr(self, highs, lows, closes, period=14):
        """Расчет ATR"""
        tr = np.max([highs[-1] - lows[-1], 
                     abs(highs[-1] - closes[-2]) if len(closes) > 1 else highs[-1] - lows[-1],
                     abs(lows[-1] - closes[-2]) if len(closes) > 1 else highs[-1] - lows[-1]])
        return tr
    
    def _calculate_stochastic(self, closes, highs, lows, period=14):
        """Расчет Stochastic"""
        highest = np.max(highs[-period:])
        lowest = np.min(lows[-period:])
        k = ((closes[-1] - lowest) / (highest - lowest)) * 100 if (highest - lowest) != 0 else 50
        d = k  # Упрощённо
        return k, d
    
    def _calculate_cci(self, closes, highs, lows, period=20):
        """Расчет CCI"""
        typical_price = (closes[-1] + highs[-1] + lows[-1]) / 3
        sma = np.mean(closes[-period:])
        mad = np.mean(np.abs(closes[-period:] - sma))
        cci = (typical_price - sma) / (0.015 * mad) if mad != 0 else 0
        return cci
