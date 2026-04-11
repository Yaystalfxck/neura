"""
Различные торговые стратегии для анализа рынка.
Используются для подтверждения сигналов от ML.
"""
from typing import List, Dict
import numpy as np


def calculate_ema(data: List[float], period: int) -> float:
    """Расчет EMA"""
    if len(data) < period:
        return data[-1] if data else 0
    
    # Простое рекуррентное вычисление для последней точки
    multiplier = 2 / (period + 1)
    ema_prev = sum(data[:period]) / period
    ema = ema_prev
    
    for price in data[period:]:
        ema = (price - ema) * multiplier + ema
    return ema


def analyze_mean_reversion(candles: List[Dict]) -> Dict:
    """
    Стратегия возврата к среднему.
    Логика: Если цена сильно отклонилась от средней (RSI + Bollinger), ждем разворота.
    """
    if len(candles) < 20:
        return {'signal': None, 'confidence': 0}

    closes = [c['close'] for c in candles]
    
    # 1. RSI
    gains = []
    losses = []
    for i in range(1, len(closes)):
        change = closes[i] - closes[i-1]
        if change > 0: gains.append(change)
        else: losses.append(abs(change))
    
    avg_gain = sum(gains[-14:]) / 14 if len(gains) >= 14 else 0
    avg_loss = sum(losses[-14:]) / 14 if len(losses) >= 14 else 0.001
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    # 2. Bollinger Bands (простая версия)
    sma = sum(closes[-20:]) / 20
    std_dev = (sum((x - sma) ** 2 for x in closes[-20:]) / 20) ** 0.5
    upper_band = sma + (2 * std_dev)
    lower_band = sma - (2 * std_dev)
    current_price = closes[-1]

    signal = None
    confidence = 0

    # Сигнал PUT: RSI > 70 и Цена > Верхней полосы
    if rsi > 70 and current_price > upper_band:
        signal = 'put'
        confidence = 70 # Базовая уверенность
        # Усиливаем, если RSI очень высокий
        if rsi > 80: confidence += 10
        
    # Сигнал CALL: RSI < 30 и Цена < Нижней полосы
    elif rsi < 30 and current_price < lower_band:
        signal = 'call'
        confidence = 70
        if rsi < 20: confidence += 10

    return {
        'signal': signal,
        'confidence': confidence,
        'source': 'MEAN_REVERSION',
        'details': f"RSI={rsi:.1f}, Price={current_price:.5f}, Upper={upper_band:.5f}"
    }


def analyze_trend_following(candles: List[Dict]) -> Dict:
    """
    Стратегия следования за трендом.
    Логика: Если EMA10 > EMA20 > EMA50 -> Сильный восходящий тренд (CALL).
    """
    if len(candles) < 50:
        return {'signal': None, 'confidence': 0}

    closes = [c['close'] for c in candles]
    
    ema_10 = calculate_ema(closes, 10)
    ema_20 = calculate_ema(closes, 20)
    ema_50 = calculate_ema(closes, 50)
    
    current_price = closes[-1]
    signal = None
    confidence = 0

    # Бычий тренд: Цена > EMA10 > EMA20 > EMA50
    if current_price > ema_10 > ema_20 > ema_50:
        signal = 'call'
        confidence = 75
        # Если расхождение между EMA большое, тренд сильный
        if (ema_10 - ema_50) / ema_50 > 0.002:
            confidence += 10

    # Медвежий тренд: Цена < EMA10 < EMA20 < EMA50
    elif current_price < ema_10 < ema_20 < ema_50:
        signal = 'put'
        confidence = 75
        if (ema_50 - ema_10) / ema_50 > 0.002:
            confidence += 10

    return {
        'signal': signal,
        'confidence': confidence,
        'source': 'TREND_FOLLOWING',
        'details': f"EMA10={ema_10:.5f}, EMA50={ema_50:.5f}"
    }


def analyze_momentum(candles: List[Dict]) -> Dict:
    """
    Стратегия импульса.
    Логика: 3 сильные свечи подряд в одном направлении -> продолжение движения.
    """
    if len(candles) < 5:
        return {'signal': None, 'confidence': 0}

    last_3 = candles[-3:]
    bodies = []
    
    for c in last_3:
        body = abs(c['close'] - c['open'])
        # Проверяем, что свеча не доджи (есть тело)
        if body < 0.00005: return {'signal': None, 'confidence': 0} 
        bodies.append(c['close'] - c['open'])

    # Все 3 свечи вверх
    if all(b > 0 for b in bodies):
        return {
            'signal': 'call',
            'confidence': 65,
            'source': 'MOMENTUM',
            'details': '3 Strong Bullish Candles'
        }
    
    # Все 3 свечи вниз
    elif all(b < 0 for b in bodies):
        return {
            'signal': 'put',
            'confidence': 65,
            'source': 'MOMENTUM',
            'details': '3 Strong Bearish Candles'
        }

    return {'signal': None, 'confidence': 0}


def get_varied_strategies_consensus(candles: List[Dict]) -> Dict:
    """
    Запускает все стратегии и ищет согласие.
    """
    mr = analyze_mean_reversion(candles)
    tf = analyze_trend_following(candles)
    mom = analyze_momentum(candles)

    signals = [mr, tf, mom]
    
    call_votes = 0
    put_votes = 0
    max_conf = 0

    for s in signals:
        if s['signal'] == 'call':
            call_votes += 1
            max_conf = max(max_conf, s['confidence'])
        elif s['signal'] == 'put':
            put_votes += 1
            max_conf = max(max_conf, s['confidence'])

    final_signal = None
    final_confidence = 0

    # Если большинство (2 из 3) согласны
    if call_votes >= 2:
        final_signal = 'call'
        # Если все 3 согласны - супер уверенность
        final_confidence = max_conf + (15 if call_votes == 3 else 5)
    elif put_votes >= 2:
        final_signal = 'put'
        final_confidence = max_conf + (15 if put_votes == 3 else 5)

    return {
        'signal': final_signal,
        'confidence': final_confidence,
        'call_votes': call_votes,
        'put_votes': put_votes,
        'strategies': {'MR': mr, 'TF': tf, 'Momentum': mom}
    }
