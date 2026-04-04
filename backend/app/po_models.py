# Pocket Option Signal Models
# SQLAlchemy модели для сигналов Pocket Option
# На основе https://github.com/VitalySvyatyuk/pocket_option_trading_bot

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.database import Base


class SignalDirection(str, enum.Enum):
    """Направление сигнала"""
    CALL = "call"
    PUT = "put"


class SignalStrength(str, enum.Enum):
    """Сила сигнала"""
    STRONG = "strong"
    MEDIUM = "medium"
    WEAK = "weak"


class SignalStatus(str, enum.Enum):
    """Статус сигнала"""
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SignalResult(str, enum.Enum):
    """Результат сигнала"""
    WIN = "win"
    LOSS = "loss"
    DRAW = "draw"
    PENDING = "pending"


class StrategyType(str, enum.Enum):
    """Тип стратегии"""
    MARTINGALE = "martingale"
    INDICATORS = "indicators"
    MACHINE_LEARNING = "machine_learning"
    CUSTOM = "custom"


class POSignal(Base):
    """
    Модель торгового сигнала Pocket Option
    Хранит сгенерированные сигналы с индикаторами и метаданными
    """
    __tablename__ = "po_signals"

    id = Column(Integer, primary_key=True, index=True)
    
    # Основная информация
    signal_type = Column(SQLEnum(SignalDirection), nullable=False)  # call/put
    strength = Column(SQLEnum(SignalStrength), default=SignalStrength.MEDIUM)
    confidence = Column(Float, default=50.0)  # Уверенность 0-100%
    
    # Параметры сделки
    asset_id = Column(Integer, nullable=True)  # ID актива (необязательно)
    asset_name = Column(String(50), nullable=False)  # Название (EUR/USD)
    amount = Column(Float, nullable=False, default=1.0)  # Сумма сделки
    timeframe = Column(Integer, nullable=False, default=60)  # Время экспирации в секундах
    
    # Цены
    entry_price = Column(Float, nullable=True)  # Цена входа
    current_price = Column(Float, nullable=True)  # Текущая цена на момент сигнала
    target_price = Column(Float, nullable=True)  # Целевая цена
    stop_loss = Column(Float, nullable=True)  # Стоп-лосс
    
    # Индикаторы на момент сигнала
    rsi = Column(Float, nullable=True)
    macd_line = Column(Float, nullable=True)
    macd_signal = Column(Float, nullable=True)
    macd_histogram = Column(Float, nullable=True)
    cci = Column(Float, nullable=True)
    ao = Column(Float, nullable=True)
    bollinger_upper = Column(Float, nullable=True)
    bollinger_middle = Column(Float, nullable=True)
    bollinger_lower = Column(Float, nullable=True)
    
    # Стратегия
    strategy_type = Column(SQLEnum(StrategyType), default=StrategyType.INDICATORS)
    strategy_data = Column(JSON, nullable=True)  # Дополнительные данные стратегии
    
    # Статус и результат
    status = Column(SQLEnum(SignalStatus), default=SignalStatus.PENDING)
    result = Column(SQLEnum(SignalResult), default=SignalResult.PENDING)
    profit_loss = Column(Float, nullable=True)  # Результат в $
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    activated_at = Column(DateTime(timezone=True), nullable=True)  # Когда сигнал активирован
    completed_at = Column(DateTime(timezone=True), nullable=True)  # Когда завершен
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Когда истекает
    
    # Связь с пользователем
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="po_signals")
    
    # Дополнительные данные
    notes = Column(Text, nullable=True)
    price_history = Column(JSON, nullable=True)  # История цен для анализа
    indicators_snapshot = Column(JSON, nullable=True)  # Полный снимок индикаторов

    def __repr__(self):
        return f"<POSignal(id={self.id}, type={self.signal_type}, status={self.status})>"


