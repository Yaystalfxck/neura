# Pocket Option Trading Strategies
# Торговые стратегии на основе https://github.com/VitalySvyatyuk/pocket_option_trading_bot
# Мартингейл, Технические индикаторы, Machine Learning

import numpy as np
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class SignalType(str, Enum):
    """Тип сигнала"""
    CALL = "call"  # Покупка (вверх)
    PUT = "put"    # Продажа (вниз)
    NEUTRAL = "neutral"


class SignalStrength(str, Enum):
    """Сила сигнала"""
    STRONG = "strong"
    MEDIUM = "medium"
    WEAK = "weak"


class TradingStrategy:
    """Базовый класс торговой стратегии"""

    def __init__(self, name: str):
        self.name = name
        self.min_confidence = 60.0

    def generate_signal(self, prices: List[float], **kwargs) -> Optional[Dict]:
        """Генерация торгового сигнала"""
        raise NotImplementedError


class MartingaleStrategy(TradingStrategy):
    """
    Стратегия Мартингейла
    Удвоение ставки после проигрыша для отыгрывания
    https://github.com/VitalySvyatyuk/pocket_option_trading_bot#martingale
    """

    def __init__(self, base_amount: float = 1.0, multiplier: float = 2.0, max_steps: int = 5):
        super().__init__("Martingale")
        self.base_amount = base_amount
        self.multiplier = multiplier
        self.max_steps = max_steps
        self.current_step = 0
        self.consecutive_losses = 0

    def calculate_next_bet(self) -> float:
        """
        Расчет следующей ставки по Мартингейлу
        
        Returns:
            float: Сумма следующей ставки
        """
        bet = self.base_amount * (self.multiplier ** self.current_step)
        return round(bet, 2)

    def record_win(self):
        """Запись выигрыша - сброс прогрессии"""
        logger.info(f"✅ Выигрыш на шаге {self.current_step}. Сброс.")
        self.current_step = 0
        self.consecutive_losses = 0

    def record_loss(self):
        """Запись проигрыша - увеличение шага"""
        self.consecutive_losses += 1
        if self.current_step < self.max_steps - 1:
            self.current_step += 1
            logger.warning(f"❌ Проигрыш. Шаг {self.current_step}, следующая ставка: ${self.calculate_next_bet()}")
        else:
            logger.error(f"❌ Достигнут макс. шаг Мартингейла ({self.max_steps}). Сброс.")
            self.current_step = 0

    def generate_signal(self, prices: List[float], **kwargs) -> Optional[Dict]:
        """
        Мартингейл использует базовый сигнал (RSI) + прогрессия ставок
        """
        if len(prices) < 14:
            return None

        # Расчет RSI
        rsi = self._calculate_rsi(prices)
        
        # Проверка подтверждения: цена уже восстанавливается?
        recent_closes = prices[-3:]  # Последние 3 свечи
        is_price_bouncing_up = len(recent_closes) >= 2 and recent_closes[-1] > recent_closes[-2]
        is_price_recovering_down = len(recent_closes) >= 2 and recent_closes[-1] < recent_closes[-2]
        
        signal_type = None
        confidence = 0.0

        # CALL: Требуем RSI < 30 И цена восстанавливается (не просто низкая)
        if rsi < 30 and is_price_bouncing_up:  
            signal_type = SignalType.CALL
            confidence = 72.0  # Усилена уверенность за подтверждение
        # PUT: Требуем RSI > 70 И цена падает (не просто высокая)
        elif rsi > 70 and is_price_recovering_down:
            signal_type = SignalType.PUT
            confidence = 72.0

        if not signal_type:
            return None

        current_bet = self.calculate_next_bet()

        return {
            "strategy": self.name,
            "signal_type": signal_type.value,
            "strength": SignalStrength.MEDIUM.value,
            "confidence": confidence,
            "bet_amount": current_bet,
            "martingale_step": self.current_step,
            "consecutive_losses": self.consecutive_losses,
            "indicators": {
                "rsi": round(rsi, 2)
            },
            "timestamp": datetime.utcnow().isoformat()
        }

    def _calculate_rsi(self, prices: List[float], period: int = 14) -> float:
        """Расчет RSI"""
        if len(prices) < period + 1:
            return 50.0

        deltas = np.diff(prices[-period-1:])
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)

        avg_gain = np.mean(gains) if len(gains) > 0 else 0
        avg_loss = np.mean(losses) if len(losses) > 0 else 0

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))


