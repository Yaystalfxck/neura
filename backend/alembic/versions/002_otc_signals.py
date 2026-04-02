"""Add OTC signals tables

Revision ID: 002_otc_signals
Revises: 001_initial
Create Date: 2024-01-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_otc_signals'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create otc_signals table
    op.create_table('otc_signals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=50), nullable=False),
        sa.Column('asset_type', sa.String(length=20), nullable=True, default='OTC'),
        sa.Column('signal_type', sa.String(length=10), nullable=False),
        sa.Column('strength', sa.String(length=20), nullable=True, default='medium'),
        sa.Column('confidence', sa.Float(), nullable=True, default=0.0),
        sa.Column('rsi', sa.Float(), nullable=True),
        sa.Column('macd', sa.Float(), nullable=True),
        sa.Column('macd_signal', sa.Float(), nullable=True),
        sa.Column('bollinger_upper', sa.Float(), nullable=True),
        sa.Column('bollinger_middle', sa.Float(), nullable=True),
        sa.Column('bollinger_lower', sa.Float(), nullable=True),
        sa.Column('trend_short', sa.String(length=20), nullable=True),
        sa.Column('trend_medium', sa.String(length=20), nullable=True),
        sa.Column('trend_long', sa.String(length=20), nullable=True),
        sa.Column('current_price', sa.Float(), nullable=False),
        sa.Column('entry_price', sa.Float(), nullable=True),
        sa.Column('target_price', sa.Float(), nullable=True),
        sa.Column('stop_loss', sa.Float(), nullable=True),
        sa.Column('timeframe', sa.String(length=10), nullable=True, default='1m'),
        sa.Column('expiration_minutes', sa.Integer(), nullable=True, default=5),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True, default='active'),
        sa.Column('result', sa.String(length=10), nullable=True),
        sa.Column('pattern_detected', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('price_history', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_otc_signals_symbol', 'otc_signals', ['symbol'], unique=False)
    op.create_index('ix_otc_signals_status', 'otc_signals', ['status'], unique=False)

    # Create market_analysis table
    op.create_table('market_analysis',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=50), nullable=False),
        sa.Column('timeframe', sa.String(length=10), nullable=True, default='1m'),
        sa.Column('current_price', sa.Float(), nullable=False),
        sa.Column('price_change', sa.Float(), nullable=True, default=0.0),
        sa.Column('price_change_percent', sa.Float(), nullable=True, default=0.0),
        sa.Column('rsi_14', sa.Float(), nullable=True),
        sa.Column('rsi_signal', sa.String(length=20), nullable=True),
        sa.Column('macd_value', sa.Float(), nullable=True),
        sa.Column('macd_signal_value', sa.Float(), nullable=True),
        sa.Column('macd_histogram', sa.Float(), nullable=True),
        sa.Column('macd_trend', sa.String(length=20), nullable=True),
        sa.Column('bb_upper', sa.Float(), nullable=True),
        sa.Column('bb_middle', sa.Float(), nullable=True),
        sa.Column('bb_lower', sa.Float(), nullable=True),
        sa.Column('bb_width', sa.Float(), nullable=True),
        sa.Column('bb_position', sa.Float(), nullable=True),
        sa.Column('sma_20', sa.Float(), nullable=True),
        sa.Column('sma_50', sa.Float(), nullable=True),
        sa.Column('sma_200', sa.Float(), nullable=True),
        sa.Column('ema_12', sa.Float(), nullable=True),
        sa.Column('ema_26', sa.Float(), nullable=True),
        sa.Column('volume', sa.Float(), nullable=True, default=0.0),
        sa.Column('avg_volume', sa.Float(), nullable=True, default=0.0),
        sa.Column('volatility', sa.Float(), nullable=True, default=0.0),
        sa.Column('atr', sa.Float(), nullable=True),
        sa.Column('trend_direction', sa.String(length=20), nullable=True),
        sa.Column('trend_strength', sa.Float(), nullable=True, default=0.0),
        sa.Column('support_level', sa.Float(), nullable=True),
        sa.Column('resistance_level', sa.Float(), nullable=True),
        sa.Column('analyzed_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('candles_data', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_market_analysis_symbol', 'market_analysis', ['symbol'], unique=False)

    # Create signal_patterns table
    op.create_table('signal_patterns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=50), nullable=False),
        sa.Column('pattern_type', sa.String(length=50), nullable=False),
        sa.Column('pattern_category', sa.String(length=20), nullable=True),
        sa.Column('signal_direction', sa.String(length=10), nullable=True),
        sa.Column('strength', sa.Float(), nullable=True, default=0.0),
        sa.Column('reliability', sa.Float(), nullable=True, default=0.0),
        sa.Column('detected_at_price', sa.Float(), nullable=False),
        sa.Column('detected_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('timeframe', sa.String(length=10), nullable=True, default='1m'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_signal_patterns_symbol', 'signal_patterns', ['symbol'], unique=False)


def downgrade() -> None:
    op.drop_table('signal_patterns')
    op.drop_table('market_analysis')
    op.drop_table('otc_signals')
