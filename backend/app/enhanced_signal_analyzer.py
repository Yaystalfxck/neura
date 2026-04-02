"""
Enhanced TradingView Signal Analyzer
Улучшенный анализ сигналов с Multi-Timeframe Analysis, Confluence Factors и Risk Management
"""

from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import numpy as np
from enum import Enum


class SignalStrength(Enum):
    VERY_WEAK = "very_weak"
    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"
    VERY_STRONG = "very_strong"


class TrendDirection(Enum):
    STRONG_BEARISH = "strong_bearish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    BULLISH = "bullish"
    STRONG_BULLISH = "strong_bullish"


@dataclass
class MTFAnalysis:
    """Multi-Timeframe Analysis"""
    timeframe: str
    trend: str
    rsi: float
    macd_direction: str
    signal: str  # 'buy', 'sell', 'neutral'
    weight: float  # вес таймфрейма в общем анализе


@dataclass
class ConfluenceFactor:
    """Фактор подтверждения сигнала"""
    name: str
    value: Any
    signal: str  # 'bullish', 'bearish', 'neutral'
    weight: float  # важность фактора (0-1)
    score: float  # итоговый score (0-100)


@dataclass
class RiskMetrics:
    """Метрики риска"""
    risk_reward_ratio: float
    win_rate_estimate: float
    max_adverse_excursion: float
    expected_move: float
    volatility_adjusted_position: float


@dataclass
class EnhancedSignal:
    """Улучшенный сигнал с расширенными метриками"""
    pair: str
    direction: str  # 'BUY' or 'SELL'
    confidence: float  # 0-100
    strength: SignalStrength
    entry_price: float
    take_profit: float
    stop_loss: float
    expiry_minutes: int
    
    # Multi-Timeframe Analysis
    mtf_analysis: List[MTFAnalysis]
    mtf_score: float  # общий score MTF анализа
    
    # Confluence Factors
    confluence_factors: List[ConfluenceFactor]
    confluence_score: float  # общий score подтверждений
    
    # Risk Metrics
    risk_metrics: RiskMetrics
    
    # Traditional Indicators
    rsi: float
    macd_direction: str
    trend: str
    volatility: float
    volume_ratio: float
    
    # Additional
    support_levels: List[float]
    resistance_levels: List[float]
    candle_pattern: str
    market_condition: str  # 'trending', 'ranging', 'volatile'
    
    # Metadata
    generated_at: str
    valid_until: str
    reasoning: str


