"""
ML Signal Generator - Random Forest Classifier с расширенными индикаторами
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
    с расширенными техническими индикаторами
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
        Расчет расширенных индикаторов для ML модели

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

        # === TREND INDICATORS ===
        # EMA (разные периоды)
        df['ema_3'] = df['close'].ewm(span=3, adjust=False).mean()
        df['ema_8'] = df['close'].ewm(span=8, adjust=False).mean()
        df['ema_13'] = df['close'].ewm(span=13, adjust=False).mean()
        df['ema_21'] = df['close'].ewm(span=21, adjust=False).mean()
        df['ema_55'] = df['close'].ewm(span=55, adjust=False).mean()

        # SMA
        df['sma_10'] = df['close'].rolling(10).mean()
        df['sma_20'] = df['close'].rolling(20).mean()
        df['sma_50'] = df['close'].rolling(50).mean()

        # === MOMENTUM INDICATORS ===
        # RSI
        df['rsi_14'] = self._calculate_rsi(df['close'], 14)
        df['rsi_7'] = self._calculate_rsi(df['close'], 7)

        # Stochastic
        stoch_k, stoch_d = self._calculate_stochastic(df)
        df['stoch_k'] = stoch_k
        df['stoch_d'] = stoch_d

        # MACD (разные периоды)
        df['macd_12_26'], df['macd_signal'], df['macd_hist'] = self._calculate_macd(df['close'])

        # CCI
        df['cci_20'] = self._calculate_cci(df, 20)
        df['cci_14'] = self._calculate_cci(df, 14)

        # Williams %R
        df['williams_r'] = self._calculate_williams_r(df, 14)

        # Awesome Oscillator
        df['ao'] = self._calculate_ao(df)

        # === VOLATILITY INDICATORS ===
        # Bollinger Bands
        df['bb_upper'], df['bb_middle'], df['bb_lower'], df['bb_width'] = self._calculate_bollinger_bands(df)

        # ATR (Average True Range)
        df['atr_14'] = self._calculate_atr(df, 14)

        # === VOLUME INDICATORS (используем range как прокси объема) ===
        df['range'] = df['high'] - df['low']
        df['body'] = abs(df['close'] - df['open'])
        df['upper_shadow'] = df['high'] - df[['open', 'close']].max(axis=1)
        df['lower_shadow'] = df[['open', 'close']].min(axis=1) - df['low']

        # Parabolic SAR (упрощенный)
        df['psar'] = self._calculate_psar(df)

        # === PRICE ACTION ===
        df['return_1'] = df['close'].pct_change(1)
        df['return_3'] = df['close'].pct_change(3)
        df['return_5'] = df['close'].pct_change(5)
        df['return_10'] = df['close'].pct_change(10)

        return df

    def _calculate_rsi(self, series: pd.Series, period: int) -> pd.Series:
        """RSI calculation"""
        delta = series.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))

    def _calculate_stochastic(self, df: pd.DataFrame, period: int = 14) -> Tuple[pd.Series, pd.Series]:
        """Stochastic Oscillator"""
        low_min = df['low'].rolling(period).min()
        high_max = df['high'].rolling(period).max()
        k = 100 * (df['close'] - low_min) / (high_max - low_min)
        d = k.rolling(3).mean()
        return k, d

    def _calculate_macd(self, series: pd.Series) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """MACD calculation"""
        exp1 = series.ewm(span=12, adjust=False).mean()
        exp2 = series.ewm(span=26, adjust=False).mean()
        macd = exp1 - exp2
        signal = macd.ewm(span=9, adjust=False).mean()
        histogram = macd - signal
        return macd, signal, histogram

    def _calculate_cci(self, df: pd.DataFrame, period: int = 20) -> pd.Series:
        """Commodity Channel Index"""
        tp = (df['high'] + df['low'] + df['close']) / 3
        sma = tp.rolling(period).mean()
        mad = tp.rolling(period).apply(lambda x: np.abs(x - x.mean()).mean())
        return (tp - sma) / (0.015 * mad)

    def _calculate_williams_r(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Williams %R"""
        highest_high = df['high'].rolling(period).max()
        lowest_low = df['low'].rolling(period).min()
        return -100 * (highest_high - df['close']) / (highest_high - lowest_low)

    def _calculate_ao(self, df: pd.DataFrame) -> pd.Series:
        """Awesome Oscillator"""
        median = (df['high'] + df['low']) / 2
        return median.rolling(5).mean() - median.rolling(34).mean()

    def _calculate_bollinger_bands(self, df: pd.DataFrame, period: int = 20) -> Tuple:
        """Bollinger Bands"""
        sma = df['close'].rolling(period).mean()
        std = df['close'].rolling(period).std()
        upper = sma + 2 * std
        lower = sma - 2 * std
        width = (upper - lower) / sma
        return upper, sma, lower, width

    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Average True Range"""
        high_low = df['high'] - df['low']
        high_close = abs(df['high'] - df['close'].shift())
        low_close = abs(df['low'] - df['close'].shift())
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        return tr.rolling(period).mean()

    def _calculate_psar(self, df: pd.DataFrame, period: int = 20) -> pd.Series:
        """Упрощенный Parabolic SAR"""
        high = df['high'].rolling(period).max()
        low = df['low'].rolling(period).min()
        return (high + low) / 2
    
    def prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Подготовка признаков для модели с использованием всех индикаторов

        Returns:
            DataFrame с признаками и целевой переменной
        """
        features = pd.DataFrame()

        # === TREND FEATURES ===
        # EMA crossovers (разные комбинации)
        features['ema_3_above_8'] = (df['ema_3'] > df['ema_8']).astype(int)
        features['ema_8_above_21'] = (df['ema_8'] > df['ema_21']).astype(int)
        features['ema_13_above_55'] = (df['ema_13'] > df['ema_55']).astype(int)
        features['price_above_ema_21'] = (df['close'] > df['ema_21']).astype(int)
        features['price_above_ema_55'] = (df['close'] > df['ema_55']).astype(int)

        # SMA crossovers
        features['sma_10_above_20'] = (df['sma_10'] > df['sma_20']).astype(int)
        features['price_above_sma_20'] = (df['close'] > df['sma_20']).astype(int)
        features['price_above_sma_50'] = (df['close'] > df['sma_50']).astype(int)

        # === MOMENTUM FEATURES ===
        # RSI
        features['rsi_14_oversold'] = (df['rsi_14'] < 30).astype(int)
        features['rsi_14_overbought'] = (df['rsi_14'] > 70).astype(int)
        features['rsi_7_oversold'] = (df['rsi_7'] < 20).astype(int)
        features['rsi_7_overbought'] = (df['rsi_7'] > 80).astype(int)
        features['rsi_14_value'] = df['rsi_14'] / 100  # Нормализация 0-1

        # Stochastic
        features['stoch_k_oversold'] = (df['stoch_k'] < 20).astype(int)
        features['stoch_k_overbought'] = (df['stoch_k'] > 80).astype(int)
        features['stoch_cross_bullish'] = ((df['stoch_k'] > df['stoch_d']) & (df['stoch_k'].shift(1) < df['stoch_d'].shift(1))).astype(int)
        features['stoch_cross_bearish'] = ((df['stoch_k'] < df['stoch_d']) & (df['stoch_k'].shift(1) > df['stoch_d'].shift(1))).astype(int)

        # MACD
        features['macd_bullish'] = (df['macd_12_26'] > df['macd_signal']).astype(int)
        features['macd_increasing'] = (df['macd_hist'] > df['macd_hist'].shift(1)).astype(int)
        features['macd_histogram_positive'] = (df['macd_hist'] > 0).astype(int)

        # CCI
        features['cci_20_oversold'] = (df['cci_20'] < -100).astype(int)
        features['cci_20_overbought'] = (df['cci_20'] > 100).astype(int)
        features['cci_14_value'] = df['cci_14'].clip(-200, 200) / 200  # Нормализация

        # Williams %R
        features['williams_r_oversold'] = (df['williams_r'] < -80).astype(int)
        features['williams_r_overbought'] = (df['williams_r'] > -20).astype(int)

        # Awesome Oscillator
        features['ao_positive'] = (df['ao'] > 0).astype(int)
        features['ao_increasing'] = (df['ao'] > df['ao'].shift(1)).astype(int)

        # === VOLATILITY FEATURES ===
        # Bollinger Bands
        features['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower']).replace(0, 1)
        features['bb_touch_upper'] = (df['close'] >= df['bb_upper'] * 0.99).astype(int)
        features['bb_touch_lower'] = (df['close'] <= df['bb_lower'] * 1.01).astype(int)
        features['bb_squeeze'] = (df['bb_width'] < df['bb_width'].rolling(20).mean() * 0.8).astype(int)

        # ATR
        features['atr_relative'] = df['atr_14'] / df['close']
        features['atr_increasing'] = (df['atr_14'] > df['atr_14'].shift(1)).astype(int)

        # === CANDLE PATTERNS ===
        # Тела и тени
        features['doji'] = (df['body'] / df['range'].replace(0, 1) < 0.1).astype(int)
        features['hammer'] = ((df['lower_shadow'] > 2 * df['body']) & (df['upper_shadow'] < df['body'] * 0.5)).astype(int)
        features['shooting_star'] = ((df['upper_shadow'] > 2 * df['body']) & (df['lower_shadow'] < df['body'] * 0.5)).astype(int)

        # Направление свечей
        features['bullish_candle'] = (df['close'] > df['open']).astype(int)
        features['bearish_candle'] = (df['close'] < df['open']).astype(int)

        # === PRICE ACTION FEATURES ===
        # Возвраты
        features['return_1'] = df['return_1'].clip(-0.05, 0.05)
        features['return_3'] = df['return_3'].clip(-0.1, 0.1)
        features['return_5'] = df['return_5'].clip(-0.15, 0.15)

        # Последовательности свечей
        features['3_bullish'] = (
            (df['close'] > df['open']) &
            (df['close'].shift(1) > df['open'].shift(1)) &
            (df['close'].shift(2) > df['open'].shift(2))
        ).astype(int)

        features['3_bearish'] = (
            (df['close'] < df['open']) &
            (df['close'].shift(1) < df['open'].shift(1)) &
            (df['close'].shift(2) < df['open'].shift(2))
        ).astype(int)

        # PSAR
        features['psar_below_price'] = (df['psar'] < df['close']).astype(int)
        features['psar_reversal'] = (df['psar'].diff() != 0).astype(int)

        # === Целевая переменная (СБАЛАНСИРОВАННАЯ) ===
        # 1 = CALL (цена выросла), 0 = PUT (цена упала)
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

            # Обучение модели (улучшенная)
            self.model = RandomForestClassifier(
                n_estimators=500,           # Больше деревьев
                max_depth=12,               # Немного глубже
                min_samples_split=5,        # Мин. образцов для разделения
                min_samples_leaf=2,         # Мин. образцов в листе
                max_features='sqrt',        # Кол-во признаков для сплита
                random_state=42,
                n_jobs=-1,
                class_weight='balanced',    # Автоматический баланс классов
                bootstrap=True              # Bootstrap выборка
            )
            self.model.fit(X_train, y_train)

            # Оценка точности
            y_pred = self.model.predict(X_test)
            self.model_accuracy = accuracy_score(y_test, y_pred)

            # Сохраняем информацию о балансе для predict
            self._call_ratio = class_balance.get(1, 0) / len(y)
            self._put_ratio = class_balance.get(0, 0) / len(y)

            # Feature importance
            if hasattr(self.model, 'feature_importances_'):
                important_features = sorted(
                    zip(X.columns, self.model.feature_importances_),
                    key=lambda x: x[1],
                    reverse=True
                )[:10]
                logger.info(f"Top 10 важных признаков: {important_features}")

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