class POMartingaleState(Base):
    """
    Состояние Мартингейл стратегии для пользователя
    Отслеживает прогрессию ставок
    """
    __tablename__ = "po_martingale_states"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Параметры стратегии
    base_amount = Column(Float, default=1.0)
    multiplier = Column(Float, default=2.0)
    max_steps = Column(Integer, default=5)
    
    # Текущее состояние
    current_step = Column(Integer, default=0)
    consecutive_losses = Column(Integer, default=0)
    total_wins = Column(Integer, default=0)
    total_losses = Column(Integer, default=0)
    
    # Статистика
    total_profit = Column(Float, default=0.0)
    max_drawdown = Column(Float, default=0.0)
    win_rate = Column(Float, default=0.0)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связь с пользователем
    user = relationship("User", backref="martingale_states")

    def __repr__(self):
        return f"<POMartingaleState(user_id={self.user_id}, step={self.current_step})>"


class POTrade(Base):
    """
    Модель совершенной сделки
    Фактически размещенные ордера в Pocket Option
    """
    __tablename__ = "po_trades"

    id = Column(Integer, primary_key=True, index=True)
    
    # Связь с сигналом
    signal_id = Column(Integer, ForeignKey("po_signals.id"), nullable=True)
    signal = relationship("POSignal", backref="trades")
    
    # Параметры сделки
    asset_id = Column(Integer, nullable=False)
    asset_name = Column(String(50), nullable=False)
    direction = Column(SQLEnum(SignalDirection), nullable=False)
    amount = Column(Float, nullable=False)
    timeframe = Column(Integer, nullable=False)  # в секундах
    
    # Цены
    entry_price = Column(Float, nullable=False)
    close_price = Column(Float, nullable=True)
    
    # Результат
    result = Column(SQLEnum(SignalResult), default=SignalResult.PENDING)
    profit_loss = Column(Float, nullable=True)  # Результат в $
    payout_percent = Column(Float, nullable=True)  # Процент выплаты
    
    # Pocket Option данные
    po_order_id = Column(String(100), nullable=True)  # ID ордера в PO
    po_deal_id = Column(String(100), nullable=True)  # ID сделки в PO
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Пользователь
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", backref="po_trades")

    def __repr__(self):
        return f"<POTrade(id={self.id}, asset={self.asset_name}, result={self.result})>"


class POBacktestResult(Base):
    """
    Результаты бэктестинга стратегий
    """
    __tablename__ = "po_backtest_results"

    id = Column(Integer, primary_key=True, index=True)
    
    # Параметры теста
    strategy_type = Column(SQLEnum(StrategyType), nullable=False)
    asset_name = Column(String(50), nullable=False)
    timeframe = Column(Integer, nullable=False)
    
    # Период теста
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    
    # Результаты
    total_trades = Column(Integer, default=0)
    winning_trades = Column(Integer, default=0)
    losing_trades = Column(Integer, default=0)
    win_rate = Column(Float, default=0.0)
    
    # Финансовые результаты
    initial_balance = Column(Float, default=1000.0)
    final_balance = Column(Float, default=1000.0)
    total_profit = Column(Float, default=0.0)
    max_drawdown = Column(Float, default=0.0)
    profit_factor = Column(Float, default=0.0)
    
    # Параметры стратегии
    strategy_params = Column(JSON, nullable=True)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Пользователь
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", backref="backtest_results")

    def __repr__(self):
        return f"<POBacktestResult(strategy={self.strategy_type}, win_rate={self.win_rate})>"


class POAsset(Base):
    """
    Модель актива для торговли
    Кэширует информацию об активах из Pocket Option
    """
    __tablename__ = "po_assets"

    id = Column(Integer, primary_key=True, index=True)
    
    # Идентификаторы
    po_asset_id = Column(Integer, unique=True, nullable=False)  # ID в Pocket Option
    name = Column(String(50), nullable=False, unique=True)  # EUR/USD
    display_name = Column(String(100), nullable=True)  # EUR/USD OTC
    
    # Параметры торговли
    is_active = Column(Boolean, default=True)
    is_otc = Column(Boolean, default=False)
    payout_percent = Column(Float, default=80.0)  # Процент выплаты
    
    # Таймфреймы
    available_timeframes = Column(JSON, nullable=True)  # [60, 300, 900]
    
    # Текущая информация
    current_price = Column(Float, nullable=True)
    price_change = Column(Float, nullable=True)
    
    # Временные метки
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<POAsset(name={self.name}, active={self.is_active})>"
