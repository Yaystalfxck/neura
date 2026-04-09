"""
Продвинутые торговые стратегии
Технические индикаторы и машинное обучение
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
import math


def calculate_rsi(prices: List[float], period: int = 14) -> float:
    """Расчет RSI (Relative Strength Index)"""
    if len(prices) < period + 1:
        return 50.0
    
    gains = []
    losses = []
    
    for i in range(1, len(prices)):
        change = prices[i] - prices[i-1]
        if change > 0:
            gains.append(change)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(abs(change))
    
    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period
    
    if avg_loss == 0:
        return 100.0
    
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def calculate_ema(prices: List[float], period: int) -> float:
    """Расчет EMA (Exponential Moving Average)"""
    if len(prices) < period:
        return prices[-1] if prices else 0
    
    multiplier = 2 / (period + 1)
    ema = sum(prices[:period]) / period
    
    for price in prices[period:]:
        ema = (price - ema) * multiplier + ema
    
    return ema


def calculate_macd(prices: List[float]) -> Dict:
    """Расчет MACD (Moving Average Convergence Divergence)"""
    if len(prices) < 26:
        return {
            'macd_line': 0,
            'signal_line': 0,
            'histogram': 0,
            'direction': 'neutral'
        }
    
    ema12 = calculate_ema(prices, 12)
    ema26 = calculate_ema(prices, 26)
    macd_line = ema12 - ema26
    
    # Расчет signal line
    macd_values = []
    for i in range(12, len(prices)):
        e12 = calculate_ema(prices[:i], 12)
        e26 = calculate_ema(prices[:i], 26)
        macd_values.append(e12 - e26)
    
    signal_line = calculate_ema(macd_values, 9) if len(macd_values) >= 9 else 0
    histogram = macd_line - signal_line
    
    direction = 'bullish' if histogram > 0 else 'bearish' if histogram < 0 else 'neutral'
    
    return {
        'macd_line': macd_line,
        'signal_line': signal_line,
        'histogram': histogram,
        'direction': direction
    }


def calculate_bollinger_bands(prices: List[float], period: int = 20, std_dev: float = 2) -> Dict:
    """Расчет Bollinger Bands"""
    if len(prices) < period:
        return {
            'upper': prices[-1] if prices else 0,
            'middle': prices[-1] if prices else 0,
            'lower': prices[-1] if prices else 0,
            'position': 0.5,
            'width': 0
        }
    
    sma = sum(prices[-period:]) / period
    variance = sum((p - sma) ** 2 for p in prices[-period:]) / period
    std = math.sqrt(variance)
    
    upper = sma + (std_dev * std)
    lower = sma - (std_dev * std)
    
    current_price = prices[-1]
    position = (current_price - lower) / (upper - lower) if upper != lower else 0.5
    width = ((upper - lower) / sma) * 100
    
    return {
        'upper': upper,
        'middle': sma,
        'lower': lower,
        'position': position,
        'width': width
    }


def calculate_atr(highs: List[float], lows: List[float], closes: List[float], period: int = 14) -> float:
    """Расчет ATR (Average True Range) - волатильность"""
    if len(highs) < period + 1:
        return 0
    
    tr_values = []
    for i in range(len(highs) - period, len(highs)):
        high_low = highs[i] - lows[i]
        high_prev = abs(highs[i] - closes[i-1]) if i > 0 else 0
        low_prev = abs(lows[i] - closes[i-1]) if i > 0 else 0
        tr = max(high_low, high_prev, low_prev)
        tr_values.append(tr)
    
    return sum(tr_values) / period if tr_values else 0


def calculate_volume_analysis(volumes: List[float]) -> Dict:
    """Анализ объема"""
    if not volumes or len(volumes) < 20:
        return {
            'avg_volume': 0,
            'current_volume': 0,
            'volume_ratio': 1,
            'trend': 'neutral'
        }
    
    avg_volume = sum(volumes[-20:]) / 20
    current_volume = volumes[-1]
    volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1
    
    trend = 'high' if volume_ratio > 1.5 else 'low' if volume_ratio < 0.8 else 'normal'
    
    return {
        'avg_volume': avg_volume,
        'current_volume': current_volume,
        'volume_ratio': volume_ratio,
        'trend': trend
    }


def advanced_signal_strategy(
    candles: List,
    asset: Dict,
    strategy_type: str = 'indicators'
) -> Optional[Dict]:
    """
    Продвинутая стратегия генерации сигналов
    Использует множественные индикаторы для точного анализа
    """
    if not candles or len(candles) < 50:
        return None
    
    # Извлекаем данные
    closes = []
    highs = []
    lows = []
    opens = []
    volumes = []
    
    for c in candles:
        if isinstance(c, dict):
            closes.append(c.get('close', 0))
            highs.append(c.get('high', 0))
            lows.append(c.get('low', 0))
            opens.append(c.get('open', 0))
            volumes.append(c.get('volume', 0))
        else:
            closes.append(getattr(c, 'close', 0))
            highs.append(getattr(c, 'high', 0))
            lows.append(getattr(c, 'low', 0))
            opens.append(getattr(c, 'open', 0))
            volumes.append(getattr(c, 'volume', 0))
    
    last_close = closes[-1]
    last_open = opens[-1]
    
    # === РАСЧЕТ ИНДИКАТОРОВ ===
    
    rsi = calculate_rsi(closes, 14)
    macd = calculate_macd(closes)
    bb = calculate_bollinger_bands(closes, 20, 2)
    sma20 = calculate_ema(closes, 20)
    sma50 = calculate_ema(closes, 50)
    atr = calculate_atr(highs, lows, closes, 14)
    volume_analysis = calculate_volume_analysis(volumes)
    
    volatility = (atr / last_close) * 100 if last_close > 0 else 0
    
    # === АНАЛИЗ СИГНАЛОВ ===
    
    bullish_signals = 0
    bearish_signals = 0
    confidence_factors = []
    
    # 1. RSI сигналы (вес: 25%)
    if rsi < 30:
        bullish_signals += 2
        confidence_factors.append(0.9)
    elif rsi < 40:
        bullish_signals += 1
        confidence_factors.append(0.7)
    elif rsi > 70:
        bearish_signals += 2
        confidence_factors.append(0.9)
    elif rsi > 60:
        bearish_signals += 1
        confidence_factors.append(0.7)
    
    # 2. MACD сигналы (вес: 25%)
    if macd['histogram'] > 0 and macd['macd_line'] > macd['signal_line']:
        bullish_signals += 2
        confidence_factors.append(0.85)
    elif macd['histogram'] < 0 and macd['macd_line'] < macd['signal_line']:
        bearish_signals += 2
        confidence_factors.append(0.85)
    
    # 3. Bollinger Bands (вес: 20%)
    if bb['position'] < 0.2:
        bullish_signals += 2
        confidence_factors.append(0.8)
    elif bb['position'] > 0.8:
        bearish_signals += 2
        confidence_factors.append(0.8)
    elif bb['position'] < 0.3:
        bullish_signals += 1
        confidence_factors.append(0.6)
    elif bb['position'] > 0.7:
        bearish_signals += 1
        confidence_factors.append(0.6)
    
    # 4. SMA тренд (вес: 15%)
    sma_trend = 'bullish' if sma20 > sma50 else 'bearish'
    if sma_trend == 'bullish':
        bullish_signals += 1
        confidence_factors.append(0.65)
    else:
        bearish_signals += 1
        confidence_factors.append(0.65)
    
    # 5. Объем (вес: 15%)
    if volume_analysis['volume_ratio'] > 1.5:
        if last_close > last_open:
            bullish_signals += 1
            confidence_factors.append(0.75)
        else:
            bearish_signals += 1
            confidence_factors.append(0.75)
    
    # === ОПРЕДЕЛЕНИЕ НАПРАВЛЕНИЯ ===
    
    total_signals = bullish_signals + bearish_signals
    
    if total_signals == 0:
        signal_type = "call" if last_close > last_open else "put"
        trend = "neutral"
        confidence = 50
    else:
        if bullish_signals > bearish_signals:
            signal_type = "call"
            trend = "bullish"
        elif bearish_signals > bullish_signals:
            signal_type = "put"
            trend = "bearish"
        else:
            signal_type = "call" if last_close > last_open else "put"
            trend = "neutral"
        
        # Расчет уверенности
        signal_diff = abs(bullish_signals - bearish_signals)
        signal_strength = (signal_diff / total_signals) * 30
        avg_confidence = sum(confidence_factors) / len(confidence_factors) if confidence_factors else 0.5
        confidence = min(95, 50 + (signal_strength * avg_confidence * 100))
    
    # === СИЛА СИГНАЛА ===
    
    if confidence > 75:
        strength = "strong"
    elif confidence > 60:
        strength = "medium"
    else:
        strength = "weak"
    
    # === ОПТИМАЛЬНАЯ ЭКСПИРАЦИЯ ===
    # Основной диапазон: 5 минут
    # 3 минуты только при высокой волатильности
    
    if volatility < 0.5:
        optimal_timeframe = 5  # Низкая волатильность - 5 мин
    elif volatility < 1.2:
        optimal_timeframe = 5  # Средняя волатильность - 5 мин (основной)
    elif volatility < 2.0:
        optimal_timeframe = 5  # Высокая волатильность - 5 мин
    else:
        optimal_timeframe = 3  # Очень высокая волатильность - 3 мин
    
    now = datetime.utcnow()
    
    return {
        "signal_type": signal_type,
        "strength": strength,
        "confidence": f"{int(confidence)}%",
        "current_price": float(last_close),
        "expiry_minutes": optimal_timeframe,
        "expiry_timestamp": (now + timedelta(minutes=optimal_timeframe)).isoformat(),
        "valid_until": (now + timedelta(seconds=30)).isoformat(),
        "pair_name": asset['name'],
        "trend": trend,
        "rsi": round(rsi, 2),
        "macd_direction": macd['direction'],
        "bb_position": "upper" if bb['position'] > 0.8 else "lower" if bb['position'] < 0.2 else "middle",
        "volatility": f"{volatility:.2f}%",
        "volume_ratio": f"{volume_analysis['volume_ratio']:.2f}",
        "pattern_detected": strategy_type,
        "payout": f"{asset['payout']}%",
        "db_strategy": "INDICATORS",
        "indicators": {
            "rsi": rsi,
            "rsi_signal": "oversold" if rsi < 30 else "overbought" if rsi > 70 else "neutral",
            "macd_line": macd['macd_line'],
            "macd_signal": macd['signal_line'],
            "macd_histogram": macd['histogram'],
            "macd_direction": macd['direction'],
            "bb_upper": bb['upper'],
            "bb_middle": bb['middle'],
            "bb_lower": bb['lower'],
            "bb_position": bb['position'],
            "bb_width": bb['width'],
            "sma20": sma20,
            "sma50": sma50,
            "sma_trend": sma_trend,
            "atr": atr,
            "volatility": volatility,
            "volume_ratio": volume_analysis['volume_ratio'],
            "volume_trend": volume_analysis['trend']
        },
        "analysis": {
            "bullish_signals": bullish_signals,
            "bearish_signals": bearish_signals,
            "total_signals": total_signals,
            "confidence_score": round(confidence, 2),
            "signal_strength": strength
        }
    }


def calculate_support_resistance_levels(candles: List[Dict], num_levels: int = 3) -> Dict:
    """
    Расчет уровней поддержки и сопротивления на основе исторических данных
    
    Args:
        candles: Список свечей с OHLC данными
        num_levels: Количество уровней для каждого типа
        
    Returns:
        Dict с уровнями поддержки и сопротивления
    """
    if not candles or len(candles) < 20:
        return {
            'support': [],
            'resistance': [],
            'current_price': 0,
            'nearest_support': None,
            'nearest_resistance': None,
            'support_strength': 0,
            'resistance_strength': 0
        }
    
    # Собираем все high и low
    lows = [c.get('low', 0) for c in candles if c.get('low')]
    highs = [c.get('high', 0) for c in candles if c.get('high')]
    closes = [c.get('close', 0) for c in candles if c.get('close')]
    
    if not lows or not highs or not closes:
        return {
            'support': [],
            'resistance': [],
            'current_price': 0,
            'nearest_support': None,
            'nearest_resistance': None
        }
    
    current_price = closes[-1]
    
    # Находим уровни поддержки (низкие точки, где цена разворачивалась)
    support_levels = []
    resistance_levels = []
    
    # Используем оконный метод для нахождения локальных минимумов/максимумов
    window = 5
    
    for i in range(window, len(lows) - window):
        # Проверяем локальный минимум (поддержка)
        is_local_min = all(lows[i] <= lows[j] for j in range(i - window, i + window + 1) if j != i)
        if is_local_min:
            # Считаем сколько раз цена касалась этого уровня
            touch_count = sum(1 for low in lows if abs(low - lows[i]) / lows[i] < 0.001)
            support_levels.append({
                'price': lows[i],
                'touches': touch_count,
                'strength': touch_count / window,  # 0-1
                'distance_pct': abs(current_price - lows[i]) / current_price * 100
            })
        
        # Проверяем локальный максимум (сопротивление)
        is_local_max = all(highs[i] >= highs[j] for j in range(i - window, i + window + 1) if j != i)
        if is_local_max:
            touch_count = sum(1 for high in highs if abs(high - highs[i]) / highs[i] < 0.001)
            resistance_levels.append({
                'price': highs[i],
                'touches': touch_count,
                'strength': touch_count / window,
                'distance_pct': abs(current_price - highs[i]) / current_price * 100
            })
    
    # Сортируем по силе (количеству касаний)
    support_levels.sort(key=lambda x: x['strength'], reverse=True)
    resistance_levels.sort(key=lambda x: x['strength'], reverse=True)
    
    # Берем top N уровней
    top_support = support_levels[:num_levels]
    top_resistance = resistance_levels[:num_levels]
    
    # Находим ближайшие уровни
    nearest_support = None
    for level in top_support:
        if level['price'] < current_price:
            nearest_support = level
            break
    
    nearest_resistance = None
    for level in top_resistance:
        if level['price'] > current_price:
            nearest_resistance = level
            break
    
    return {
        'support': top_support,
        'resistance': top_resistance,
        'current_price': current_price,
        'nearest_support': nearest_support,
        'nearest_resistance': nearest_resistance,
        'support_strength': sum(l['strength'] for l in top_support) / len(top_support) if top_support else 0,
        'resistance_strength': sum(l['strength'] for l in top_resistance) / len(top_resistance) if top_resistance else 0
    }
