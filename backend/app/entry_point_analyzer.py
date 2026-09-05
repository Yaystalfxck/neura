"""
Усовершенствованный анализ точек входа (Entry Points) с динамическими расчетами
и поддержкой множественных факторов
"""

from typing import Dict, List, Tuple, Optional
import numpy as np

class EntryPointAnalyzer:
    """Анализ оптимальных точек входа"""
    
    def __init__(self):
        self.min_signal_strength = 0.30  # 30% минимум для слабого сигнала
        self.optimum_signal_strength = 0.70  # 70% оптимум
        self.premium_signal_strength = 0.85  # 85%+ премиум
    
    def analyze_entry_quality(self, candles: List[Dict], direction: str) -> Dict:
        """
        Анализ качества входа с множественными факторами
        
        Возвращает:
        - entry_score: 0-100 (процент совершенства входа)
        - factors: подробный анализ каждого фактора
        - recommendation: рекомендация по входу
        - timing: оптимальное время входа
        """
        
        if len(candles) < 20:
            return {'error': 'Insufficient data', 'entry_score': 0}
        
        closes = np.array([c['close'] for c in candles])
        highs = np.array([c['high'] for c in candles])
        lows = np.array([c['low'] for c in candles])
        times = [c.get('time', 0) for c in candles]
        
        factors = {}
        scores = []
        weighted_scores = {}
        
        # 1. Позиция относительно опорных уровней (вес: 25%)
        sr_score, sr_factors = self._analyze_support_resistance(closes, direction)
        factors['support_resistance'] = sr_factors
        weighted_scores['support_resistance'] = (sr_score, 0.25)
        scores.append(sr_score * 0.25)
        
        # 2. Качество тренда (вес: 20%)
        trend_score, trend_factors = self._analyze_trend_quality(closes)
        factors['trend_quality'] = trend_factors
        weighted_scores['trend_quality'] = (trend_score, 0.20)
        scores.append(trend_score * 0.20)
        
        # 3. Моментум и импульс (вес: 20%)
        momentum_score, momentum_factors = self._analyze_momentum(closes)
        factors['momentum'] = momentum_factors
        weighted_scores['momentum'] = (momentum_score, 0.20)
        scores.append(momentum_score * 0.20)
        
        # 4. Уровень волатильности (вес: 15%)
        volatility_score, volatility_factors = self._analyze_volatility(closes, highs, lows)
        factors['volatility'] = volatility_factors
        weighted_scores['volatility'] = (volatility_score, 0.15)
        scores.append(volatility_score * 0.15)
        
        # 5. Позиция в диапазоне (вес: 15%)
        range_score, range_factors = self._analyze_position_in_range(closes, direction)
        factors['range_position'] = range_factors
        weighted_scores['range_position'] = (range_score, 0.15)
        scores.append(range_score * 0.15)
        
        # 6. Timing - оптимально ли время входа (вес: 5%)
        timing_score, timing_factors = self._analyze_timing(closes, times)
        factors['timing'] = timing_factors
        weighted_scores['timing'] = (timing_score, 0.05)
        scores.append(timing_score * 0.05)
        
        total_score = sum(scores)
        
        # Классификация качества
        if total_score >= 85:
            quality = "PREMIUM"
            recommendation = "Идеальная точка входа - максимально значительный вход"
        elif total_score >= 70:
            quality = "GOOD"
            recommendation = "Хорошая точка входа - рекомендуется вход"
        elif total_score >= 50:
            quality = "FAIR"
            recommendation = "Приемлемая точка входа - можно входить с осторожностью"
        elif total_score >= 30:
            quality = "WEAK"
            recommendation = "Слабая точка входа - лучше ждать более сильного сигнала"
        else:
            quality = "POOR"
            recommendation = "Плохая точка входа - вход не рекомендуется"
        
        return {
            'entry_score': total_score,
            'quality': quality,
            'recommendation': recommendation,
            'factors': factors,
            'weighted_scores': {k: {'score': v[0], 'weight': v[1]} for k, v in weighted_scores.items()},
            'direction': direction,
            'analysis_timestamp': times[-1] if times else 0
        }
    
    def _analyze_support_resistance(self, closes: np.ndarray, direction: str) -> Tuple[float, Dict]:
        """Анализ позиции относительно опорных уровней"""
        
        # Найти последние максимум и минимум
        recent_high = np.max(closes[-30:])
        recent_low = np.min(closes[-30:])
        current = closes[-1]
        
        range_size = recent_high - recent_low
        distance_from_low = current - recent_low
        distance_from_high = recent_high - current
        
        # Нормализация расстояния (0-1)
        distance_low_pct = distance_from_low / range_size if range_size > 0 else 0.5
        distance_high_pct = distance_from_high / range_size if range_size > 0 else 0.5
        
        score = 0
        reasons = []
        
        if direction.lower() == 'call':
            # Для CALL (восходящее) - лучше быть близко к поддержке (низкому уровню)
            if distance_low_pct < 0.3:
                score = 95
                reasons.append("Отличная позиция: близко к поддержке для отскока")
            elif distance_low_pct < 0.5:
                score = 75
                reasons.append("Хорошая позиция: в нижней половине диапазона")
            elif distance_low_pct < 0.7:
                score = 50
                reasons.append("Нейтральная позиция: в средней части")
            else:
                score = 25
                reasons.append("Неудачная позиция: близко к сопротивлению")
        
        else:  # PUT
            # Для PUT (нисходящее) - лучше быть близко к сопротивлению
            if distance_high_pct < 0.3:
                score = 95
                reasons.append("Отличная позиция: близко к сопротивлению для отката")
            elif distance_high_pct < 0.5:
                score = 75
                reasons.append("Хорошая позиция: в верхней половине диапазона")
            elif distance_high_pct < 0.7:
                score = 50
                reasons.append("Нейтральная позиция: в средней части")
            else:
                score = 25
                reasons.append("Неудачная позиция: близко к поддержке")
        
        return score, {
            'score': score,
            'recent_high': recent_high,
            'recent_low': recent_low,
            'current_price': current,
            'distance_from_low_pct': distance_low_pct * 100,
            'distance_from_high_pct': distance_high_pct * 100,
            'reasons': reasons
        }
    
    def _analyze_trend_quality(self, closes: np.ndarray) -> Tuple[float, Dict]:
        """Анализ качества и силы тренда"""
        
        # Анализ последних 5, 10 и 20 свечей
        trend_5 = closes[-1] - closes[-5]
        trend_10 = closes[-1] - closes[-10]
        trend_20 = closes[-1] - closes[-20]
        
        # Направление для каждого периода
        trend_5_dir = 'up' if trend_5 > 0 else 'down'
        trend_10_dir = 'up' if trend_10 > 0 else 'down'
        trend_20_dir = 'up' if trend_20 > 0 else 'down'
        
        # Согласованность - все 3 в одном направлении = максимально сильный тренд
        consistent = (trend_5_dir == trend_10_dir == trend_20_dir)
        
        # Сила тренда (в процентах)
        trend_strength_5 = abs(trend_5 / closes[-5]) * 100 if closes[-5] > 0 else 0
        trend_strength_10 = abs(trend_10 / closes[-10]) * 100 if closes[-10] > 0 else 0
        trend_strength_20 = abs(trend_20 / closes[-20]) * 100 if closes[-20] > 0 else 0
        
        avg_strength = (trend_strength_5 + trend_strength_10 + trend_strength_20) / 3
        
        score = 0
        if consistent:
            if avg_strength > 0.1:
                score = 85
                reason = f"Сильный согласованный тренд: +{avg_strength:.3f}%"
            elif avg_strength > 0.05:
                score = 70
                reason = f"Умеренный согласованный тренд: +{avg_strength:.3f}%"
            else:
                score = 50
                reason = f"Слабый согласованный тренд: +{avg_strength:.3f}%"
        else:
            if avg_strength > 0.1:
                score = 50
                reason = f"Несогласованный но сильный тренд: +{avg_strength:.3f}%"
            else:
                score = 30
                reason = "Боковое движение или разворот"
        
        return score, {
            'score': score,
            'trend_5_candles': trend_strength_5,
            'trend_10_candles': trend_strength_10,
            'trend_20_candles': trend_strength_20,
            'average_strength': avg_strength,
            'consistency': consistent,
            'reason': reason
        }
    
    def _analyze_momentum(self, closes: np.ndarray) -> Tuple[float, Dict]:
        """Анализ моментума и импульса"""
        
        # Ускорение = разница между последней и предпоследней разницей
        recent_changes = np.diff(closes[-5:])
        momentum = recent_changes[-1]
        acceleration = momentum - recent_changes[-2] if len(recent_changes) > 1 else momentum
        
        # Направление и сила импульса
        momentum_strength = abs(momentum / closes[-1]) * 100 if closes[-1] > 0 else 0
        acceleration_strength = abs(acceleration / closes[-1]) * 100 if closes[-1] > 0 else 0
        
        score = 0
        reason = ""
        
        # Положительный импульс
        if momentum > 0:
            if acceleration > 0:
                score = 85
                reason = f"Сильный растущий импульс с ускорением (+{momentum_strength:.3f}%)"
            else:
                score = 65
                reason = f"Растущий импульс но замедляется (+{momentum_strength:.3f}%)"
        else:
            if acceleration < 0:
                score = 15
                reason = f"Падающий импульс с ускорением вниз (-{momentum_strength:.3f}%)"
            else:
                score = 35
                reason = f"Падающий импульс но стабилизируется (-{momentum_strength:.3f}%)"
        
        return score, {
            'score': score,
            'momentum': momentum,
            'momentum_strength_pct': momentum_strength,
            'acceleration': acceleration,
            'acceleration_strength_pct': acceleration_strength,
            'reason': reason
        }
    
    def _analyze_volatility(self, closes: np.ndarray, highs: np.ndarray, lows: np.ndarray) -> Tuple[float, Dict]:
        """Анализ волатильности для определения оптимального времени входа"""
        
        # ATR (Average True Range)
        tr = []
        for i in range(1, min(14, len(closes))):
            tr.append(max(highs[-i] - lows[-i], 
                         abs(highs[-i] - closes[-i-1]),
                         abs(lows[-i] - closes[-i-1])))
        
        atr = np.mean(tr) if tr else 0
        volatility_pct = (atr / closes[-1] * 100) if closes[-1] > 0 else 0
        
        score = 0
        reason = ""
        
        # Оптимальная волатильность: 0.5-1.0%
        if 0.5 <= volatility_pct <= 1.0:
            score = 90
            reason = "Оптимальная волатильность для торговли"
        elif 0.2 <= volatility_pct < 0.5:
            score = 60
            reason = "Низкая волатильность - медленное движение"
        elif 1.0 < volatility_pct <= 1.5:
            score = 70
            reason = "Повышенная волатильность - живой рынок"
        elif 1.5 < volatility_pct <= 2.0:
            score = 45
            reason = "Высокая волатильность - рискованно"
        else:
            score = 20
            reason = "Экстремальная волатильность - очень рискованно"
        
        return score, {
            'score': score,
            'atr': atr,
            'volatility_pct': volatility_pct,
            'optimal_range': [0.5, 1.0],
            'reason': reason
        }
    
    def _analyze_position_in_range(self, closes: np.ndarray, direction: str) -> Tuple[float, Dict]:
        """Анализ позиции в торговом диапазоне"""
        
        high_50 = np.max(closes[-50:])
        low_50 = np.min(closes[-50:])
        current = closes[-1]
        
        range_size = high_50 - low_50
        position_pct = ((current - low_50) / range_size * 100) if range_size > 0 else 50
        
        score = 0
        zone = ""
        
        is_call = direction.lower() == 'call'
        if position_pct < 25:
            score = 85 if is_call else 20
            zone = "Нижняя зона: подходит для CALL, рискованна для PUT"
        elif position_pct < 40:
            score = 65 if is_call else 35
            zone = "Нижне-средняя зона"
        elif position_pct <= 60:
            score = 50
            zone = "Средняя зона"
        elif position_pct <= 75:
            score = 35 if is_call else 65
            zone = "Верхне-средняя зона"
        else:
            score = 20 if is_call else 85
            zone = "Верхняя зона: подходит для PUT, рискованна для CALL"
        
        return score, {
            'score': score,
            'high_50': high_50,
            'low_50': low_50,
            'current_price': current,
            'position_pct': position_pct,
            'zone': zone
        }
    
    def _analyze_timing(self, closes: np.ndarray, times: List[int]) -> Tuple[float, Dict]:
        """Анализ оптимальности времени входа"""
        
        # Простой анализ: чем дальше в свечу, тем лучше видно направление
        # Предположим, что последняя свеча на 50% готова
        candle_progress = 50
        
        score = 0
        if 30 <= candle_progress <= 70:
            score = 80
            timing_rec = "Оптимальное время - середина свечи"
        elif candle_progress < 30:
            score = 40
            timing_rec = "Рано входить - мало информации"
        else:
            score = 60
            timing_rec = "Практически конец свечи - окончательное подтверждение"
        
        return score, {
            'score': score,
            'candle_progress_pct': candle_progress,
            'recommendation': timing_rec
        }


