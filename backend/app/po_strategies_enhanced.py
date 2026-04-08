"""
Улучшенная стратегия анализа сигналов
Добавлены: Стохастик, CCI, ADX, паттерны свечей, поддержка/сопротивление
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
import math


def calculate_stochastic(closes: List[float], highs: List[float], lows: List[float], period: int = 14) -> float:
    """Расчет стохастика %K"""
    if len(closes) < period:
        return 50.0
    
    recent_highs = highs[-period:]
    recent_lows = lows[-period:]
    current_close = closes[-1]
    
    highest_high = max(recent_highs)
    lowest_low = min(recent_lows)
    
    if highest_high == lowest_low:
        return 50.0
    
    k = ((current_close - lowest_low) / (highest_high - lowest_low)) * 100
    return k


def calculate_cci(highs: List[float], lows: List[float], closes: List[float], period: int = 20) -> float:
    """Расчет CCI (Commodity Channel Index)"""
    if len(closes) < period:
        return 0.0
    
    typical_prices = []
    for i in range(len(closes) - period, len(closes)):
        tp = (highs[i] + lows[i] + closes[i]) / 3
        typical_prices.append(tp)
    
    mean_tp = sum(typical_prices) / len(typical_prices)
    mean_deviation = sum(abs(tp - mean_tp) for tp in typical_prices) / len(typical_prices)
    
    if mean_deviation == 0:
        return 0.0
    
    current_tp = (highs[-1] + lows[-1] + closes[-1]) / 3
    cci = (current_tp - mean_tp) / (0.015 * mean_deviation)
    
    return cci


def detect_candlestick_pattern(opens: List[float], highs: List[float], 
                               lows: List[float], closes: List[float]) -> Dict:
    """Определение паттернов свечей"""
    if len(closes) < 2:
        return {'type': 'none', 'name': 'none', 'strength': 0, 'confidence': 0.5}
    
    o = opens[-1]
    h = highs[-1]
    l = lows[-1]
    c = closes[-1]
    
    body = abs(c - o)
    upper_wick = h - max(o, c)
    lower_wick = min(o, c) - l
    total_range = h - l if h != l else 0.0001
    
    # Молот (Hammer) - bullish
    if lower_wick > body * 2 and upper_wick < body * 0.5:
        return {'type': 'bullish', 'name': 'hammer', 'strength': 0.8, 'confidence': 0.75}
    
    # Падающая звезда (Shooting Star) - bearish
    if upper_wick > body * 2 and lower_wick < body * 0.5:
        return {'type': 'bearish', 'name': 'shooting_star', 'strength': 0.8, 'confidence': 0.75}
    
    # Бычье поглощение
    if len(closes) >= 2:
        prev_o = opens[-2]
        prev_c = closes[-2]
        if prev_c < prev_o and c > o and c > prev_o and o < prev_c:
            return {'type': 'bullish', 'name': 'bullish_engulfing', 'strength': 0.9, 'confidence': 0.80}
        
        # Медвежье поглощение
        if prev_c > prev_o and c < o and c < prev_o and o > prev_c:
            return {'type': 'bearish', 'name': 'bearish_engulfing', 'strength': 0.9, 'confidence': 0.80}
    
    return {'type': 'none', 'name': 'none', 'strength': 0, 'confidence': 0.5}


def calculate_support_resistance(closes: List[float], period: int = 20) -> tuple:
    """Определение уровней поддержки и сопротивления"""
    if len(closes) < period:
        return closes[-1], closes[-1]
    
    recent = closes[-period:]
    support = min(recent)
    resistance = max(recent)
    
    return support, resistance
