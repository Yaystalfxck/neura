"""
Умная система анализа рынка.
Адаптивно выбирает стратегии в зависимости от типа рынка (Тренд или Боковик).
"""
from typing import List, Dict
import numpy as np


def calculate_rsi(closes: List[float], period: int = 14) -> float:
    """Расчет RSI"""
    if len(closes) < period + 1:
        return 50.0
    
    deltas = [closes[i] - closes[i-1] for i in range(1, len(closes))]
    gains = [d if d > 0 else 0 for d in deltas[-period:]]
    losses = [-d if d < 0 else 0 for d in deltas[-period:]]
    
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    
    if avg_loss == 0:
        return 100.0
    
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def calculate_ema(data: List[float], period: int) -> float:
    """Расчет EMA для последней точки"""
    if len(data) < period:
        return data[-1] if data else 0
    
    multiplier = 2 / (period + 1)
    ema = sum(data[:period]) / period
    
    for price in data[period:]:
        ema = (price - ema) * multiplier + ema
    
    return ema


def determine_market_regime(candles: List[Dict]) -> str:
    """
    Определяет текущий режим рынка: TREND или RANGE.
    
    TREND: Цена четко идет вверх или вниз (EMA10 > EMA20 > EMA50)
    RANGE: Цена ходит боком (EMA переплетены, RSI около 50)
    """
    if len(candles) < 50:
        return 'UNKNOWN'
    
    closes = [c['close'] for c in candles]
    
    ema_10 = calculate_ema(closes, 10)
    ema_20 = calculate_ema(closes, 20)
    ema_50 = calculate_ema(closes, 50)
    rsi = calculate_rsi(closes)
    
    current_price = closes[-1]
    
    # Бычий тренд
    if current_price > ema_10 > ema_20 > ema_50:
        return 'UPTREND'
    
    # Медвежий тренд
    if current_price < ema_10 < ema_20 < ema_50:
        return 'DOWNTREND'
    
    # Боковик
    return 'RANGE'


def analyze_trend_following(candles: List[Dict], regime: str) -> Dict:
    """
    Стратегия следования за трендом.
    Работает ТОЛЬКО в режиме TREND.
    """
    if regime not in ['UPTREND', 'DOWNTREND']:
        return {'signal': None, 'confidence': 0, 'source': 'TREND'}

    closes = [c['close'] for c in candles]
    ema_10 = calculate_ema(closes, 10)
    ema_20 = calculate_ema(closes, 20)
    current_price = closes[-1]
    
    # Проверяем откат к EMA (лучшая точка входа)
    # В UPTREND: ждем пока цена коснется EMA10 или EMA20 и пойдет вверх
    # В DOWNTREND: ждем пока цена коснется EMA10 или EMA20 и пойдет вниз
    
    if regime == 'UPTREND':
        # Если цена чуть выше EMA20 - это хороший вход
        if ema_20 * 1.0005 > current_price > ema_20 * 0.9995:
            return {
                'signal': 'call',
                'confidence': 80,
                'source': 'TREND',
                'details': 'Откат к EMA20 в восходящем тренде'
            }
        # Если тренд очень сильный
        elif current_price > ema_10:
            return {
                'signal': 'call',
                'confidence': 65,
                'source': 'TREND',
                'details': 'Сильный восходящий тренд'
            }
            
    elif regime == 'DOWNTREND':
        # Если цена чуть ниже EMA20 - это хороший вход
        if ema_20 * 1.0005 > current_price > ema_20 * 0.9995:
            return {
                'signal': 'put',
                'confidence': 80,
                'source': 'TREND',
                'details': 'Откат к EMA20 в нисходящем тренде'
            }
        # Если тренд очень сильный
        elif current_price < ema_10:
            return {
                'signal': 'put',
                'confidence': 65,
                'source': 'TREND',
                'details': 'Сильный нисходящий тренд'
            }

    return {'signal': None, 'confidence': 0, 'source': 'TREND'}


