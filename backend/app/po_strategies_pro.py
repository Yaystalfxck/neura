"""
Профессиональные торговые стратегии для глубокого анализа рынка.
Включает Price Action, Ichimoku, Fibonacci, Breakout и Smart Money концепции.
"""
from typing import List, Dict
import numpy as np


def analyze_ichimoku_cloud(candles: List[Dict]) -> Dict:
    """
    Анализ облака Ишимоку.
    Логика: Определяет тренд и ключевые уровни поддержки/сопротивления.
    """
    if len(candles) < 52: # Нужно минимум 52 свечи для полного расчета
        return {'signal': None, 'confidence': 0, 'source': 'ICHIMOKU', 'details': 'Недостаточно данных'}

    highs = [c['high'] for c in candles]
    lows = [c['low'] for c in candles]
    closes = [c['close'] for c in candles]

    # Расчет линий (упрощенный)
    def donchian(period):
        return (max(highs[-period:]) + min(lows[-period:])) / 2

    tenkan = donchian(9)
    kijun = donchian(26)
    senkou_b = donchian(52)
    current_price = closes[-1]

    signal = None
    confidence = 0

    # Бычий сигнал: Цена > Облако (Kijun > Senkou B) и Tenkan > Kijun
    if current_price > kijun and kijun > senkou_b:
        signal = 'call'
        confidence = 60
        if tenkan > kijun:
            confidence += 15 # Дополнительное подтверждение
        print(f"   ☁️ Ишимоку: Бычье облако (Conf: {confidence}%)")
    
    # Медвежий сигнал: Цена < Облака
    elif current_price < kijun and kijun < senkou_b:
        signal = 'put'
        confidence = 60
        if tenkan < kijun:
            confidence += 15
        print(f"   ☁️ Ишимоку: Медвежье облако (Conf: {confidence}%)")

    return {
        'signal': signal,
        'confidence': confidence,
        'source': 'ICHIMOKU',
        'details': f"Price={current_price:.5f}, Kijun={kijun:.5f}"
    }


def analyze_fibonacci_levels(candles: List[Dict]) -> Dict:
    """
    Анализ уровней Фибоначчи.
    Логика: Если цена подошла к ключевому уровню (0.618), ждем отскок.
    """
    if len(candles) < 50:
        return {'signal': None, 'confidence': 0, 'source': 'FIBONACCI', 'details': 'Недостаточно данных'}

    # Находим локальный мин/макс за последние 50 свечей
    highs = [c['high'] for c in candles[-50:]]
    lows = [c['low'] for c in candles[-50:]]
    
    swing_high = max(highs)
    swing_low = min(lows)
    diff = swing_high - swing_low
    
    # Ключевые уровни
    fib_618 = swing_high - (diff * 0.618)
    fib_382 = swing_high - (diff * 0.382)
    
    current_price = candles[-1]['close']
    
    # Проверяем близость к уровням (погрешность 0.1%)
    tolerance = diff * 0.001

    signal = None
    confidence = 0

    # Отскок от 0.618 снизу вверх (CALL)
    if abs(current_price - fib_618) < tolerance:
        signal = 'call'
        confidence = 70
        print(f"   📐 Фибоначчи: Уровень 0.618 ({fib_618:.5f}) - Отскок вверх?")
    # Отскок от 0.382 (Продолжение тренда вниз - PUT)
    elif abs(current_price - fib_382) < tolerance:
        signal = 'put'
        confidence = 65
        print(f"   📐 Фибоначчи: Уровень 0.382 ({fib_382:.5f}) - Отскок вниз?")

    return {
        'signal': signal,
        'confidence': confidence,
        'source': 'FIBONACCI',
        'details': f"Current={current_price:.5f}, 0.618={fib_618:.5f}"
    }


