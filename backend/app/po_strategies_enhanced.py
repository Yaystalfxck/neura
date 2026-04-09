"""
Дополнительные стратегии для анализа сигналов
"""

from typing import List, Dict, Optional
import math


def detect_candlestick_patterns(candles: List[Dict]) -> Dict:
    """
    Определение свечных паттернов
    
    Returns:
        Dict с обнаруженными паттернами и их сигналом
    """
    if not candles or len(candles) < 3:
        return {'patterns': [], 'signal': None, 'strength': 0}
    
    patterns = []
    bullish_signals = 0
    bearish_signals = 0
    
    # Последние 3 свечи для анализа
    c1 = candles[-3]  # Предпоследняя
    c2 = candles[-2]  # Вторая с конца
    c3 = candles[-1]  # Последняя
    
    # Извлекаем данные
    def get_val(candle, key, default=0):
        if isinstance(candle, dict):
            return float(candle.get(key, default))
        return float(getattr(candle, key, default))
    
    c1_open = get_val(c1, 'open')
    c1_close = get_val(c1, 'close')
    c2_open = get_val(c2, 'open')
    c2_close = get_val(c2, 'close')
    c3_open = get_val(c3, 'open')
    c3_close = get_val(c3, 'close')
    
    c1_high = get_val(c1, 'high')
    c1_low = get_val(c1, 'low')
    c2_high = get_val(c2, 'high')
    c2_low = get_val(c2, 'low')
    c3_high = get_val(c3, 'high')
    c3_low = get_val(c3, 'low')
    
    # 1. Bullish Engulfing
    if c2_close < c2_open and c3_close > c3_open and c3_close > c2_open and c3_open < c2_close:
        patterns.append('Bullish Engulfing')
        bullish_signals += 2  # Сильный сигнал
    
    # 2. Bearish Engulfing
    if c2_close > c2_open and c3_close < c3_open and c3_close < c2_open and c3_open > c2_close:
        patterns.append('Bearish Engulfing')
        bearish_signals += 2  # Сильный сигнал
    
    # 3. Hammer (бычий разворот)
    c3_body = abs(c3_close - c3_open)
    c3_lower_shadow = min(c3_open, c3_close) - c3_low
    c3_upper_shadow = c3_high - max(c3_open, c3_close)
    
    if c3_lower_shadow > 2 * c3_body and c3_upper_shadow < c3_body * 0.5:
        patterns.append('Hammer')
        bullish_signals += 1.5
    
    # 4. Shooting Star (медвежий разворот)
    if c3_upper_shadow > 2 * c3_body and c3_lower_shadow < c3_body * 0.5:
        patterns.append('Shooting Star')
        bearish_signals += 1.5
    
    # 5. Doji (неопределенность)
    if abs(c3_close - c3_open) / c3_open < 0.0001:
        patterns.append('Doji')
        # Doji - нейтральный сигнал
    
    # 6. Morning Star (бычий разворот - 3 свечи)
    if c2_close < c2_open and abs(c1_close - c1_open) / c1_open < 0.001 and c3_close > c3_open and c3_close > (c2_open + c2_close) / 2:
        patterns.append('Morning Star')
        bullish_signals += 2.5  # Очень сильный сигнал
    
    # 7. Evening Star (медвежий разворот - 3 свечи)
    if c2_close > c2_open and abs(c1_close - c1_open) / c1_open < 0.001 and c3_close < c3_open and c3_close < (c2_open + c2_close) / 2:
        patterns.append('Evening Star')
        bearish_signals += 2.5  # Очень сильный сигнал
    
    # 8. Three White Soldiers (3 бычьи свечи)
    if c1_close > c1_open and c2_close > c2_open and c3_close > c3_open:
        if c2_close > c1_close and c3_close > c2_close:
            patterns.append('Three White Soldiers')
            bullish_signals += 2
    
    # 9. Three Black Crows (3 медвежьи свечи)
    if c1_close < c1_open and c2_close < c2_open and c3_close < c3_open:
        if c2_close < c1_close and c3_close < c2_close:
            patterns.append('Three Black Crows')
            bearish_signals += 2
    
    # Определяем итоговый сигнал
    total_signals = bullish_signals + bearish_signals
    if total_signals == 0:
        signal = None
        strength = 0
    elif bullish_signals > bearish_signals:
        signal = 'call'
        strength = min(95, 60 + bullish_signals * 10)
    else:
        signal = 'put'
        strength = min(95, 60 + bearish_signals * 10)
    
    return {
        'patterns': patterns,
        'signal': signal,
        'strength': strength,
        'bullish_count': bullish_signals,
        'bearish_count': bearish_signals
    }


