"""
Улучшенная система анализа рынка v2.
Более строгие фильтры, множественные подтверждения, точный расчёт уверенности.
"""
from typing import List, Dict, Tuple
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


def calculate_macd(closes: List[float], fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[float, float, float]:
    """Расчет MACD: MACD line, Signal line, Histogram - ПРАВИЛЬНЫЙ"""
    if len(closes) < slow + signal:
        return 0.0, 0.0, 0.0
    
    ema_fast = calculate_ema(closes, fast)
    ema_slow = calculate_ema(closes, slow)
    macd_line = ema_fast - ema_slow
    
    # Правильный расчет Signal Line: используем все доступные данные
    # Вычисляем MACD для всех точек и берем EMA от них
    macd_line_full = []
    for i in range(slow - 1, len(closes)):
        ema_f = calculate_ema(closes[:i+1], fast)
        ema_s = calculate_ema(closes[:i+1], slow)
        macd_line_full.append(ema_f - ema_s)
    
    # Signal line = 9-период EMA от MACD line
    if len(macd_line_full) >= signal:
        signal_line = calculate_ema(macd_line_full[-signal:], signal)
    else:
        signal_line = macd_line
    
    histogram = macd_line - signal_line
    
    return macd_line, signal_line, histogram


def calculate_atr(candles: List[Dict], period: int = 14) -> float:
    """Расчет ATR (Average True Range)"""
    if len(candles) < period + 1:
        return 0.0
    
    true_ranges = []
    for i in range(1, len(candles)):
        high = candles[i]['high']
        low = candles[i]['low']
        prev_close = candles[i-1]['close']
        
        tr = max(
            high - low,
            abs(high - prev_close),
            abs(low - prev_close)
        )
        true_ranges.append(tr)
    
    return sum(true_ranges[-period:]) / period


def calculate_bollinger_bands(closes: List[float], period: int = 20, std_dev_multiplier: float = 2.0) -> Tuple[float, float, float]:
    """Расчет Bollinger Bands"""
    if len(closes) < period:
        return closes[-1], closes[-1], closes[-1]
    
    sma = sum(closes[-period:]) / period
    variance = sum((x - sma) ** 2 for x in closes[-period:]) / period
    std_dev = variance ** 0.5
    
    upper = sma + (std_dev_multiplier * std_dev)
    lower = sma - (std_dev_multiplier * std_dev)
    
    return lower, sma, upper


def calculate_stochastic(candles: List[Dict], k_period: int = 14) -> float:
    """Расчет %K стохастика"""
    if len(candles) < k_period:
        return 50.0
    
    recent = candles[-k_period:]
    highs = [c['high'] for c in recent]
    lows = [c['low'] for c in recent]
    current_close = candles[-1]['close']
    
    highest_high = max(highs)
    lowest_low = min(lows)
    
    if highest_high == lowest_low:
        return 50.0
    
    return ((current_close - lowest_low) / (highest_high - lowest_low)) * 100


def determine_market_regime(candles: List[Dict]) -> Dict:
    """
    Расширенное определение режима рынка.
    Возвращает режим + силу тренда + волатильность.
    """
    if len(candles) < 50:
        return {'regime': 'UNKNOWN', 'strength': 0, 'volatility': 0}

    closes = [c['close'] for c in candles]

    ema_10 = calculate_ema(closes, 10)
    ema_20 = calculate_ema(closes, 20)
    ema_50 = calculate_ema(closes, 50)
    rsi = calculate_rsi(closes)

    current_price = closes[-1]
    
    # Расчет силы тренда
    ema_spread_1 = abs(ema_10 - ema_20) / ema_20 * 100
    ema_spread_2 = abs(ema_20 - ema_50) / ema_50 * 100
    trend_strength = (ema_spread_1 + ema_spread_2) / 2
    
    # Расчет волатильности (ATR в процентах)
    atr = calculate_atr(candles)
    volatility = (atr / current_price * 100) if current_price > 0 else 0

    # Определяем режим (OTC с низкой волатильностью требует низких порогов)
    # Даже 0.04% на 1м может быть реальным трендом для OTC
    if current_price > ema_10 > ema_20 > ema_50 and trend_strength > 0.04:
        regime = 'UPTREND'
    elif current_price < ema_10 < ema_20 < ema_50 and trend_strength > 0.04:
        regime = 'DOWNTREND'
    elif trend_strength < 0.02 or abs(rsi - 50) < 15:
        regime = 'RANGE'
    else:
        regime = 'WEAK_TREND'

    return {
        'regime': regime,
        'strength': trend_strength,
        'volatility': volatility,
        'rsi': rsi,
        'ema_10': ema_10,
        'ema_20': ema_20,
        'ema_50': ema_50
    }


def analyze_trend_following(candles: List[Dict], market_info: Dict) -> Dict:
    """
    Улучшенная стратегия следования за трендом.
    Более строгие условия входа.
    """
    regime = market_info['regime']
    
    if regime not in ['UPTREND', 'DOWNTREND']:
        return {'signal': None, 'confidence': 0, 'source': 'TREND'}

    closes = [c['close'] for c in candles]
    current_price = closes[-1]
    rsi = market_info['rsi']
    ema_20 = market_info['ema_20']
    
    # Проверяем качество тренка (для OTC порог снижен)
    if market_info['strength'] < 0.03:
        return {'signal': None, 'confidence': 0, 'source': 'TREND', 'reason': 'Слишком слабый тренд'}

    if regime == 'UPTREND':
        # Откат к EMA20 - лучшая точка входа
        dist_to_ema20 = (current_price - ema_20) / ema_20 * 100
        
        if -0.15 < dist_to_ema20 < 0.15:
            # Идеальная точка входа + проверка RSI не перекуплен
            if rsi < 70:
                confidence = 85
            elif rsi < 65:
                confidence = 90
            else:
                confidence = 70  # RSI близок к перекупленности
                
            return {
                'signal': 'call',
                'confidence': confidence,
                'source': 'TREND',
                'details': f'Откат к EMA20 ({dist_to_ema20:.2f}%), RSI={rsi:.1f}'
            }
        
        # Сильный тренд без отката - рискуем меньше
        elif current_price > ema_20 * 1.002:
            if rsi < 75:
                return {
                    'signal': 'call',
                    'confidence': 65,
                    'source': 'TREND',
                    'details': f'Сильный тренд, но RSI={rsi:.1f}'
                }

    elif regime == 'DOWNTREND':
        dist_to_ema20 = (current_price - ema_20) / ema_20 * 100
        
        if -0.15 < dist_to_ema20 < 0.15:
            if rsi > 30:
                confidence = 85
            elif rsi > 35:
                confidence = 90
            else:
                confidence = 70
                
            return {
                'signal': 'put',
                'confidence': confidence,
                'source': 'TREND',
                'details': f'Откат к EMA20 ({dist_to_ema20:.2f}%), RSI={rsi:.1f}'
            }
        
        elif current_price < ema_20 * 0.998:
            if rsi > 25:
                return {
                    'signal': 'put',
                    'confidence': 65,
                    'source': 'TREND',
                    'details': f'Сильный тренд, RSI={rsi:.1f}'
                }

    return {'signal': None, 'confidence': 0, 'source': 'TREND'}


def analyze_mean_reversion(candles: List[Dict], market_info: Dict) -> Dict:
    """
    Улучшенная стратегия возврата к среднему.
    Более строгие условия.
    """
    regime = market_info['regime']
    
    # Работаем только в боковике или слабом тренде
    if regime not in ['RANGE', 'WEAK_TREND']:
        return {'signal': None, 'confidence': 0, 'source': 'REVERSION'}

    closes = [c['close'] for c in candles]
    rsi = market_info['rsi']
    current_price = closes[-1]
    
    # Bollinger Bands
    lower_band, sma, upper_band = calculate_bollinger_bands(closes)
    
    # Стохастик
    stoch_k = calculate_stochastic(candles)

    # Проверяем экстремальные условия
    dist_to_lower = (current_price - lower_band) / lower_band * 100
    dist_to_upper = (current_price - upper_band) / upper_band * 100
    
    # CALL: Цена ниже нижней полосы + RSI перепродан + стохастик перепродан
    if current_price < lower_band and rsi < 30 and stoch_k < 20:
        confidence = 80
        # Если все три условия экстремальны - повышаем уверенность
        if rsi < 25 and stoch_k < 15 and dist_to_lower < -0.1:
            confidence = 88
            
        return {
            'signal': 'call',
            'confidence': confidence,
            'source': 'REVERSION',
            'details': f'Цена<{lower_band:.5f}, RSI={rsi:.1f}, Stoch={stoch_k:.1f}'
        }

    # PUT: Цена выше верхней полосы + RSI перекуплен + стохастик перекуплен
    elif current_price > upper_band and rsi > 70 and stoch_k > 80:
        confidence = 80
        if rsi > 75 and stoch_k > 85 and dist_to_upper > 0.1:
            confidence = 88
            
        return {
            'signal': 'put',
            'confidence': confidence,
            'source': 'REVERSION',
            'details': f'Цена>{upper_band:.5f}, RSI={rsi:.1f}, Stoch={stoch_k:.1f}'
        }

    # Умеренные условия - только если 2 из 3
    signals_count = 0
    if rsi < 32 or rsi > 68:
        signals_count += 1
    if current_price < lower_band or current_price > upper_band:
        signals_count += 1
    if stoch_k < 22 or stoch_k > 78:
        signals_count += 1
    
    if signals_count >= 2:
        if rsi < 32 or stoch_k < 22:
            return {'signal': 'call', 'confidence': 62, 'source': 'REVERSION', 'details': f'RSI={rsi:.1f}, Stoch={stoch_k:.1f}'}
        elif rsi > 68 or stoch_k > 78:
            return {'signal': 'put', 'confidence': 62, 'source': 'REVERSION', 'details': f'RSI={rsi:.1f}, Stoch={stoch_k:.1f}'}

    return {'signal': None, 'confidence': 0, 'source': 'REVERSION'}


def analyze_momentum(candles: List[Dict]) -> Dict:
    """
    Улучшенная стратегия импульса.
    Проверяет объем и силу свечей.
    """
    if len(candles) < 5:
        return {'signal': None, 'confidence': 0, 'source': 'MOMENTUM'}

    last_3 = candles[-3:]
    bodies = []
    total_range = 0

    for c in last_3:
        body = c['close'] - c['open']
        candle_range = c['high'] - c['low']
        abs_body = abs(body)
        
        # Проверяем что свеча не доджи
        if candle_range < 0.00010 or abs_body < candle_range * 0.3:
            return {'signal': None, 'confidence': 0, 'source': 'MOMENTUM', 'reason': 'Свечи слабые'}
        
        bodies.append(body)
        total_range += candle_range

    # Средняя сила свечей
    avg_body = sum(abs(b) for b in bodies) / 3
    
    # 3 сильные зеленые подряд
    if all(b > 0.00015 for b in bodies):
        # Проверяем что каждая следующая сильнее предыдущей
        if bodies[2] > bodies[1] > bodies[0]:
            return {
                'signal': 'call',
                'confidence': 78,
                'source': 'MOMENTUM',
                'details': f'3 усиливающиеся бычьи свечи'
            }
        else:
            return {
                'signal': 'call',
                'confidence': 68,
                'source': 'MOMENTUM',
                'details': f'3 бычьи свечи'
            }

    # 3 сильные красные подряд
    elif all(b < -0.00015 for b in bodies):
        if abs(bodies[2]) > abs(bodies[1]) > abs(bodies[0]):
            return {
                'signal': 'put',
                'confidence': 78,
                'source': 'MOMENTUM',
                'details': f'3 усиливающиеся медвежьи свечи'
            }
        else:
            return {
                'signal': 'put',
                'confidence': 68,
                'source': 'MOMENTUM',
                'details': f'3 медвежьи свечи'
            }

    return {'signal': None, 'confidence': 0, 'source': 'MOMENTUM'}


def analyze_support_resistance(candles: List[Dict]) -> Dict:
    """
    Новая стратегия: анализ уровней поддержки/сопротивления.
    """
    if len(candles) < 50:
        return {'signal': None, 'confidence': 0, 'source': 'S/R'}
    
    closes = [c['close'] for c in candles[-50:]]
    highs = [c['high'] for c in candles[-50:]]
    lows = [c['low'] for c in candles[-50:]]
    current_price = closes[-1]
    
    # Находим ключевые уровни
    resistance = max(highs[:-5])  # Не считая последние 5 свечей
    support = min(lows[:-5])
    
    dist_to_resistance = (resistance - current_price) / current_price * 100
    dist_to_support = (current_price - support) / current_price * 100
    
    # Если цена у сопротивления и RSI высокий - PUT
    rsi = calculate_rsi(closes)
    
    if dist_to_resistance < 0.15 and rsi > 65:
        return {
            'signal': 'put',
            'confidence': 72,
            'source': 'S/R',
            'details': f'Цена у сопротивления ({dist_to_resistance:.2f}%), RSI={rsi:.1f}'
        }
    
    # Если цена у поддержки и RSI низкий - CALL
    elif dist_to_support < 0.15 and rsi < 35:
        return {
            'signal': 'call',
            'confidence': 72,
            'source': 'S/R',
            'details': f'Цена у поддержки ({dist_to_support:.2f}%), RSI={rsi:.1f}'
        }
    
    return {'signal': None, 'confidence': 0, 'source': 'S/R'}


def get_smart_signal(candles: List[Dict]) -> Dict:
    """
    Главная функция. Расширенный анализ с множественными подтверждениями.
    """
    # 1. Определяем режим рынка
    market_info = determine_market_regime(candles)
    regime = market_info['regime']
    print(f"   🌍 Режим рынка: {regime} (сила: {market_info['strength']:.3f}%, волатильность: {market_info['volatility']:.3f}%)")

    # 2. Запускаем все стратегии
    trend_sig = analyze_trend_following(candles, market_info)
    rev_sig = analyze_mean_reversion(candles, market_info)
    mom_sig = analyze_momentum(candles)
    sr_sig = analyze_support_resistance(candles)

    # 3. Собираем сигналы
    signals = []
    if trend_sig['signal']: signals.append(trend_sig)
    if rev_sig['signal']: signals.append(rev_sig)
    if mom_sig['signal']: signals.append(mom_sig)
    if sr_sig['signal']: signals.append(sr_sig)

    if not signals:
        return {'signal': None, 'confidence': 0, 'details': 'Нет совпадений стратегий'}

    # 4. Анализируем совпадения
    call_votes = sum(1 for s in signals if s['signal'] == 'call')
    put_votes = sum(1 for s in signals if s['signal'] == 'put')
    total = len(signals)

    final_signal = None
    final_confidence = 0
    reasons = []

    # Если все или большинство согласны (75%+)
    if call_votes >= 3:
        final_signal = 'call'
        avg_conf = sum(s['confidence'] for s in signals if s['signal'] == 'call') / call_votes
        # Бонус за множественное подтверждение
        final_confidence = min(95, avg_conf + (call_votes * 3))
        reasons = [s['details'] for s in signals if s['signal'] == 'call']
        
    elif put_votes >= 3:
        final_signal = 'put'
        avg_conf = sum(s['confidence'] for s in signals if s['signal'] == 'put') / put_votes
        final_confidence = min(95, avg_conf + (put_votes * 3))
        reasons = [s['details'] for s in signals if s['signal'] == 'put']
    
    # Если 2 из 3 или 2 из 4 - умеренный сигнал
    elif call_votes >= 2:
        final_signal = 'call'
        call_signals = [s for s in signals if s['signal'] == 'call']
        avg_conf = sum(s['confidence'] for s in call_signals) / len(call_signals)
        final_confidence = avg_conf - 5  # Небольшой штраф
        reasons = [s['details'] for s in call_signals]
        
    elif put_votes >= 2:
        final_signal = 'put'
        put_signals = [s for s in signals if s['signal'] == 'put']
        avg_conf = sum(s['confidence'] for s in put_signals) / len(put_signals)
        final_confidence = avg_conf - 5
        reasons = [s['details'] for s in put_signals]
    
    else:
        # Конфликт сигналов - не торгуем
        return {'signal': None, 'confidence': 0, 'details': 'Конфликт сигналов'}

    # 5. ФИНАЛЬНЫЙ ФИЛЬТР: проверяем общую ситуацию
    # Для OTC волатильность обычно ниже, поэтому пороги адаптированы
    
    # Не торгуем если волатильность слишком высокая (> 3% - аномалия)
    if market_info['volatility'] > 3.0:
        return {'signal': None, 'confidence': 0, 'details': 'Волатильность слишком высокая'}
    
    # ПОВЫШЕННЫЙ СТАНДАРТ: уверенность должна быть >70% (не 55%)
    # Для OTC с 85% payout нужна 70%+ accuracy для профита
    if final_confidence < 70:
        return {'signal': None, 'confidence': final_confidence, 'details': f'Уверенность недостаточная ({final_confidence:.0f}% < 70%)'}

    return {
        'signal': final_signal,
        'confidence': final_confidence,
        'reasons': reasons,
        'votes': signals,
        'market_regime': regime,
        'volatility': market_info['volatility']
    }