def calculate_optimal_entry_and_expiry(candles: List[Dict], direction: str) -> Dict:
    """
    Комплексная функция для расчета оптимальной ТА и ЭКСПИРАЦИИ
    """
    # Инициализируем переменную с дефолтным значением
    optimal_expiry = 5
    
    analyzer = EntryPointAnalyzer()
    entry_analysis = analyzer.analyze_entry_quality(candles, direction)
    
    if 'error' in entry_analysis:
        return {
            'entry_score': 0,
            'optimal_expiry': optimal_expiry,
            'recommendation': 'insufficient data'
        }
    
    entry_score = entry_analysis['entry_score']
    
    # Динамический расчет экспирации на основе качества ТА
    # Логика: лучшая ТА = больше времени
    if entry_score >= 85:
        optimal_expiry = 8  # Премиум качество - 8 минут
    elif entry_score >= 70:
        optimal_expiry = 6  # Хорошее качество - 6 минут
    elif entry_score >= 50:
        optimal_expiry = 4  # Приемлемое - 4 минуты
    elif entry_score >= 30:
        optimal_expiry = 3  # Слабое - 3 минуты (быстро выход)
    else:
        optimal_expiry = 2  # Плохое - 2 минуты минимум
    
    # Также корректируем по волатильности
    try:
        volatility_pct = entry_analysis.get('factors', {}).get('volatility', {}).get('volatility_pct', 0.5)
    except (KeyError, TypeError):
        volatility_pct = 0.5
    
    if volatility_pct > 1.5:
        optimal_expiry = min(15, optimal_expiry + 2)  # Высокая волатильность - больше времени
    elif volatility_pct < 0.2:
        optimal_expiry = max(2, optimal_expiry - 1)  # Низкая волатильность - меньше времени
    
    return {
        'entry_score': entry_score,
        'optimal_expiry': optimal_expiry,
        'quality': entry_analysis.get('quality', 'UNKNOWN'),
        'recommendation': entry_analysis.get('recommendation', 'No recommendation'),
        'detailed_analysis': entry_analysis
    }