class IndicatorStrategy(TradingStrategy):
    """
    Стратегия на основе технических индикаторов
    PSAR, CCI, MACD, AO (Awesome Oscillator)
    https://github.com/VitalySvyatyuk/pocket_option_trading_bot#indicators
    """

    def __init__(self):
        super().__init__("Indicators")
        
        # Параметры индикаторов
        self.rsi_period = 14
        self.macd_fast = 12
        self.macd_slow = 26
        self.macd_signal = 9
        self.cci_period = 20
        self.psar_step = 0.02
        self.psar_max = 0.2
        self.ao_fast = 5
        self.ao_slow = 34

    def generate_signal(self, prices: List[float], **kwargs) -> Optional[Dict]:
        """
        Генерация сигнала на основе комбинации индикаторов
        """
        if len(prices) < 50:
            return None

        # Расчет всех индикаторов
        rsi = self._calculate_rsi(prices)
        macd_data = self._calculate_macd(prices)
        cci = self._calculate_cci(prices)
        ao = self._calculate_ao(prices)
        
        # Комплексная оценка
        confidence = 50.0
        signals = []

        # RSI вклад
        if rsi < 30:
            confidence += 15
            signals.append("RSI oversold")
        elif rsi > 70:
            confidence -= 15
            signals.append("RSI overbought")

        # MACD вклад
        if macd_data["trend"] == "bullish":
            confidence += 15
            signals.append("MACD bullish")
        elif macd_data["trend"] == "bearish":
            confidence -= 15
            signals.append("MACD bearish")

        # CCI вклад
        if cci < -100:
            confidence += 10
            signals.append("CCI oversold")
        elif cci > 100:
            confidence -= 10
            signals.append("CCI overbought")

        # AO вклад
        if ao > 0:
            confidence += 10
            signals.append("AO positive")
        elif ao < 0:
            confidence -= 10
            signals.append("AO negative")

        # Определение направления
        signal_type = None
        if confidence >= self.min_confidence:
            signal_type = SignalType.CALL
        elif confidence <= (100 - self.min_confidence):
            signal_type = SignalType.PUT

        if not signal_type:
            return None

        # Сила сигнала
        if confidence >= 80:
            strength = SignalStrength.STRONG
        elif confidence >= 65:
            strength = SignalStrength.MEDIUM
        else:
            strength = SignalStrength.WEAK

        return {
            "strategy": self.name,
            "signal_type": signal_type.value,
            "strength": strength.value,
            "confidence": round(min(max(confidence, 0), 100), 2),
            "indicators": {
                "rsi": round(rsi, 2),
                "macd_line": round(macd_data["line"], 5),
                "macd_signal": round(macd_data["signal"], 5),
                "macd_histogram": round(macd_data["histogram"], 5),
                "cci": round(cci, 2),
                "ao": round(ao, 5)
            },
            "signals": signals,
            "timestamp": datetime.utcnow().isoformat()
        }

    def _calculate_rsi(self, prices: List[float], period: int = 14) -> float:
        """RSI calculation"""
        if len(prices) < period + 1:
            return 50.0

        deltas = np.diff(prices[-period-1:])
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)

        avg_gain = np.mean(gains)
        avg_loss = np.mean(losses)

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))

    def _calculate_macd(self, prices: List[float]) -> Dict:
        """MACD calculation"""
        if len(prices) < self.macd_slow + self.macd_signal:
            return {"line": 0, "signal": 0, "histogram": 0, "trend": "neutral"}

        ema_fast = self._ema(prices, self.macd_fast)
        ema_slow = self._ema(prices, self.macd_slow)
        macd_line = ema_fast - ema_slow

        # Signal line
        macd_values = []
        for i in range(self.macd_slow, len(prices)):
            fast = self._ema(prices[:i+1], self.macd_fast)
            slow = self._ema(prices[:i+1], self.macd_slow)
            macd_values.append(fast - slow)

        signal_line = self._ema(macd_values, self.macd_signal) if macd_values else 0
        histogram = macd_line - signal_line

        trend = "bullish" if histogram > 0 else "bearish" if histogram < 0 else "neutral"

        return {
            "line": macd_line,
            "signal": signal_line,
            "histogram": histogram,
            "trend": trend
        }

    def _calculate_cci(self, prices: List[float], period: int = 20) -> float:
        """CCI (Commodity Channel Index) calculation"""
        if len(prices) < period:
            return 0.0

        # Для простоты используем close как TP (Typical Price)
        tp = prices[-period:]
        sma = sum(tp) / period
        mean_dev = sum(abs(p - sma) for p in tp) / period

        if mean_dev == 0:
            return 0.0

        cci = (tp[-1] - sma) / (0.015 * mean_dev)
        return cci

    def _calculate_ao(self, prices: List[float]) -> float:
        """Awesome Oscillator calculation"""
        if len(prices) < self.ao_slow:
            return 0.0

        # AO = SMA(5) - SMA(34) of median prices
        fast_sma = sum(prices[-self.ao_fast:]) / self.ao_fast
        slow_sma = sum(prices[-self.ao_slow:]) / self.ao_slow

        return fast_sma - slow_sma

    def _ema(self, prices: List[float], period: int) -> float:
        """Exponential Moving Average"""
        if len(prices) < period:
            return np.mean(prices) if prices else 0.0

        multiplier = 2 / (period + 1)
        ema = sum(prices[:period]) / period

        for price in prices[period:]:
            ema = (price - ema) * multiplier + ema

        return ema


