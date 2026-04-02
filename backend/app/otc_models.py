# Pocket Option OTC Signal Analyzer
# Анализ сигналов для OTC рынка на основе паттернов

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base
from enum import Enum


class SignalType(str, Enum):
    CALL = "call"
    PUT = "put"


class SignalStrength(str, Enum):
    STRONG = "strong"      # 90-100% уверенность
    MEDIUM = "medium"      # 70-89% уверенность
    WEAK = "weak"          # 50-69% уверенность


class TrendDirection(str, Enum):
    UP = "up"
    DOWN = "down"
    SIDEWAYS = "sideways"


class OTCSignal(Base):
    """Сигналы для OTC торговли"""
    __tablename__ = "otc_signals"

    id = Column(Integer, primary_key=True, index=True)
    
    # Информация об активе
    symbol = Column(String(50), nullable=False, index=True)  # EURUSD_OTC, GBPUSD_OTC
    asset_type = Column(String(20), default="OTC")  # OTC, REGULAR
    
    # Параметры сигнала
    signal_type = Column(String(10), nullable=False)  # call, put
    strength = Column(String(20), default="medium")  # strong, medium, weak
    confidence = Column(Float, default=0.0)  # Уверенность 0-100%
    
    # Технические индикаторы
    rsi = Column(Float, nullable=True)  # RSI значение
    macd = Column(Float, nullable=True)  # MACD значение
    macd_signal = Column(Float, nullable=True)  # MACD signal line
    bollinger_upper = Column(Float, nullable=True)
    bollinger_middle = Column(Float, nullable=True)
    bollinger_lower = Column(Float, nullable=True)
    
    # Анализ тренда
    trend_short = Column(String(20))  # Краткосрочный тренд
    trend_medium = Column(String(20))  # Среднесрочный тренд
    trend_long = Column(String(20))  # Долгосрочный тренд
    
    # Цены
    current_price = Column(Float, nullable=False)
    entry_price = Column(Float, nullable=True)
    target_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    
    # Время
    timeframe = Column(String(10), default="1m")  # 1m, 5m, 15m
    expiration_minutes = Column(Integer, default=5)
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)
    
    # Статус
    status = Column(String(20), default="active")  # active, completed, cancelled
    result = Column(String(10), nullable=True)  # win, loss, draw
    
    # Дополнительные данные
    pattern_detected = Column(String(100), nullable=True)  # Название паттерна
    notes = Column(Text, nullable=True)
    
    # История цен для анализа
    price_history = Column(Text, nullable=True)  # JSON с историей цен


class MarketAnalysis(Base):
    """Рыночный анализ для каждого актива"""
    __tablename__ = "market_analysis"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    timeframe = Column(String(10), default="1m")
    
    # Текущая цена
    current_price = Column(Float, nullable=False)
    price_change = Column(Float, default=0.0)  # Изменение цены
    price_change_percent = Column(Float, default=0.0)
    
    # Индикаторы
    rsi_14 = Column(Float, nullable=True)
    rsi_signal = Column(String(20), nullable=True)  # overbought, oversold, neutral
    
    macd_value = Column(Float, nullable=True)
    macd_signal_value = Column(Float, nullable=True)
    macd_histogram = Column(Float, nullable=True)
    macd_trend = Column(String(20), nullable=True)  # bullish, bearish, neutral
    
    # Bollinger Bands
    bb_upper = Column(Float, nullable=True)
    bb_middle = Column(Float, nullable=True)
    bb_lower = Column(Float, nullable=True)
    bb_width = Column(Float, nullable=True)  # Ширина полос
    bb_position = Column(Float, nullable=True)  # Позиция цены (0-1)
    
    # Скользящие средние
    sma_20 = Column(Float, nullable=True)
    sma_50 = Column(Float, nullable=True)
    sma_200 = Column(Float, nullable=True)
    ema_12 = Column(Float, nullable=True)
    ema_26 = Column(Float, nullable=True)
    
    # Объемы
    volume = Column(Float, default=0.0)
    avg_volume = Column(Float, default=0.0)
    
    # Волатильность
    volatility = Column(Float, default=0.0)
    atr = Column(Float, nullable=True)  # Average True Range
    
    # Тренд
    trend_direction = Column(String(20), nullable=True)
    trend_strength = Column(Float, default=0.0)  # 0-100%
    
    # Поддержка и сопротивление
    support_level = Column(Float, nullable=True)
    resistance_level = Column(Float, nullable=True)
    
    # Время
    analyzed_at = Column(DateTime, server_default=func.now())
    
    # Сырые данные
    candles_data = Column(Text, nullable=True)  # JSON с данными свечей


class SignalPattern(Base):
    """Обнаруженные паттерны"""
    __tablename__ = "signal_patterns"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(50), nullable=False)
    
    # Тип паттерна
    pattern_type = Column(String(50), nullable=False)  # engulfing, hammer, doji, etc.
    pattern_category = Column(String(20))  # reversal, continuation
    
    # Направление
    signal_direction = Column(String(10))  # call, put
    
    # Сила паттерна
    strength = Column(Float, default=0.0)  # 0-100%
    reliability = Column(Float, default=0.0)  # Историческая надежность
    
    # Цены
    detected_at_price = Column(Float, nullable=False)
    
    # Время
    detected_at = Column(DateTime, server_default=func.now())
    timeframe = Column(String(10), default="1m")
    
    # Описание
    description = Column(Text, nullable=True)
