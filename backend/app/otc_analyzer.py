# OTC Signal Analyzer Service
# Сервис анализа сигналов для OTC рынка

import numpy as np
import pandas as pd
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import json


class OTCSignalAnalyzer:
    """
    Анализатор сигналов для OTC торговли
    На основе паттернов и технических индикаторов
    """
    
    def __init__(self):
        # Параметры индикаторов
        self.rsi_period = 14
        self.macd_fast = 12
        self.macd_slow = 26
        self.macd_signal = 9
        self.bb_period = 20
        self.bb_std = 2.0
        
        # Пороги для сигналов
        self.RSI_OVERBOUGHT = 70
        self.RSI_OVERSOLD = 30
        
        # Минимальная уверенность для сигнала
        self.MIN_CONFIDENCE = 60.0
        
    def calculate_rsi(self, prices: List[float], period: int = 14) -> Tuple[float, str]:
        """
        Расчет RSI (Relative Strength Index)
        Возвращает значение и сигнал
        """
        if len(prices) < period + 1:
            return 50.0, "neutral"
        
        # Вычисляем изменения цен
        deltas = np.diff(prices[-period-1:])
        
        # Разделяем на положительные и отрицательные
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        # Средние значения
        avg_gain = np.mean(gains) if len(gains) > 0 else 0
        avg_loss = np.mean(losses) if len(losses) > 0 else 0
        
        # RS и RSI
        if avg_loss == 0:
            rsi = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
        
        # Определяем сигнал
        if rsi >= self.RSI_OVERBOUGHT:
            signal = "overbought"  # Пора продавать (PUT)
        elif rsi <= self.RSI_OVERSOLD:
            signal = "oversold"  # Пора покупать (CALL)
        else:
            signal = "neutral"
        
        return round(rsi, 2), signal
    
    def calculate_macd(self, prices: List[float]) -> Tuple[float, float, float, str]:
        """
        Расчет MACD (Moving Average Convergence Divergence)
        Возвращает: macd_line, signal_line, histogram, trend
        """
        if len(prices) < self.macd_slow + self.macd_signal:
            return 0.0, 0.0, 0.0, "neutral"
        
        # EMA calculations
        ema_fast = self._calculate_ema(prices, self.macd_fast)
        ema_slow = self._calculate_ema(prices, self.macd_slow)
        
        # MACD line
        macd_line = ema_fast - ema_slow
        
        # Signal line (EMA of MACD)
        macd_values = []
        for i in range(self.macd_slow, len(prices)):
            fast = self._calculate_ema(prices[:i+1], self.macd_fast)
            slow = self._calculate_ema(prices[:i+1], self.macd_slow)
            macd_values.append(fast - slow)
        
        signal_line = self._calculate_ema(macd_values, self.macd_signal) if len(macd_values) >= self.macd_signal else 0.0
        
        # Histogram
        histogram = macd_line - signal_line
        
        # Trend
        if histogram > 0 and macd_line > 0:
            trend = "bullish"
        elif histogram < 0 and macd_line < 0:
            trend = "bearish"
        else:
            trend = "neutral"
        
        return round(macd_line, 4), round(signal_line, 4), round(histogram, 4), trend
    
    def _calculate_ema(self, prices: List[float], period: int) -> float:
        """Расчет EMA (Exponential Moving Average)"""
        if len(prices) < period:
            return np.mean(prices) if prices else 0.0
        
        multiplier = 2 / (period + 1)
        ema = sum(prices[:period]) / period
        
        for price in prices[period:]:
            ema = (price - ema) * multiplier + ema
        
        return ema
    
    def calculate_bollinger_bands(self, prices: List[float]) -> Tuple[float, float, float, float, float]:
        """
        Расчет полос Боллинджера
        Возвращает: upper, middle, lower, width, position
        """
        if len(prices) < self.bb_period:
            return 0.0, 0.0, 0.0, 0.0, 0.5
        
        # Middle band (SMA)
        middle = np.mean(prices[-self.bb_period:])
        
        # Standard deviation
        std = np.std(prices[-self.bb_period:])
        
        # Upper and lower bands
        upper = middle + (self.bb_std * std)
        lower = middle - (self.bb_std * std)
        
        # Width
        width = (upper - lower) / middle if middle > 0 else 0
        
        # Position (0-1)
        current_price = prices[-1]
        position = (current_price - lower) / (upper - lower) if upper != lower else 0.5
        
        return round(upper, 4), round(middle, 4), round(lower, 4), round(width, 4), round(position, 4)
    
    def detect_trend(self, prices: List[float], lookback: int = 20) -> Tuple[str, float]:
        """
        Определение тренда
        Возвращает: direction, strength
        """
        if len(prices) < lookback:
            return "sideways", 0.0
        
        recent = prices[-lookback:]
        
        # Linear regression slope
        x = np.arange(len(recent))
        slope = np.polyfit(x, recent, 1)[0]
        
        # Normalized slope
        avg_price = np.mean(recent)
        normalized_slope = (slope / avg_price) * 1000 if avg_price > 0 else 0
        
        # Direction and strength
        if normalized_slope > 0.5:
            direction = "up"
            strength = min(abs(normalized_slope) * 2, 100)
        elif normalized_slope < -0.5:
            direction = "down"
            strength = min(abs(normalized_slope) * 2, 100)
        else:
            direction = "sideways"
            strength = min(abs(normalized_slope) * 2, 100)
        
        return direction, round(strength, 2)
    
    def detect_pattern(self, prices: List[float]) -> Optional[Dict]:
        """
        Обнаружение свечных паттернов
        """
        if len(prices) < 5:
            return None
        
        # Простая реализация основных паттернов
        recent = prices[-5:]
        
        # Engulfing pattern
        if len(recent) >= 2:
            if recent[-2] < recent[-1] and recent[-2] < recent[-3]:
                return {
                    "type": "bullish_engulfing",
                    "category": "reversal",
                    "signal": "call",
                    "strength": 75
                }
            elif recent[-2] > recent[-1] and recent[-2] > recent[-3]:
                return {
                    "type": "bearish_engulfing",
                    "category": "reversal",
                    "signal": "put",
                    "strength": 75
                }
        
        # Three candles pattern
        if len(recent) >= 3:
            # Three white soldiers (CALL)
            if all(recent[i] > recent[i-1] for i in range(-3, 0)):
                return {
                    "type": "three_white_soldiers",
                    "category": "continuation",
                    "signal": "call",
                    "strength": 80
                }
            
            # Three black crows (PUT)
            if all(recent[i] < recent[i-1] for i in range(-3, 0)):
                return {
                    "type": "three_black_crows",
                    "category": "continuation",
                    "signal": "put",
                    "strength": 80
                }
        
        return None
    
    def generate_signal(self, prices: List[float], symbol: str = "UNKNOWN") -> Optional[Dict]:
        """
        Генерация торгового сигнала на основе комплексного анализа
        """
        if len(prices) < 50:
            return None
        
        current_price = prices[-1]
        
        # 1. RSI анализ
        rsi, rsi_signal = self.calculate_rsi(prices)
        
        # 2. MACD анализ
        macd_line, signal_line, histogram, macd_trend = self.calculate_macd(prices)
        
        # 3. Bollinger Bands
        bb_upper, bb_middle, bb_lower, bb_width, bb_position = self.calculate_bollinger_bands(prices)
        
        # 4. Тренд
        trend_direction, trend_strength = self.detect_trend(prices)
        
        # 5. Паттерны
        pattern = self.detect_pattern(prices)
        
        # Комплексная оценка
        confidence = 50.0  # Базовая уверенность
        signals = []
        
        # RSI вклад
        if rsi_signal == "oversold":
            confidence += 15
            signals.append("RSI oversold")
        elif rsi_signal == "overbought":
            confidence -= 15
            signals.append("RSI overbought")
        
        # MACD вклад
        if macd_trend == "bullish":
            confidence += 15
            signals.append("MACD bullish")
        elif macd_trend == "bearish":
            confidence -= 15
            signals.append("MACD bearish")
        
        # Bollinger Bands вклад
        if bb_position < 0.2:  # Цена у нижней полосы
            confidence += 10
            signals.append("BB lower band")
        elif bb_position > 0.8:  # Цена у верхней полосы
            confidence -= 10
            signals.append("BB upper band")
        
        # Тренд вклад
        if trend_direction == "up" and trend_strength > 50:
            confidence += 10
            signals.append(f"Strong uptrend ({trend_strength}%)")
        elif trend_direction == "down" and trend_strength > 50:
            confidence -= 10
            signals.append(f"Strong downtrend ({trend_strength}%)")
        
        # Паттерн вклад
        if pattern:
            if pattern["signal"] == "call":
                confidence += pattern["strength"] / 5
            else:
                confidence -= pattern["strength"] / 5
            signals.append(f"Pattern: {pattern['type']}")
        
        # Окончательное решение
        final_signal = None
        if confidence >= self.MIN_CONFIDENCE:
            final_signal = "call"
        elif confidence <= (100 - self.MIN_CONFIDENCE):
            final_signal = "put"
        
        if not final_signal:
            return None
        
        # Определение силы сигнала
        if confidence >= 80:
            strength = "strong"
        elif confidence >= 65:
            strength = "medium"
        else:
            strength = "weak"
        
        return {
            "symbol": symbol,
            "signal_type": final_signal,
            "strength": strength,
            "confidence": round(min(max(confidence, 0), 100), 2),
            "current_price": current_price,
            "indicators": {
                "rsi": rsi,
                "rsi_signal": rsi_signal,
                "macd": macd_line,
                "macd_signal": signal_line,
                "macd_histogram": histogram,
                "macd_trend": macd_trend,
                "bollinger_upper": bb_upper,
                "bollinger_middle": bb_middle,
                "bollinger_lower": bb_lower,
                "bollinger_position": bb_position,
            },
            "trend": {
                "direction": trend_direction,
                "strength": trend_strength,
            },
            "pattern": pattern,
            "signals": signals,
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    def analyze_otc_asset(self, prices: List[Dict], symbol: str) -> Dict:
        """
        Полный анализ OTC актива
        prices: список словарей [{timestamp, price, volume}, ...]
        """
        if not prices or len(prices) < 50:
            return {"error": "Недостаточно данных для анализа"}
        
        # Извлекаем цены
        price_list = [p.get("price", p.get("close", 0)) for p in prices]
        
        # Генерируем сигнал
        signal = self.generate_signal(price_list, symbol)
        
        # Дополнительная статистика
        current_price = price_list[-1]
        price_change = price_list[-1] - price_list[-50] if len(price_list) >= 50 else 0
        price_change_percent = (price_change / price_list[-50] * 100) if len(price_list) >= 50 and price_list[-50] > 0 else 0
        
        # Волатильность
        returns = np.diff(price_list) / price_list[:-1]
        volatility = np.std(returns) * 100 if len(returns) > 0 else 0
        
        return {
            "symbol": symbol,
            "asset_type": "OTC",
            "current_price": current_price,
            "price_change": round(price_change, 5),
            "price_change_percent": round(price_change_percent, 3),
            "volatility": round(volatility, 4),
            "data_points": len(prices),
            "signal": signal,
            "analyzed_at": datetime.utcnow().isoformat(),
        }


# Singleton instance
analyzer = OTCSignalAnalyzer()


def get_analyzer() -> OTCSignalAnalyzer:
    """Получение экземпляра анализатора"""
    return analyzer