class MLStrategy(TradingStrategy):
    """
    Стратегия на основе Machine Learning (Random Forest)
    https://github.com/VitalySvyatyuk/pocket_option_trading_bot#ml
    """

    def __init__(self):
        super().__init__("Machine Learning")
        self.model = None
        self.feature_names = [
            "rsi", "macd", "cci", "ao",
            "price_change", "volatility",
            "trend_strength"
        ]
        self.is_trained = False

    def generate_signal(self, prices: List[float], **kwargs) -> Optional[Dict]:
        """
        Генерация сигнала на основе ML модели
        В production здесь должна быть загруженная модель
        """
        if len(prices) < 50:
            return None

        # Извлекаем фичи
        features = self._extract_features(prices)

        # Если модель не обучена, используем эвристический подход
        if not self.is_trained:
            return self._heuristic_signal(features, prices)

        # Предсказание моделью
        try:
            import numpy as np
            prediction = self.model.predict([features])[0]
            probability = self.model.predict_proba([features])[0]

            signal_type = SignalType.CALL if prediction == 1 else SignalType.PUT
            confidence = max(probability) * 100

            return {
                "strategy": self.name,
                "signal_type": signal_type.value,
                "strength": self._get_strength(confidence),
                "confidence": round(confidence, 2),
                "features": dict(zip(self.feature_names, features)),
                "ml_probability": probability.tolist(),
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"❌ ML prediction error: {e}")
            return self._heuristic_signal(features, prices)

    def _extract_features(self, prices: List[float]) -> List[float]:
        """Извлечение признаков для ML модели"""
        # RSI
        rsi = self._calculate_rsi(prices)
        
        # MACD
        macd = self._calculate_macd(prices)
        
        # Price change
        price_change = (prices[-1] - prices[-10]) / prices[-10] * 100 if len(prices) >= 10 else 0
        
        # Volatility
        returns = np.diff(prices) / prices[:-1]
        volatility = np.std(returns) * 100 if len(returns) > 0 else 0
        
        # Trend strength
        trend = self._detect_trend(prices)

        return [
            rsi,
            macd,
            0,  # CCI (placeholder)
            0,  # AO (placeholder)
            price_change,
            volatility,
            trend[1]
        ]

    def _heuristic_signal(self, features: List[float], prices: List[float]) -> Optional[Dict]:
        """Эвристический сигнал когда модель не обучена"""
        rsi = features[0]
        macd = features[1]
        price_change = features[4]

        confidence = 50.0
        signals = []

        if rsi < 30:
            confidence += 20
            signals.append("RSI oversold")
        elif rsi > 70:
            confidence -= 20
            signals.append("RSI overbought")

        if macd > 0:
            confidence += 15
            signals.append("MACD positive")
        else:
            confidence -= 15
            signals.append("MACD negative")

        if price_change > 0.5:
            confidence += 10
            signals.append("Price uptrend")
        elif price_change < -0.5:
            confidence -= 10
            signals.append("Price downtrend")

        signal_type = None
        if confidence >= 60:
            signal_type = SignalType.CALL
        elif confidence <= 40:
            signal_type = SignalType.PUT

        if not signal_type:
            return None

        return {
            "strategy": self.name,
            "signal_type": signal_type.value,
            "strength": self._get_strength(confidence),
            "confidence": round(confidence, 2),
            "features": dict(zip(self.feature_names, features)),
            "signals": signals,
            "note": "Heuristic mode (model not trained)",
            "timestamp": datetime.utcnow().isoformat()
        }

    def _get_strength(self, confidence: float) -> str:
        """Определение силы сигнала"""
        if confidence >= 80:
            return SignalStrength.STRONG.value
        elif confidence >= 65:
            return SignalStrength.MEDIUM.value
        return SignalStrength.WEAK.value

    def _calculate_rsi(self, prices: List[float], period: int = 14) -> float:
        """RSI calculation"""
        if len(prices) < period + 1:
            return 50.0

        deltas = np.diff(prices[-period-1:])
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)

        avg_gain = np.mean(gains) if len(gains) > 0 else 0
        avg_loss = np.mean(losses) if len(losses) > 0 else 0

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))

    def _calculate_macd(self, prices: List[float]) -> float:
        """MACD line calculation"""
        if len(prices) < 26:
            return 0.0

        ema_fast = self._ema(prices, 12)
        ema_slow = self._ema(prices, 26)
        return ema_fast - ema_slow

    def _detect_trend(self, prices: List[float], lookback: int = 20) -> Tuple[str, float]:
        """Определение тренда"""
        if len(prices) < lookback:
            return "neutral", 0.0

        recent = prices[-lookback:]
        x = np.arange(len(recent))
        slope = np.polyfit(x, recent, 1)[0]

        avg_price = np.mean(recent)
        normalized_slope = (slope / avg_price) * 1000 if avg_price > 0 else 0

        if normalized_slope > 0.5:
            return "up", min(abs(normalized_slope) * 2, 100)
        elif normalized_slope < -0.5:
            return "down", min(abs(normalized_slope) * 2, 100)
        return "neutral", min(abs(normalized_slope) * 2, 100)

    def _ema(self, prices: List[float], period: int) -> float:
        """EMA calculation"""
        if len(prices) < period:
            return np.mean(prices) if prices else 0.0

        multiplier = 2 / (period + 1)
        ema = sum(prices[:period]) / period

        for price in prices[period:]:
            ema = (price - ema) * multiplier + ema

        return ema

    def train_model(self, historical_data: List[Dict], labels: List[int]):
        """
        Обучение ML модели
        
        Args:
            historical_data: Исторические данные с фичами
            labels: Метки (1=call, 0=put)
        """
        try:
            from sklearn.ensemble import RandomForestClassifier
            
            X = np.array([self._extract_features(d["prices"]) for d in historical_data])
            y = np.array(labels)

            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42
            )
            self.model.fit(X, y)
            self.is_trained = True
            
            logger.info(f"✅ ML модель обучена на {len(historical_data)} примерах")
            
        except Exception as e:
            logger.error(f"❌ Ошибка обучения модели: {e}")


_ml_strategy_singleton: Optional[MLStrategy] = None


def get_ml_strategy() -> MLStrategy:
    """Singleton ML strategy used for online retraining."""
    global _ml_strategy_singleton
    if _ml_strategy_singleton is None:
        _ml_strategy_singleton = MLStrategy()
    return _ml_strategy_singleton


# Фабрика стратегий
def get_strategy(strategy_name: str, **kwargs) -> TradingStrategy:
    """
    Фабрика для создания стратегий
    
    Args:
        strategy_name: Название стратегии ("martingale", "indicators", "ml")
        
    Returns:
        TradingStrategy: Экземпляр стратегии
    """
    strategies = {
        "martingale": lambda: MartingaleStrategy(
            base_amount=kwargs.get("base_amount", 1.0),
            multiplier=kwargs.get("multiplier", 2.0),
            max_steps=kwargs.get("max_steps", 5)
        ),
        "indicators": lambda: IndicatorStrategy(),
        "ml": get_ml_strategy
    }

    strategy_func = strategies.get(strategy_name.lower())
    if not strategy_func:
        raise ValueError(f"Unknown strategy: {strategy_name}")

    return strategy_func()