def analyze_trend_strength(candles: List[Dict]) -> Dict:
    """
    Анализ силы тренда
    
    Returns:
        Dict с информацией о тренде
    """
    if not candles or len(candles) < 20:
        return {
            'trend': 'neutral',
            'strength': 0,
            'adx': 0,
            'is_strong_trend': False
        }
    
    # Извлекаем цены закрытия
    closes = []
    for c in candles:
        if isinstance(c, dict):
            closes.append(float(c.get('close', 0)))
        else:
            closes.append(float(getattr(c, 'close', 0)))
    
    if len(closes) < 20:
        return {
            'trend': 'neutral',
            'strength': 0,
            'adx': 0,
            'is_strong_trend': False
        }
    
    # Определяем направление тренда
    recent = closes[-10:]
    up_moves = sum(1 for i in range(1, len(recent)) if recent[i] > recent[i-1])
    down_moves = 10 - up_moves
    
    if up_moves > down_moves + 2:
        trend = 'bullish'
    elif down_moves > up_moves + 2:
        trend = 'bearish'
    else:
        trend = 'neutral'
    
    # Расчет ADX (упрощенный)
    # Используем разницу между максимальными и минимальными ценами
    highs = []
    lows = []
    for c in candles[-14:]:
        if isinstance(c, dict):
            highs.append(float(c.get('high', 0)))
            lows.append(float(c.get('low', 0)))
        else:
            highs.append(float(getattr(c, 'high', 0)))
            lows.append(float(getattr(c, 'low', 0)))
    
    if highs and lows:
        range_size = (max(highs) - min(lows)) / min(lows) * 100
        # Нормализуем ADX (0-100)
        adx = min(100, range_size * 10)
    else:
        adx = 0
    
    # Сила тренда
    strength = abs(up_moves - down_moves) / 10 * 100
    is_strong_trend = adx > 25  # ADX > 25 = сильный тренд
    
    return {
        'trend': trend,
        'strength': strength,
        'adx': adx,
        'is_strong_trend': is_strong_trend,
        'up_moves': up_moves,
        'down_moves': down_moves
    }


def analyze_volume_profile(candles: List[Dict]) -> Dict:
    """
    Анализ объемного профиля
    
    Returns:
        Dict с информацией об объемах
    """
    if not candles or len(candles) < 10:
        return {
            'volume_trend': 'neutral',
            'volume_ratio': 1.0,
            'is_high_volume': False,
            'signal': None
        }
    
    # Если нет данных об объеме - используем диапазон свечей как прокси
    ranges = []
    for c in candles:
        if isinstance(c, dict):
            high = float(c.get('high', 0))
            low = float(c.get('low', 0))
            close = float(c.get('close', 0))
            open_p = float(c.get('open', 0))
        else:
            high = float(getattr(c, 'high', 0))
            low = float(getattr(c, 'low', 0))
            close = float(getattr(c, 'close', 0))
            open_p = float(getattr(c, 'open', 0))
        
        ranges.append({
            'range': high - low,
            'body': abs(close - open_p),
            'direction': 1 if close > open_p else -1
        })
    
    if not ranges:
        return {
            'volume_trend': 'neutral',
            'volume_ratio': 1.0,
            'is_high_volume': False,
            'signal': None
        }
    
    # Средний объем (диапазон) за последние 10 свечей
    recent_avg = sum(r['range'] for r in ranges[-10:]) / 10
    # Средний объем за все время
    total_avg = sum(r['range'] for r in ranges) / len(ranges)
    
    volume_ratio = recent_avg / total_avg if total_avg > 0 else 1.0
    is_high_volume = volume_ratio > 1.5
    
    # Определяем тренд объемов
    recent_direction = sum(r['direction'] for r in ranges[-5:])
    
    if is_high_volume and recent_direction > 0:
        volume_trend = 'bullish'
        signal = 'call'
    elif is_high_volume and recent_direction < 0:
        volume_trend = 'bearish'
        signal = 'put'
    else:
        volume_trend = 'neutral'
        signal = None
    
    return {
        'volume_trend': volume_trend,
        'volume_ratio': volume_ratio,
        'is_high_volume': is_high_volume,
        'signal': signal,
        'recent_direction': recent_direction
    }


def combined_strategy_analysis(candles: List[Dict]) -> Dict:
    """
    Комбинированный анализ с голосованием стратегий
    
    Returns:
        Dict с итоговым сигналом и уверенностью
    """
    if not candles or len(candles) < 20:
        return {
            'signal': None,
            'confidence': 0,
            'strategies': {},
            'vote_count': 0
        }
    
    # Запускаем все стратегии
    candlestick = detect_candlestick_patterns(candles)
    trend = analyze_trend_strength(candles)
    volume = analyze_volume_profile(candles)
    
    # Голосование стратегий
    votes = {'call': 0, 'put': 0}
    strategy_results = {}
    
    # 1. Свечные паттерны
    if candlestick['signal']:
        votes[candlestick['signal']] += candlestick['strength'] / 100
        strategy_results['candlestick'] = {
            'signal': candlestick['signal'],
            'strength': candlestick['strength'],
            'patterns': candlestick['patterns']
        }
    
    # 2. Тренд
    if trend['trend'] != 'neutral':
        votes[trend['trend']] += trend['strength'] / 100
        strategy_results['trend'] = {
            'signal': trend['trend'],
            'strength': trend['strength'],
            'adx': trend['adx'],
            'is_strong': trend['is_strong_trend']
        }
    
    # 3. Объемы
    if volume['signal']:
        votes[volume['signal']] += 0.5  # Объемы менее надежны
        strategy_results['volume'] = {
            'signal': volume['signal'],
            'volume_ratio': volume['volume_ratio'],
            'is_high': volume['is_high_volume']
        }
    
    # Определяем победителя
    total_votes = votes['call'] + votes['put']
    if total_votes == 0:
        return {
            'signal': None,
            'confidence': 0,
            'strategies': strategy_results,
            'vote_count': 0
        }
    
    if votes['call'] > votes['put']:
        signal = 'call'
        confidence = min(95, 50 + votes['call'] * 30)
    else:
        signal = 'put'
        confidence = min(95, 50 + votes['put'] * 30)
    
    return {
        'signal': signal,
        'confidence': confidence,
        'strategies': strategy_results,
        'vote_count': len([v for v in votes.values() if v > 0]),
        'votes': votes
    }
