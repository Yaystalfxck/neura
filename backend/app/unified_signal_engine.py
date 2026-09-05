"""
Интеграционный модуль для объединения всех анализов:
- Advanced Signal Analyzer (множественные стратегии)
- Entry Point Analyzer (качество входа + динамическая экспирация)
- Smart System + ML System
"""

from typing import Dict, List, Optional
from app.advanced_signal_analyzer import AdvancedSignalAnalyzer
from app.entry_point_analyzer import calculate_optimal_entry_and_expiry
from app.po_strategies_smart import get_smart_signal
from app.po_strategies_ml_safe import get_safe_ml_signal

class UnifiedSignalEngine:
    """Объединённый движок анализа сигналов"""
    
    def __init__(self):
        self.advanced_analyzer = AdvancedSignalAnalyzer()
    
    def analyze_and_generate_signal(self, candles: List[Dict]) -> Dict:
        """
        Полный анализ с использованием всех систем
        
        Возвращает словарь со:
        - signal: направление (call/put или None)
        - confidence: уверенность 0-100
        - expiry: рассчитанная экспирация в минутах
        - entry_quality: качество входа 0-100
        - strategies_used: которые стратегии участвовали
        - detailed_analysis: полный анализ для отладки
        """
        
        if len(candles) < 20:
            return {'error': 'Insufficient candles', 'signal': None}
        
        result = {
            'signal': None,
            'confidence': 0,
            'expiry': 5,
            'entry_quality': 0,
            'strategies_used': [],
            'analysis': {}
        }
        
        try:
            optimal_expiry = 5

            # 1. Продвинутый анализ со множеством стратегий
            advanced = self.advanced_analyzer.analyze_all_strategies(candles)
            
            if 'error' in advanced:
                # Fallback на Smart + ML если Advanced не работает
                return self._fallback_analysis(candles)
            
            # advanced.get('signal') возвращает словарь с ключами: signal, confidence, entry_score, optimal_expiry...
            signal_data = advanced.get('signal') or {}
            
            direction = signal_data.get('signal')
            base_confidence = signal_data.get('confidence', 0)
            entry_score = signal_data.get('entry_score', 50)
            optimal_expiry = signal_data.get('optimal_expiry', 5)
            best_strategy = signal_data.get('best_strategy', 'multi_strategy')
            all_strategies = advanced.get('all_strategies', [])
            
            if not direction or base_confidence < 30:
                # Fallback на Smart + ML если Advanced не генерировал хороший сигнал
                return self._fallback_analysis(candles)
            
            # 2. Анализ качества входа и экспирации
            entry_analysis = calculate_optimal_entry_and_expiry(candles, direction)
            entry_quality = entry_analysis['entry_score']
            optimal_expiry_entry = entry_analysis.get('optimal_expiry', optimal_expiry)

            # Do not trade on a lone or split strategy. Agreement is a
            # stronger quality signal than the highest individual score.
            direction_votes = [s for s in all_strategies if s.get('signal') == direction]
            opposite_votes = [s for s in all_strategies if s.get('signal') and s.get('signal') != direction]
            total_votes = len(direction_votes) + len(opposite_votes)
            consensus_ratio = len(direction_votes) / total_votes if total_votes else 0
            if len(direction_votes) < 2 or consensus_ratio < 0.60:
                return {
                    'signal': None,
                    'confidence': 0,
                    'expiry': 5,
                    'entry_quality': entry_quality,
                    'strategies_used': [s['name'] for s in all_strategies if s.get('signal')],
                    'fallback': False,
                    'reason': 'Недостаточный консенсус стратегий'
                }

            directional_alignment = self._directional_alignment(candles, direction)
            if directional_alignment < 0.45:
                return {
                    'signal': None,
                    'confidence': 0,
                    'expiry': 5,
                    'entry_quality': entry_quality,
                    'strategies_used': [s['name'] for s in all_strategies if s.get('signal')],
                    'fallback': False,
                    'reason': 'Краткосрочный импульс против сигнала'
                }
            
            # Используем лучшую из двух экспираций
            if entry_quality > 70:
                optimal_expiry = optimal_expiry_entry
            
            # 3. Доп проверка от Smart System
            smart_check = get_smart_signal(candles)
            smart_confirms = smart_check.get('signal') == direction
            
            # 4. Финальный расчет confidence
            agreeing_confidence = sum(s.get('confidence', 0) for s in direction_votes) / len(direction_votes)
            final_confidence = (base_confidence * 0.45) + (agreeing_confidence * 0.35) + (consensus_ratio * 100 * 0.20)
            
            # Бонус за подтверждение Smart Systems
            if smart_confirms:
                final_confidence += 4
                result['strategies_used'].append('smart_system_confirmed')
            else:
                final_confidence -= 5
            
            # Корректировка по качеству входа
            if entry_quality < 55:
                final_confidence -= 8
            elif entry_quality >= 80:
                final_confidence += 2

            final_confidence = max(0, min(95, final_confidence))

            if final_confidence < 60:
                return {
                    'signal': None,
                    'confidence': round(final_confidence, 1),
                    'expiry': 5,
                    'entry_quality': entry_quality,
                    'strategies_used': [s['name'] for s in all_strategies if s.get('signal')],
                    'fallback': False,
                    'reason': 'Итоговая уверенность ниже торгового порога'
                }
            
            result.update({
                'signal': direction,
                'confidence': final_confidence,
                'expiry': optimal_expiry,
                'entry_quality': entry_quality,
                'trend': self._trend_label(candles),
                'rsi': advanced.get('all_indicators', {}).get('rsi', 50),
                'strategies_used': [s['name'] for s in all_strategies if s['signal']],
                'best_strategy': best_strategy,
                'analysis': {
                    'advanced_strategies': all_strategies,
                    'entry_analysis': entry_analysis['detailed_analysis'],
                    'smart_system_check': {
                        'confirms': smart_confirms,
                        'confidence': smart_check.get('confidence', 0)
                    },
                    'consensus': {
                        'agreeing_strategies': len(direction_votes),
                        'opposing_strategies': len(opposite_votes),
                        'ratio': consensus_ratio,
                        'directional_alignment': directional_alignment
                    },
                    'market_regime': advanced.get('market_regime', 'UNKNOWN'),
                    'all_indicators': {k: v for k, v in advanced.get('all_indicators', {}).items() 
                                      if k in ['rsi', 'volatility', 'momentum_pct']}
                }
            })
            
        except Exception as e:
            print(f"❌ Unified analysis error: {str(e)}")
            import traceback
            traceback.print_exc()
            return self._fallback_analysis(candles)
        
        return result

    def _directional_alignment(self, candles: List[Dict], direction: str) -> float:
        """Return 0..1 agreement of recent price movement with the signal."""
        closes = [float(c['close']) for c in candles[-10:]]
        if len(closes) < 3:
            return 0.0

        changes = [current - previous for previous, current in zip(closes, closes[1:])]
        positive = sum(change > 0 for change in changes)
        negative = sum(change < 0 for change in changes)
        directional_moves = positive if direction == 'call' else negative
        return directional_moves / len(changes)

    def _trend_label(self, candles: List[Dict]) -> str:
        """Classify the recent move for display and final signal validation."""
        alignment_call = self._directional_alignment(candles, 'call')
        alignment_put = self._directional_alignment(candles, 'put')
        if alignment_call >= 0.6:
            return 'bullish'
        if alignment_put >= 0.6:
            return 'bearish'
        return 'neutral'
    
    def _fallback_analysis(self, candles: List[Dict]) -> Dict:
        """Fallback для старой системы Smart + ML"""
        
        smart_res = get_smart_signal(candles)
        ml_res = get_safe_ml_signal(candles)
        
        result = {
            'signal': None,
            'confidence': 0,
            'expiry': 5,
            'entry_quality': 0,
            'strategies_used': [],
            'fallback': True
        }
        
        if smart_res.get('signal') and smart_res.get('confidence', 0) > 55:
            result['signal'] = smart_res['signal']
            result['confidence'] = smart_res['confidence']
            result['strategies_used'].append('smart_system')
            
            # Проверка ML
            if ml_res.get('signal') == smart_res['signal']:
                result['confidence'] = min(95, result['confidence'] + 15)
                result['strategies_used'].append('ml_confirmed')
        
        elif ml_res.get('signal') and ml_res.get('confidence', 0) > 45:
            result['signal'] = ml_res['signal']
            result['confidence'] = ml_res['confidence']
            result['strategies_used'].append('ml_system')
        
        # Динамическая экспирация в fallback режиме
        if result['signal']:
            entry_analysis = calculate_optimal_entry_and_expiry(candles, result['signal'])
            result['entry_quality'] = entry_analysis.get('entry_score', 0)
            result['expiry'] = entry_analysis.get('optimal_expiry', result['expiry'])
            result['trend'] = self._trend_label(candles)

            volatility = self._estimate_volatility(candles)
            if volatility > 1.0:
                result['expiry'] = 6
            elif volatility < 0.3:
                result['expiry'] = 3
        
        return result
    
    def _estimate_volatility(self, candles: List[Dict]) -> float:
        """估算波动性 (процент)"""
        closes = [c['close'] for c in candles[-20:]]
        if not closes:
            return 0.5
        
        atr = max(closes) - min(closes)
        return (atr / closes[-1] * 100) if closes[-1] > 0 else 0.5


def get_unified_signal(candles: List[Dict]) -> Dict:
    """Простая функция для получения унифицированного сигнала"""
    engine = UnifiedSignalEngine()
    return engine.analyze_and_generate_signal(candles)
