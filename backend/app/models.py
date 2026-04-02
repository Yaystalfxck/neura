from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    pocket_option_id = Column(String(100), unique=True, nullable=False)
    balance = Column(Float, default=0)
    phone = Column(String(50), nullable=True)
    country = Column(String(100), default="Россия")
    language = Column(String(50), default="Русский")
    status = Column(String(50), default="active")
    role = Column(String(50), default="user")
    
    # Referral fields
    referral_code = Column(String(100), unique=True, nullable=True)
    referred_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    referral_rank = Column(String(50), default="Bronze")
    total_referrals = Column(Integer, default=0)
    active_referrals = Column(Integer, default=0)
    total_commission = Column(Float, default=0)
    pending_commission = Column(Float, default=0)
    paid_commission = Column(Float, default=0)
    lifetime_value = Column(Float, default=0)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    referrals = relationship("Referral", foreign_keys="Referral.referrer_id", back_populates="referrer")
    referred = relationship("Referral", foreign_keys="Referral.referred_id", back_populates="referred")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    commissions = relationship("Commission", back_populates="user")
    payouts = relationship("PartnerPayout", back_populates="user")
    po_signals = relationship("POSignal", back_populates="user", cascade="all, delete-orphan")
    support_tickets = relationship("SupportTicket", back_populates="user", foreign_keys="SupportTicket.user_id", cascade="all, delete-orphan")
    support_messages = relationship("SupportMessage", back_populates="user", cascade="all, delete-orphan", foreign_keys="SupportMessage.user_id")
    viewed_tickets = relationship("TicketViewer", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(500), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="sessions")


class ReferralLink(Base):
    __tablename__ = "referral_links"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(100), unique=True, nullable=False)
    custom_code = Column(String(100), nullable=True)
    url = Column(Text, nullable=False)
    clicks = Column(Integer, default=0)
    unique_clicks = Column(Integer, default=0)
    registrations = Column(Integer, default=0)
    conversions = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)
    referrer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    referred_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    referral_link_id = Column(Integer, ForeignKey("referral_links.id"), nullable=True)
    status = Column(String(50), default="active")
    first_deposit = Column(Float, default=0)
    total_deposit = Column(Float, default=0)
    total_trades = Column(Integer, default=0)
    total_profit = Column(Float, default=0)
    commission_earned = Column(Float, default=0)
    joined_at = Column(DateTime, server_default=func.now())
    last_active = Column(DateTime, server_default=func.now())

    referrer = relationship("User", foreign_keys=[referrer_id], back_populates="referrals")
    referred = relationship("User", foreign_keys=[referred_id], back_populates="referred")


class Commission(Base):
    __tablename__ = "commissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    referral_id = Column(Integer, ForeignKey("referrals.id"), nullable=True)
    amount = Column(Float, nullable=False)
    type = Column(String(50), nullable=False)  # deposit, trade, bonus, withdrawal
    status = Column(String(50), default="pending")  # pending, reserved, paid, cancelled
    description = Column(Text, nullable=True)
    source = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    paid_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="commissions")


class PartnerRank(Base):
    __tablename__ = "partner_ranks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    min_referrals = Column(Integer, default=0)
    min_deposit = Column(Float, default=0)
    commission_rate = Column(Float, default=0)
    icon = Column(String(100), nullable=True)
    color = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class PartnerPayout(Base):
    __tablename__ = "partner_payouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    method = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    status = Column(String(50), default="pending")  # pending, processing, completed, failed, cancelled
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="payouts")


class PocketOptionUser(Base):
    __tablename__ = "pocketoption_users"

    id = Column(Integer, primary_key=True, index=True)
    pocket_option_id = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), nullable=True)
    reg_date = Column(DateTime, nullable=True)
    verification_status = Column(String(50), nullable=True)
    ftd_amount = Column(Float, default=0)
    deposits_count = Column(Integer, default=0)
    withdrawals_count = Column(Integer, default=0)
    current_balance = Column(Float, default=0)
    total_deposit = Column(Float, default=0)
    total_withdrawal = Column(Float, default=0)
    last_sync = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String(50), nullable=False)
    type = Column(String(20), nullable=False)  # buy, sell
    amount = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, server_default=func.now())


class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    code = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class SignalUsage(Base):
    __tablename__ = "signal_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    used_at = Column(DateTime, server_default=func.now())
    signal_data = Column(Text, nullable=True)


class TicketViewer(Base):
    __tablename__ = "ticket_viewers"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    last_seen = Column(DateTime, server_default=func.now(), onupdate=func.now())

    ticket = relationship("SupportTicket", back_populates="viewers")
    user = relationship("User")


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject = Column(String(255), nullable=False)
    status = Column(String(50), default="open")  # open, in_progress, closed
    priority = Column(String(50), default="normal")  # low, normal, high, urgent
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    closed_at = Column(DateTime, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)  # Support agent

    user = relationship("User", back_populates="support_tickets", foreign_keys=[user_id])
    assigned_agent = relationship("User", foreign_keys=[assigned_to], lazy="select")
    messages = relationship("SupportMessage", back_populates="ticket", cascade="all, delete-orphan", foreign_keys="SupportMessage.ticket_id")
    viewers = relationship("TicketViewer", back_populates="ticket", cascade="all, delete-orphan")


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    is_staff_message = Column(Boolean, default=False)  # True if from support/admin
    created_at = Column(DateTime, server_default=func.now())
    read_at = Column(DateTime, nullable=True)

    ticket = relationship("SupportTicket", back_populates="messages", foreign_keys=[ticket_id])
    user = relationship("User", back_populates="support_messages", foreign_keys=[user_id])