def analyze_breakout_levels(candles: List[Dict]) -> Dict:
    """
    Стратегия пробоя уровней (Breakout).
    Логика: Если цена пробила сильный уровень сопротивления/поддержки на высоком импульсе.
    """
    if len(candles) < 20:
        return {'signal': None, 'confidence': 0, 'source': 'BREAKOUT', 'details': 'Недостаточно данных'}

    # Определяем максимум/минимум за 20 свечей
    highs = [c['high'] for c in candles[-20:]]
    lows = [c['low'] for c in candles[-20:]]
    
    resistance = max(highs[:-1]) # Исключая текущую свечу
    support = min(lows[:-1])
    
    current_candle = candles[-1]
    current_close = current_candle['close']
    
    # Сила пробоя (насколько тело свечи вышло за уровень)
    body_size = abs(current_close - current_candle['open'])

    signal = None
    confidence = 0

    # Пробой сопротивления (CALL)
    if current_close > resistance and body_size > 0.00010:
        signal = 'call'
        confidence = 75
        print(f"   🚀 Пробой: Сопротивление {resistance:.5f} пробито!")
    
    # Пробой поддержки (PUT)
    elif current_close < support and body_size > 0.00010:
        signal = 'put'
        confidence = 75
        print(f"   📉 Пробой: Поддержка {support:.5f} пробита!")

    return {
        'signal': signal,
        'confidence': confidence,
        'source': 'BREAKOUT',
        'details': f"Close={current_close:.5f}, Res={resistance:.5f}"
    }


def analyze_smart_money(candles: List[Dict]) -> Dict:
    """
    Анализ действий "Умных денег" (Smart Money).
    Логика: Ищем аномальные движения цены (манипуляции) перед разворотом.
    """
    if len(candles) < 10:
        return {'signal': None, 'confidence': 0, 'source': 'SMART_MONEY', 'details': 'Недостаточно данных'}

    # Считаем средний размер тела свечи
    bodies = [abs(c['close'] - c['open']) for c in candles[:-1]]
    avg_body = sum(bodies) / len(bodies)
    
    # Текущая свеча
    current = candles[-1]
    curr_body = abs(current['close'] - current['open'])
    
    # Тень сверху и снизу
    upper_shadow = current['high'] - max(current['open'], current['close'])
    lower_shadow = min(current['open'], current['close']) - current['low']

    signal = None
    confidence = 0

    # Pin Bar (маленькое тело, длинная тень) - знак разворота
    if curr_body < avg_body * 0.5:
        # Медвежий Pin Bar (длинная верхняя тень) -> PUT
        if upper_shadow > curr_body * 2 and upper_shadow > 0.00015:
            signal = 'put'
            confidence = 70
            print(f"   💰 Smart Money: Медвежий Pin Bar (Разворот вниз)")
        # Бычий Pin Bar (длинная нижняя тень) -> CALL
        elif lower_shadow > curr_body * 2 and lower_shadow > 0.00015:
            signal = 'call'
            confidence = 70
            print(f"   💰 Smart Money: Бычий Pin Bar (Разворот вверх)")

    return {
        'signal': signal,
        'confidence': confidence,
        'source': 'SMART_MONEY',
        'details': f"Body={curr_body:.5f}, Avg={avg_body:.5f}"
    }


def get_pro_strategies_consensus(candles: List[Dict]) -> Dict:
    """
    Запускает все профессиональные стратегии и ищет согласие.
    """
    ichi = analyze_ichimoku_cloud(candles)
    fib = analyze_fibonacci_levels(candles)
    breakout = analyze_breakout_levels(candles)
    sm = analyze_smart_money(candles)

    strategies = [ichi, fib, breakout, sm]
    
    call_votes = 0
    put_votes = 0
    max_conf = 0

    for s in strategies:
        if s['signal'] == 'call':
            call_votes += 1
            max_conf = max(max_conf, s['confidence'])
        elif s['signal'] == 'put':
            put_votes += 1
            max_conf = max(max_conf, s['confidence'])

    final_signal = None
    final_confidence = 0

    # Если большинство согласны (2+ из 4)
    if call_votes >= 2:
        final_signal = 'call'
        final_confidence = max_conf + (5 * call_votes)
    elif put_votes >= 2:
        final_signal = 'put'
        final_confidence = max_conf + (5 * put_votes)

    return {
        'signal': final_signal,
        'confidence': final_confidence,
        'call_votes': call_votes,
        'put_votes': put_votes,
        'strategies': {
            'Ichimoku': ichi,
            'Fibonacci': fib,
            'Breakout': breakout,
            'SmartMoney': sm
        }
    }
