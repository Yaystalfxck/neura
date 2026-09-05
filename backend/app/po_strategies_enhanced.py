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
        min_low = min(lows)
        if min_low == 0:
            min_low = 1  # Prevent division by zero
        range_size = (max(highs) - min(lows)) / min_low * 100
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
    total_avg = sum(r['range'] for r in ranges) / len(ranges) if len(ranges) > 0 else 1
    
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


def evaluate_entry_points(candles: List[Dict], signal_type: str, sr_levels: Dict) -> Dict:
    """
    Оценка точки входа для сигнала
    
    Args:
        candles: Последние свечи
        signal_type: 'call' или 'put'
        sr_levels: Уровни поддержки/сопротивления
    
    Returns:
        Dict с оценкой точки входа
    """
    if not candles or len(candles) < 10:
        return {'score': 0, 'is_good_entry': False, 'reason': 'Недостаточно данных'}

    closes = [c.get('close', 0) for c in candles]
    current_price = closes[-1]
    
    # 1. Оценка расстояния до уровней S/R
    sr_score = 0
    sr_reason = ""
    
    if sr_levels.get('nearest_support') and sr_levels.get('nearest_resistance'):
        dist_to_support = sr_levels['nearest_support']['distance_pct']
        dist_to_resistance = sr_levels['nearest_resistance']['distance_pct']
        
        if signal_type == 'call':
            # Для CALL хорошо быть близко к поддержке
            if dist_to_support < 0.5:
                sr_score = 30
                sr_reason = f"Цена у поддержки ({dist_to_support:.2f}%)"
            elif dist_to_support < 0.8:
                sr_score = 20
                sr_reason = f"Цена близко к поддержке ({dist_to_support:.2f}%)"
            else:
                sr_score = 10
                sr_reason = f"Цена далеко от поддержки ({dist_to_support:.2f}%)"
        else:  # put
            # Для PUT хорошо быть близко к сопротивлению
            if dist_to_resistance < 0.5:
                sr_score = 30
                sr_reason = f"Цена у сопротивления ({dist_to_resistance:.2f}%)"
            elif dist_to_resistance < 0.8:
                sr_score = 20
                sr_reason = f"Цена близко к сопротивлению ({dist_to_resistance:.2f}%)"
            else:
                sr_score = 10
                sr_reason = f"Цена далеко от сопротивления ({dist_to_resistance:.2f}%)"

    # 2. Оценка тренда (последние 5 свечей)
    trend_score = 0
    trend_reason = ""
    
    last_5_closes = closes[-5:]
    if len(last_5_closes) >= 5:
        up_count = sum(1 for i in range(1, len(last_5_closes)) if last_5_closes[i] > last_5_closes[i-1])
        
        if signal_type == 'call':
            if up_count >= 4:  # 4 из 4 восходящих
                trend_score = 25
                trend_reason = "Сильный восходящий тренд"
            elif up_count >= 3:
                trend_score = 15
                trend_reason = "Восходящий тренд"
            elif up_count >= 2:
                trend_score = 10
                trend_reason = "Умеренный восходящий тренд"
            else:
                trend_score = 5
                trend_reason = "Слабый/нисходящий тренд"
        else:  # put
            down_count = 5 - up_count
            if down_count >= 4:
                trend_score = 25
                trend_reason = "Сильный нисходящий тренд"
            elif down_count >= 3:
                trend_score = 15
                trend_reason = "Нисходящий тренд"
            elif down_count >= 2:
                trend_score = 10
                trend_reason = "Умеренный нисходящий тренд"
            else:
                trend_score = 5
                trend_reason = "Слабый/восходящий тренд"

    # 3. Оценка моментума (последние 3 свечи)
    momentum_score = 0
    momentum_reason = ""
    
    if len(candles) >= 3:
        last_3 = candles[-3:]
        closes_3 = [c.get('close', 0) for c in last_3]
        
        if signal_type == 'call':
            if closes_3[2] > closes_3[1] > closes_3[0]:
                momentum_score = 20
                momentum_reason = "3 свечи вверх подряд"
            elif closes_3[2] > closes_3[1]:
                momentum_score = 10
                momentum_reason = "Последние 2 свечи вверх"
            else:
                momentum_score = 5
                momentum_reason = "Слабый восходящий моментум"
        else:  # put
            if closes_3[2] < closes_3[1] < closes_3[0]:
                momentum_score = 20
                momentum_reason = "3 свечи вниз подряд"
            elif closes_3[2] < closes_3[1]:
                momentum_score = 10
                momentum_reason = "Последние 2 свечи вниз"
            else:
                momentum_score = 5
                momentum_reason = "Слабый нисходящий моментум"

    # 4. Оценка RSI
    rsi_score = 0
    rsi_reason = ""
    
    # Расчет RSI
    deltas = [closes[i] - closes[i-1] for i in range(1, len(closes))]
    gains = [d if d > 0 else 0 for d in deltas[-14:]]
    losses = [-d if d < 0 else 0 for d in deltas[-14:]]
    
    if len(gains) >= 14 and len(losses) >= 14:
        avg_gain = sum(gains) / 14
        avg_loss = sum(losses) / 14
        rs = avg_gain / avg_loss if avg_loss > 0 else 100
        rsi = 100 - (100 / (1 + rs))
        
        if signal_type == 'call':
            if rsi < 30:
                rsi_score = 25
                rsi_reason = f"RSI перепродан ({rsi:.0f}) - хороший вход"
            elif rsi < 40:
                rsi_score = 15
                rsi_reason = f"RSI близко к перепроданности ({rsi:.0f})"
            elif rsi > 70:
                rsi_score = -10
                rsi_reason = f"RSI перекуплен ({rsi:.0f}) - плохой вход"
            else:
                rsi_score = 10
                rsi_reason = f"RSI нейтрален ({rsi:.0f})"
        else:  # put
            if rsi > 70:
                rsi_score = 25
                rsi_reason = f"RSI перекуплен ({rsi:.0f}) - хороший вход"
            elif rsi > 60:
                rsi_score = 15
                rsi_reason = f"RSI близко к перекупленности ({rsi:.0f})"
            elif rsi < 30:
                rsi_score = -10
                rsi_reason = f"RSI перепродан ({rsi:.0f}) - плохой вход"
            else:
                rsi_score = 10
                rsi_reason = f"RSI нейтрален ({rsi:.0f})"
    else:
        rsi_score = 10
        rsi_reason = "Недостаточно данных для RSI"

    # Итоговая оценка
    total_score = sr_score + trend_score + momentum_score + rsi_score
    max_possible = 100  # 30+25+20+25
    
    # Хорошая точка входа если score > 60%
    is_good_entry = total_score >= 60
    
    reasons = [sr_reason, trend_reason, momentum_reason, rsi_reason]
    
    return {
        'score': total_score,
        'max_score': max_possible,
        'percentage': (total_score / max_possible) * 100,
        'is_good_entry': is_good_entry,
        'components': {
            'support_resistance': sr_score,
            'trend': trend_score,
            'momentum': momentum_score,
            'rsi': rsi_score
        },
        'reasons': reasons,
        'reason': " | ".join(reasons)
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
    if trend['trend'] == 'bullish':
        votes['call'] += trend['strength'] / 100
    elif trend['trend'] == 'bearish':
        votes['put'] += trend['strength'] / 100
        
    if trend['trend'] != 'neutral':
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
