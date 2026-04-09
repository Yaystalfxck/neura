"""
ML Signal Generator - Random Forest Classifier
Адаптировано из github.com/VitalySvyatyuk/pocket_option_trading_bot
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class MLSignalGenerator:
    """
    Генерация сигналов на основе ML модели (Random Forest)
    """
    
    def __init__(self, lookback: int = 200):
        """
        Args:
            lookback: Количество свечей для обучения модели
        """
        self.lookback = lookback
        self.model = None
        self.model_accuracy = 0.0
        self.last_prediction = None
        
    def calculate_indicators(self, candles: List[Dict]) -> pd.DataFrame:
        """
        Расчет индикаторов для ML модели
        
        Args:
            candles: Список свечей [{time, open, close, high, low}, ...]
            
        Returns:
            DataFrame с индикаторами
        """
        if len(candles) < 50:
            return pd.DataFrame()
        
        # Извлекаем данные
        df = pd.DataFrame(candles)
        df['close'] = df['close'].astype(float)
        df['open'] = df['open'].astype(float)
        df['high'] = df['high'].astype(float)
        df['low'] = df['low'].astype(float)
        
        # EMA 8 и EMA 3
        df['ema_long'] = df['close'].ewm(span=8, adjust=False).mean()
        df['ema_short'] = df['close'].ewm(span=3, adjust=False).mean()
        
        # Awesome Oscillator (упрощенный)
        df['ao'] = (df['close'].rolling(5).mean() - df['close'].rolling(34).mean())
        
        # Parabolic SAR (упрощенный)
        df['psar'] = self._calculate_psar(df)
        
        # CCI
        df['cci'] = self._calculate_cci(df)
        
        # MACD
        exp1 = df['close'].ewm(span=12, adjust=False).mean()
        exp2 = df['close'].ewm(span=26, adjust=False).mean()
        df['macd'] = exp1 - exp2
        df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
        
        return df
    
    def _calculate_psar(self, df: pd.DataFrame, period: int = 20) -> pd.Series:
        """Упрощенный Parabolic SAR"""
        high = df['high'].rolling(period).max()
        low = df['low'].rolling(period).min()
        return (high + low) / 2
    
    def _calculate_cci(self, df: pd.DataFrame, period: int = 20) -> pd.Series:
        """Commodity Channel Index"""
        tp = (df['high'] + df['low'] + df['close']) / 3
        sma = tp.rolling(period).mean()
        mad = tp.rolling(period).apply(lambda x: np.abs(x - x.mean()).mean())
        return (tp - sma) / (0.015 * mad)
    
    def prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Подготовка признаков для модели

        Returns:
            DataFrame с признаками и целевой переменной
        """
        features = pd.DataFrame()

        # EMA crossover (бычий и медвежий)
        features['ema_cross_bullish'] = (
            (df['ema_short'].shift(1) < df['ema_long'].shift(1)) &
            (df['ema_short'] > df['ema_long']) &
            (df['close'] > df['close'].shift(1))
        ).astype(int)

        features['ema_cross_bearish'] = (
            (df['ema_short'].shift(1) > df['ema_long'].shift(1)) &
            (df['ema_short'] < df['ema_long']) &
            (df['close'] < df['close'].shift(1))
        ).astype(int)

        # Awesome Oscillator
        features['ao_positive'] = (df['ao'] >= 0).astype(int)
        features['ao_increasing'] = (df['ao'] > df['ao'].shift(1)).astype(int)

        # PSAR reversal
        features['psar_below_price'] = (df['psar'] < df['close']).astype(int)
        features['psar_reversal'] = (df['psar'].diff() != 0).astype(int)

        # CCI
        features['cci_positive'] = (df['cci'] > 0).astype(int)
        features['cci_oversold'] = (df['cci'] < -100).astype(int)
        features['cci_overbought'] = (df['cci'] > 100).astype(int)

        # MACD
        features['macd_bullish'] = (df['macd'] >= df['macd_signal']).astype(int)
        features['macd_increasing'] = (df['macd'] > df['macd'].shift(1)).astype(int)

        # Дополнительные признаки для баланса
        features['price_above_ema_long'] = (df['close'] > df['ema_long']).astype(int)
        features['price_momentum'] = ((df['close'] - df['close'].shift(5)) / df['close'].shift(5) * 100).fillna(0)

        # Целевая переменная (СБАЛАНСИРОВАННАЯ)
        # 1 = CALL (цена выросла), 0 = PUT (цена упала)
        # Используем несколько периодов для лучшего баланса
        future_5 = df['close'].shift(-5)
        future_10 = df['close'].shift(-10)

        # CALL если цена выросла хотя бы в одном из периодов
        call_signal = (
            (future_5 > df['close']) |
            (future_10 > df['close'])
        )

        # PUT только если цена упала в ОБОИХ периодах (сильный сигнал)
        put_signal = (
            (future_5 <= df['close']) &
            (future_10 <= df['close'])
        )

        # Итоговая целевая: 1=CALL, 0=PUT
        features['target'] = call_signal.astype(int)
        # Для PUT сигналов используем отдельную колонку
        features['is_put'] = put_signal.astype(int)

        return features.dropna()
    
    def train(self, candles: List[Dict]) -> bool:
        """
        Обучение модели на исторических данных

        Args:
            candles: Список свечей для обучения

        Returns:
            True если обучение успешно
        """
        try:
            # Расчет индикаторов
            df = self.calculate_indicators(candles)
            if df.empty:
                logger.warning("Недостаточно данных для расчета индикаторов")
                return False

            # Подготовка признаков
            features = self.prepare_features(df)
            if len(features) < 50:
                logger.warning("Недостаточно признаков для обучения")
                return False

            # Разделение на train/test
            # Используем target (1=CALL, 0=PUT)
            X = features.iloc[:, :-2]  # Все колонки кроме target и is_put
            y = features['target']

            # Проверяем баланс классов
            class_balance = y.value_counts()
            logger.info(f"Баланс классов: CALL={class_balance.get(1, 0)}, PUT={class_balance.get(0, 0)}")

            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )

            # Обучение модели
            self.model = RandomForestClassifier(
                n_estimators=400,
                max_depth=10,
                random_state=42,
                n_jobs=-1,
                class_weight='balanced'  # Автоматический баланс классов
            )
            self.model.fit(X_train, y_train)

            # Оценка точности
            y_pred = self.model.predict(X_test)
            self.model_accuracy = accuracy_score(y_test, y_pred)

            # Сохраняем информацию о балансе для predict
            self._call_ratio = class_balance.get(1, 0) / len(y)
            self._put_ratio = class_balance.get(0, 0) / len(y)

            logger.info(f"ML модель обучена. Точность: {self.model_accuracy:.2f}, CALL%: {self._call_ratio:.2f}, PUT%: {self._put_ratio:.2f}")

            return self.model_accuracy > 0.50

        except Exception as e:
            logger.error(f"Ошибка обучения ML модели: {e}")
            return False
    
    def predict(self, candles: List[Dict]) -> Optional[Dict]:
        """
        Предсказание сигнала

        Args:
            candles: Последние свечи

        Returns:
            Сигнал {direction: 'call'|'put', confidence: float} или None
        """
        if self.model is None:
            logger.warning("ML модель не обучена")
            return None

        try:
            # Расчет индикаторов для последних свечей
            df = self.calculate_indicators(candles)
            if df.empty:
                return None

            # Подготовка признаков для последней свечи
            features = self.prepare_features(df)
            if features.empty:
                return None

            last_features = features.iloc[[-1]][features.columns[:-2]]  # Без target и is_put

            # Предсказание
            proba = self.model.predict_proba(last_features)[0]
            # Класс 0 = PUT, Класс 1 = CALL
            put_prob = proba[0]  # Вероятность PUT
            call_prob = proba[1]  # Вероятность CALL

            logger.info(f"ML предсказание: PUT={put_prob:.2f}, CALL={call_prob:.2f}")

            # Анализируем тренд для дополнительной проверки
            recent_closes = [c.get('close', 0) for c in candles[-10:]]
            if len(recent_closes) >= 10:
                trend_up = sum(1 for i in range(1, len(recent_closes)) if recent_closes[i] > recent_closes[i-1])
                trend_down = 10 - trend_up
                is_uptrend = trend_up > trend_down
            else:
                is_uptrend = call_prob > put_prob

            # Генерация сигнала с учетом тренда и баланса
            # Снижаем порог до 50% для лучшего обнаружения сигналов
            if call_prob > 0.50:
                # CALL сигнал - усиливаем если тренд восходящий
                adjusted_confidence = call_prob
                if is_uptrend:
                    adjusted_confidence = min(0.95, call_prob * 1.1)  # +10% если трен совпадает

                return {
                    'direction': 'call',
                    'confidence': adjusted_confidence,
                    'ml_accuracy': self.model_accuracy,
                    'trend': 'bullish' if is_uptrend else 'bearish'
                }
            elif put_prob > 0.50:
                # PUT сигнал - усиливаем если тренд нисходящий
                adjusted_confidence = put_prob
                if not is_uptrend:
                    adjusted_confidence = min(0.95, put_prob * 1.1)  # +10% если трен совпадает

                return {
                    'direction': 'put',
                    'confidence': adjusted_confidence,
                    'ml_accuracy': self.model_accuracy,
                    'trend': 'bearish' if not is_uptrend else 'bullish'
                }
            else:
                logger.info(f"ML: Низкая уверенность (PUT={put_prob:.2f}, CALL={call_prob:.2f})")
                return None

        except Exception as e:
            logger.error(f"Ошибка предсказания ML модели: {e}")
            return None


# Singleton instance
_ml_generator: Optional[MLSignalGenerator] = None


def get_ml_generator() -> MLSignalGenerator:
    """Получение экземпляра ML генератора"""
    global _ml_generator
    if _ml_generator is None:
        _ml_generator = MLSignalGenerator(lookback=200)
    return _ml_generator