class EnhancedSignalAnalyzer:
    """
    Улучшенный анализатор сигналов с расширенными возможностями
    """
    
    # Веса таймфреймов для MTF анализа
    MTF_WEIGHTS = {
        '1': 0.15,    # 1 мин - наименьший вес
        '3': 0.20,    # 3 мин
        '5': 0.30,    # 5 мин - основной таймфрейм
        '10': 0.25,   # 10 мин
        '15': 0.10    # 15 мин - для контекста
    }
    
    # Веса индикаторов
    INDICATOR_WEIGHTS = {
        'rsi': 0.20,
        'macd': 0.25,
        'trend': 0.20,
        'bollinger': 0.15,
        'volume': 0.10,
        'support_resistance': 0.10
    }
    
    def __init__(self):
        pass
    
    def analyze_multi_timeframe(
        self,
        main_timeframe: str,
        indicators_data: Dict[str, Any]
    ) -> Tuple[List[MTFAnalysis], float]:
        """
        Multi-Timeframe Analysis
        
        Args:
            main_timeframe: основной таймфрейм
            indicators_data: данные индикаторов для разных таймфреймов
            
        Returns:
            List[MTFAnalysis], общий score
        """
        mtf_results = []
        total_score = 0
        total_weight = 0
        
        for tf, weight in self.MTF_WEIGHTS.items():
            if tf not in indicators_data:
                continue
                
            tf_data = indicators_data[tf]
            
            # Определяем сигнал для каждого таймфрейма
            signal = self._determine_tf_signal(tf_data)
            
            mtf_analysis = MTFAnalysis(
                timeframe=tf,
                trend=tf_data.get('trend', 'neutral'),
                rsi=tf_data.get('rsi', 50),
                macd_direction=tf_data.get('macd_direction', 'neutral'),
                signal=signal,
                weight=weight
            )
            mtf_results.append(mtf_analysis)
            
            # Рассчитываем score
            if signal == 'buy':
                total_score += weight * 100
            elif signal == 'sell':
                total_score += weight * 0
            else:
                total_score += weight * 50
            
            total_weight += weight
        
        # Нормализуем score
        normalized_score = (total_score / total_weight) if total_weight > 0 else 50
        
        return mtf_results, normalized_score
    
    def _determine_tf_signal(self, tf_data: Dict) -> str:
        """Определение сигнала для одного таймфрейма"""
        rsi = tf_data.get('rsi', 50)
        macd = tf_data.get('macd_direction', 'neutral')
        trend = tf_data.get('trend', 'neutral')
        
        bullish_score = 0
        bearish_score = 0
        
        # RSI scoring
        if rsi < 30:
            bullish_score += 2  # Перепроданность - сигнал на покупку
        elif rsi > 70:
            bearish_score += 2  # Перекупленность - сигнал на продажу
        elif rsi < 45:
            bullish_score += 1
        elif rsi > 55:
            bearish_score += 1
        
        # MACD scoring
        if macd == 'bullish':
            bullish_score += 2
        elif macd == 'bearish':
            bearish_score += 2
        
        # Trend scoring
        if trend == 'bullish':
            bullish_score += 2
        elif trend == 'bearish':
            bearish_score += 2
        
        if bullish_score > bearish_score:
            return 'buy'
        elif bearish_score > bullish_score:
            return 'sell'
        return 'neutral'
    
    def analyze_confluence_factors(
        self,
        indicators: Dict[str, Any],
        price_data: Dict[str, Any]
    ) -> Tuple[List[ConfluenceFactor], float]:
        """
        Анализ факторов подтверждения (Confluence Analysis)
        
        Args:
            indicators: данные индикаторов
            price_data: данные о цене и уровнях
            
        Returns:
            List[ConfluenceFactor], общий score
        """
        factors = []
        total_score = 0
        total_weight = 0
        
        # 1. RSI Confluence
        rsi = indicators.get('rsi', 50)
        rsi_factor = ConfluenceFactor(
            name='RSI',
            value=rsi,
            signal='bullish' if rsi < 40 else 'bearish' if rsi > 60 else 'neutral',
            weight=self.INDICATOR_WEIGHTS['rsi'],
            score=self._calculate_rsi_score(rsi)
        )
        factors.append(rsi_factor)
        total_score += rsi_factor.score * rsi_factor.weight
        total_weight += rsi_factor.weight
        
        # 2. MACD Confluence
        macd_dir = indicators.get('macd_direction', 'neutral')
        macd_factor = ConfluenceFactor(
            name='MACD',
            value=macd_dir,
            signal=macd_dir,
            weight=self.INDICATOR_WEIGHTS['macd'],
            score=80 if macd_dir != 'neutral' else 50
        )
        factors.append(macd_factor)
        total_score += macd_factor.score * macd_factor.weight
        total_weight += macd_factor.weight
        
        # 3. Trend Confluence
        trend = indicators.get('trend', 'neutral')
        trend_factor = ConfluenceFactor(
            name='Trend',
            value=trend,
            signal=trend,
            weight=self.INDICATOR_WEIGHTS['trend'],
            score=self._calculate_trend_score(trend)
        )
        factors.append(trend_factor)
        total_score += trend_factor.score * trend_factor.weight
        total_weight += trend_factor.weight
        
        # 4. Bollinger Bands Confluence
        bb_pos = indicators.get('bb_position', 'middle')
        bb_factor = ConfluenceFactor(
            name='Bollinger Bands',
            value=bb_pos,
            signal='bullish' if bb_pos == 'below_lower' else 'bearish' if bb_pos == 'above_upper' else 'neutral',
            weight=self.INDICATOR_WEIGHTS['bollinger'],
            score=self._calculate_bb_score(bb_pos)
        )
        factors.append(bb_factor)
        total_score += bb_factor.score * bb_factor.weight
        total_weight += bb_factor.weight
        
        # 5. Volume Confluence
        volume_ratio = indicators.get('volume_ratio', 1)
        volume_factor = ConfluenceFactor(
            name='Volume',
            value=volume_ratio,
            signal='bullish' if volume_ratio > 1.5 else 'bearish' if volume_ratio < 0.7 else 'neutral',
            weight=self.INDICATOR_WEIGHTS['volume'],
            score=min(100, volume_ratio * 50)
        )
        factors.append(volume_factor)
        total_score += volume_factor.score * volume_factor.weight
        total_weight += volume_factor.weight
        
        # 6. Support/Resistance Confluence
        current_price = price_data.get('current_price', 0)
        support = price_data.get('support', 0)
        resistance = price_data.get('resistance', 0)
        
        sr_signal = 'neutral'
        sr_score = 50
        
        if support > 0 and current_price <= support * 1.002:
            sr_signal = 'bullish'  # Цена у поддержки
            sr_score = 75
        elif resistance > 0 and current_price >= resistance * 0.998:
            sr_signal = 'bearish'  # Цена у сопротивления
            sr_score = 75
        
        sr_factor = ConfluenceFactor(
            name='Support/Resistance',
            value={'support': support, 'resistance': resistance},
            signal=sr_signal,
            weight=self.INDICATOR_WEIGHTS['support_resistance'],
            score=sr_score
        )
        factors.append(sr_factor)
        total_score += sr_factor.score * sr_factor.weight
        total_weight += sr_factor.weight
        
        # Нормализуем общий score
        normalized_score = (total_score / total_weight) if total_weight > 0 else 50
        
        return factors, normalized_score
    
    def _calculate_rsi_score(self, rsi: float) -> float:
        """Расчет score для RSI"""
        if 25 <= rsi <= 35 or 65 <= rsi <= 75:
            return 80  # Хорошая зона для разворота
        elif rsi < 25 or rsi > 75:
            return 70  # Сильная перекупленность/перепроданность
        elif 35 <= rsi <= 65:
            return 50  # Нейтральная зона
        return 50
    
    def _calculate_trend_score(self, trend: str) -> float:
        """Расчет score для тренда"""
        if trend in ['strong_bullish', 'strong_bearish']:
            return 85
        elif trend in ['bullish', 'bearish']:
            return 70
        return 50
    
    def _calculate_bb_score(self, position: str) -> float:
        """Расчет score для Bollinger Bands"""
        if position in ['below_lower', 'above_upper']:
            return 75  # Потенциальный разворот
        elif position in ['above_middle', 'below_middle']:
            return 60
        return 50
    
    def calculate_risk_metrics(
        self,
        entry_price: float,
        take_profit: float,
        stop_loss: float,
        volatility: float,
        direction: str
    ) -> RiskMetrics:
        """
        Расчет метрик риска
        
        Args:
            entry_price: цена входа
            take_profit: уровень тейк-профита
            stop_loss: уровень стоп-лосса
            volatility: волатильность
            direction: направление сделки
            
        Returns:
            RiskMetrics
        """
        # Risk/Reward Ratio
        if direction == 'BUY':
            risk = entry_price - stop_loss
            reward = take_profit - entry_price
        else:
            risk = stop_loss - entry_price
            reward = entry_price - take_profit
        
        risk_reward_ratio = reward / risk if risk > 0 else 0
        
        # Оценка вероятности успеха на основе RR
        win_rate_estimate = min(0.75, 0.5 + (risk_reward_ratio - 1) * 0.1)
        win_rate_estimate = max(0.25, win_rate_estimate)
        
        # Expected Move (на основе волатильности)
        expected_move = entry_price * volatility
        
        # Max Adverse Excursion (максимальное неблагоприятное отклонение)
        max_adverse_excursion = entry_price * (volatility * 0.5)
        
        # Volatility Adjusted Position Size
        volatility_adjusted_position = 1.0 / (volatility * 100) if volatility > 0 else 1.0
        
        return RiskMetrics(
            risk_reward_ratio=round(risk_reward_ratio, 2),
            win_rate_estimate=round(win_rate_estimate * 100, 1),  # в процентах
            max_adverse_excursion=round(max_adverse_excursion, 5),
            expected_move=round(expected_move, 5),
            volatility_adjusted_position=round(volatility_adjusted_position, 2)
        )
    
    def determine_market_condition(
        self,
        volatility: float,
        trend: str,
        atr: float
    ) -> str:
        """Определение состояния рынка"""
        if volatility > 0.02:
            return 'volatile'
        elif trend in ['strong_bullish', 'strong_bearish']:
            return 'trending'
        else:
            return 'ranging'
    
    def generate_enhanced_signal(
        self,
        pair: str,
        indicators: Dict[str, Any],
        price_data: Dict[str, Any],
        mtf_data: Dict[str, Any],
        timeframe: str
    ) -> EnhancedSignal:
        """
        Генерация улучшенного сигнала
        
        Args:
            pair: валютная пара
            indicators: индикаторы
            price_data: данные о цене
            mtf_data: MTF данные
            timeframe: таймфрейм
            
        Returns:
            EnhancedSignal
        """
        # 1. Multi-Timeframe Analysis
        mtf_analysis, mtf_score = self.analyze_multi_timeframe(timeframe, mtf_data)
        
        # 2. Confluence Analysis
        confluence_factors, confluence_score = self.analyze_confluence_factors(indicators, price_data)
        
        # 3. Определяем направление
        direction = 'BUY' if mtf_score > 55 else 'SELL' if mtf_score < 45 else 'BUY'
        
        # 4. Рассчитываем уверенность
        base_confidence = 50
        base_confidence += (mtf_score - 50) * 0.4  # MTF вклад
        base_confidence += (confluence_score - 50) * 0.4  # Confluence вклад
        
        # Бонус за сильные факторы
        strong_factors = sum(1 for f in confluence_factors if f.score > 75)
        base_confidence += strong_factors * 3
        
        confidence = min(95, max(50, base_confidence))
        
        # 5. Определяем силу сигнала
        if confidence >= 85:
            strength = SignalStrength.VERY_STRONG
        elif confidence >= 75:
            strength = SignalStrength.STRONG
        elif confidence >= 65:
            strength = SignalStrength.MODERATE
        elif confidence >= 55:
            strength = SignalStrength.WEAK
        else:
            strength = SignalStrength.VERY_WEAK
        
        # 6. Расчет TP/SL на основе ATR
        current_price = price_data.get('current_price', 1.0850)
        atr = indicators.get('atr', 0.0010)
        volatility = indicators.get('volatility', 0.01)
        
        if direction == 'BUY':
            take_profit = current_price + (atr * 2.0)
            stop_loss = current_price - (atr * 1.0)
        else:
            take_profit = current_price - (atr * 2.0)
            stop_loss = current_price + (atr * 1.0)
        
        # 7. Risk Metrics
        risk_metrics = self.calculate_risk_metrics(
            current_price, take_profit, stop_loss, volatility, direction
        )
        
        # 8. Оптимальная экспирация
        if volatility < 0.005:
            expiry = 10
        elif volatility > 0.02:
            expiry = 3
        else:
            expiry = 5
        
        # 9. Уровни поддержки и сопротивления
        support_levels = [price_data.get('support', current_price * 0.995)]
        resistance_levels = [price_data.get('resistance', current_price * 1.005)]
        
        # 10. Формируем reasoning
        reasoning = self._generate_reasoning(
            pair, direction, confidence, mtf_score, confluence_score,
            confluence_factors, risk_metrics
        )
        
        now = datetime.utcnow()
        
        return EnhancedSignal(
            pair=pair,
            direction=direction,
            confidence=round(confidence, 1),
            strength=strength,
            entry_price=round(current_price, 5),
            take_profit=round(take_profit, 5),
            stop_loss=round(stop_loss, 5),
            expiry_minutes=expiry,
            
            mtf_analysis=mtf_analysis,
            mtf_score=round(mtf_score, 1),
            
            confluence_factors=confluence_factors,
            confluence_score=round(confluence_score, 1),
            
            risk_metrics=risk_metrics,
            
            rsi=indicators.get('rsi', 50),
            macd_direction=indicators.get('macd_direction', 'neutral'),
            trend=indicators.get('trend', 'neutral'),
            volatility=round(volatility, 4),
            volume_ratio=indicators.get('volume_ratio', 1),
            
            support_levels=support_levels,
            resistance_levels=resistance_levels,
            candle_pattern=indicators.get('candle_pattern', 'unknown'),
            market_condition=self.determine_market_condition(volatility, indicators.get('trend', 'neutral'), atr),
            
            generated_at=now.isoformat(),
            valid_until=(now + timedelta(seconds=30)).isoformat(),
            reasoning=reasoning
        )
    
    def _generate_reasoning(
        self,
        pair: str,
        direction: str,
        confidence: float,
        mtf_score: float,
        confluence_score: float,
        confluence_factors: List[ConfluenceFactor],
        risk_metrics: RiskMetrics
    ) -> str:
        """Генерация текстового обоснования сигнала"""
        direction_text = "BUY" if direction == "BUY" else "SELL"
        
        # Основные факторы
        strong_factors = [f.name for f in confluence_factors if f.score > 75]
        
        reasoning = f"{pair}: {direction_text} сигнал с уверенностью {confidence:.0f}%. "
        
        if strong_factors:
            reasoning += f"Сильные факторы: {', '.join(strong_factors)}. "
        
        reasoning += f"MTF Score: {mtf_score:.0f}/100. "
        reasoning += f"Confluence: {confluence_score:.0f}/100. "
        reasoning += f"Risk/Reward: {risk_metrics.risk_reward_ratio:.2f}. "
        reasoning += f"Win Rate: ~{risk_metrics.win_rate_estimate:.0f}%."
        
        return reasoning
    
    def signal_to_dict(self, signal: EnhancedSignal) -> Dict:
        """Конвертация EnhancedSignal в dict для JSON"""
        return {
            'pair': signal.pair,
            'direction': signal.direction,
            'confidence': signal.confidence,
            'strength': signal.strength.value,
            'entry_price': signal.entry_price,
            'take_profit': signal.take_profit,
            'stop_loss': signal.stop_loss,
            'expiry_minutes': signal.expiry_minutes,
            
            'mtf_score': signal.mtf_score,
            'mtf_analysis': [asdict(m) for m in signal.mtf_analysis],
            
            'confluence_score': signal.confluence_score,
            'confluence_factors': [asdict(f) for f in signal.confluence_factors],
            
            'risk_metrics': asdict(signal.risk_metrics),
            
            'rsi': signal.rsi,
            'macd_direction': signal.macd_direction,
            'trend': signal.trend,
            'volatility': signal.volatility,
            'volume_ratio': signal.volume_ratio,
            
            'support_levels': signal.support_levels,
            'resistance_levels': signal.resistance_levels,
            'candle_pattern': signal.candle_pattern,
            'market_condition': signal.market_condition,
            
            'generated_at': signal.generated_at,
            'valid_until': signal.valid_until,
            'reasoning': signal.reasoning
        }


