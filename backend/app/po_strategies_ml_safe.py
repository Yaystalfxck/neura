"""
Безопасная обертка для ML сигналов.
Гарантирует, что ошибка ML не сломает основной анализ.
"""
from typing import List, Dict


def get_safe_ml_signal(candles: List[Dict]) -> Dict:
    """
    Пытается получить ML сигнал. Если ошибка — возвращает None.
    """
    try:
        # Импортируем генератор
        from app.ml_signal_generator import get_ml_generator

        ml_gen = get_ml_generator()

        # Обучаем модель (train возвращает True/False)
        if ml_gen.train(candles):
            res = ml_gen.predict(candles)

            # Проверяем результат
            # Порог 55% — чтобы отсеивать слабые сигналы
            if res and res.get('confidence', 0) > 0.55:
                return {
                    'signal': res.get('direction'),  # 'call' or 'put'
                    'confidence': res.get('confidence', 0) * 100,
                    'source': 'ML_SAFE'
                }
    except Exception:
        # Любая ошибка (например, feature mismatch) просто игнорируется
        pass

    return {'signal': None, 'confidence': 0, 'source': 'ML_SAFE'}