def analyze_mean_reversion(candles: List[Dict], regime: str) -> Dict:
    """
    Стратегия возврата к среднему.
    Работает ТОЛЬКО в режиме RANGE.
    """
    if regime != 'RANGE':
        return {'signal': None, 'confidence': 0, 'source': 'REVERSION'}
    
    closes = [c['close'] for c in candles]
    rsi = calculate_rsi(closes)
    current_price = closes[-1]
    
    # Bollinger Bands
    sma = sum(closes[-20:]) / 20
    std_dev = (sum((x - sma) ** 2 for x in closes[-20:]) / 20) ** 0.5
    upper_band = sma + (2 * std_dev)
    lower_band = sma - (2 * std_dev)
    
    # RSI перепродан + Цена у нижней полосы -> CALL (Отскок вверх)
    if rsi < 30 and current_price < lower_band:
        return {
            'signal': 'call',
            'confidence': 75,
            'source': 'REVERSION',
            'details': f'RSI={rsi:.1f} + Цена ниже BB ({current_price:.5f} < {lower_band:.5f})'
        }
    
    # RSI перекуплен + Цена у верхней полосы -> PUT (Отскок вниз)
    elif rsi > 70 and current_price > upper_band:
        return {
            'signal': 'put',
            'confidence': 75,
            'source': 'REVERSION',
            'details': f'RSI={rsi:.1f} + Цена выше BB ({current_price:.5f} > {upper_band:.5f})'
        }
        
    # Просто RSI экстремальный
    elif rsi < 25:
        return {'signal': 'call', 'confidence': 65, 'source': 'REVERSION', 'details': f'RSI={rsi:.1f}'}
    elif rsi > 75:
        return {'signal': 'put', 'confidence': 65, 'source': 'REVERSION', 'details': f'RSI={rsi:.1f}'}

    return {'signal': None, 'confidence': 0, 'source': 'REVERSION'}


def analyze_momentum(candles: List[Dict]) -> Dict:
    """
    Стратегия импульса (универсальная).
    Ищет 3 сильные свечи подряд.
    """
    if len(candles) < 4:
        return {'signal': None, 'confidence': 0, 'source': 'MOMENTUM'}
    
    last_3 = candles[-3:]
    bodies = []
    
    for c in last_3:
        body = c['close'] - c['open']
        abs_body = abs(body)
        # Проверяем, что свеча не доджи
        if abs_body < 0.00005: 
            return {'signal': None, 'confidence': 0, 'source': 'MOMENTUM'} 
        bodies.append(body)

    # 3 сильные зеленые подряд
    if all(b > 0.00010 for b in bodies):
        return {
            'signal': 'call',
            'confidence': 70,
            'source': 'MOMENTUM',
            'details': '3 Strong Bullish Candles'
        }
    
    # 3 сильные красные подряд
    elif all(b < -0.00010 for b in bodies):
        return {
            'signal': 'put',
            'confidence': 70,
            'source': 'MOMENTUM',
            'details': '3 Strong Bearish Candles'
        }

    return {'signal': None, 'confidence': 0, 'source': 'MOMENTUM'}


def get_smart_signal(candles: List[Dict]) -> Dict:
    """
    Главная функция. Адаптивно выбирает лучшую стратегию.
    """
    # 1. Определяем режим
    regime = determine_market_regime(candles)
    print(f"   🌍 Режим рынка: {regime}")
    
    # 2. Запускаем стратегии, подходящие для этого режима
    trend_sig = analyze_trend_following(candles, regime)
    rev_sig = analyze_mean_reversion(candles, regime)
    mom_sig = analyze_momentum(candles)
    
    # 3. Собираем голоса
    signals = []
    if trend_sig['signal']: signals.append(trend_sig)
    if rev_sig['signal']: signals.append(rev_sig)
    if mom_sig['signal']: signals.append(mom_sig)
    
    if not signals:
        return {'signal': None, 'confidence': 0, 'details': 'Нет совпадений'}
    
    # Ищем совпадения
    call_votes = sum(1 for s in signals if s['signal'] == 'call')
    put_votes = sum(1 for s in signals if s['signal'] == 'put')
    
    final_signal = None
    final_confidence = 0
    
    # Если все согласны
    if call_votes == len(signals):
        final_signal = 'call'
        final_confidence = max(s['confidence'] for s in signals) + (5 * len(signals))
    elif put_votes == len(signals):
        final_signal = 'put'
        final_confidence = max(s['confidence'] for s in signals) + (5 * len(signals))
    else:
        # Конфликт - берем самый уверенный
        best = max(signals, key=lambda x: x['confidence'])
        final_signal = best['signal']
        final_confidence = best['confidence'] - 15 # Штраф за конфликт

    return {
        'signal': final_signal,
        'confidence': final_confidence,
        'votes': signals
    }