# Пример использования
if __name__ == '__main__':
    analyzer = EnhancedSignalAnalyzer()
    
    # Тестовые данные
    test_indicators = {
        'rsi': 35,
        'macd_direction': 'bullish',
        'trend': 'bullish',
        'bb_position': 'below_lower',
        'volume_ratio': 1.8,
        'atr': 0.0015,
        'volatility': 0.012,
        'candle_pattern': 'hammer'
    }
    
    test_price_data = {
        'current_price': 1.0850,
        'support': 1.0840,
        'resistance': 1.0870
    }
    
    test_mtf_data = {
        '1': {'rsi': 35, 'macd_direction': 'bullish', 'trend': 'bullish'},
        '3': {'rsi': 38, 'macd_direction': 'bullish', 'trend': 'bullish'},
        '5': {'rsi': 40, 'macd_direction': 'bullish', 'trend': 'neutral'},
        '10': {'rsi': 45, 'macd_direction': 'neutral', 'trend': 'bullish'},
        '15': {'rsi': 48, 'macd_direction': 'neutral', 'trend': 'neutral'}
    }
    
    signal = analyzer.generate_enhanced_signal(
        pair='EUR/USD',
        indicators=test_indicators,
        price_data=test_price_data,
        mtf_data=test_mtf_data,
        timeframe='5'
    )
    
    print(f"\n{'='*60}")
    print(f"📊 ENHANCED SIGNAL ANALYSIS")
    print(f"{'='*60}")
    print(f"Pair: {signal.pair}")
    print(f"Direction: {signal.direction}")
    print(f"Confidence: {signal.confidence}%")
    print(f"Strength: {signal.strength.value}")
    print(f"\nEntry: {signal.entry_price}")
    print(f"TP: {signal.take_profit}")
    print(f"SL: {signal.stop_loss}")
    print(f"Expiry: {signal.expiry_minutes} min")
    print(f"\nMTF Score: {signal.mtf_score}/100")
    print(f"Confluence Score: {signal.confluence_score}/100")
    print(f"\nRisk/Reward: {signal.risk_metrics.risk_reward_ratio}")
    print(f"Win Rate Estimate: {signal.risk_metrics.win_rate_estimate}%")
    print(f"\nReasoning: {signal.reasoning}")
    print(f"{'='*60}\n")
