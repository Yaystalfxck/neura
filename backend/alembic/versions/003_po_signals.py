"""Add Pocket Option signals tables

Revision ID: 003_po_signals
Revises: 002_otc_signals
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_po_signals'
down_revision = '002_otc_signals'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enums for PO signals
    po_signal_direction_enum = sa.Enum('call', 'put', name='podirection')
    po_signal_strength_enum = sa.Enum('strong', 'medium', 'weak', name='postrength')
    po_signal_status_enum = sa.Enum('pending', 'active', 'completed', 'cancelled', name='postatus')
    po_signal_result_enum = sa.Enum('win', 'loss', 'draw', 'pending', name='poresult')
    po_strategy_type_enum = sa.Enum('martingale', 'indicators', 'machine_learning', 'custom', name='postrategytype')
    
    # Create po_signals table
    op.create_table('po_signals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('signal_type', po_signal_direction_enum, nullable=False),
        sa.Column('strength', po_signal_strength_enum, nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('asset_name', sa.String(length=50), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('timeframe', sa.Integer(), nullable=False),
        sa.Column('entry_price', sa.Float(), nullable=True),
        sa.Column('current_price', sa.Float(), nullable=True),
        sa.Column('target_price', sa.Float(), nullable=True),
        sa.Column('stop_loss', sa.Float(), nullable=True),
        sa.Column('rsi', sa.Float(), nullable=True),
        sa.Column('macd_line', sa.Float(), nullable=True),
        sa.Column('macd_signal', sa.Float(), nullable=True),
        sa.Column('macd_histogram', sa.Float(), nullable=True),
        sa.Column('cci', sa.Float(), nullable=True),
        sa.Column('ao', sa.Float(), nullable=True),
        sa.Column('bollinger_upper', sa.Float(), nullable=True),
        sa.Column('bollinger_middle', sa.Float(), nullable=True),
        sa.Column('bollinger_lower', sa.Float(), nullable=True),
        sa.Column('strategy_type', po_strategy_type_enum, nullable=True),
        sa.Column('strategy_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('status', po_signal_status_enum, nullable=True),
        sa.Column('result', po_signal_result_enum, nullable=True),
        sa.Column('profit_loss', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('price_history', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('indicators_snapshot', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_po_signals_id'), 'po_signals', ['id'], unique=False)
    op.create_index(op.f('ix_po_signals_user_id'), 'po_signals', ['user_id'], unique=False)
    op.create_index(op.f('ix_po_signals_status'), 'po_signals', ['status'], unique=False)
    op.create_index(op.f('ix_po_signals_signal_type'), 'po_signals', ['signal_type'], unique=False)

    # Create po_martingale_states table
    op.create_table('po_martingale_states',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('base_amount', sa.Float(), nullable=True),
        sa.Column('multiplier', sa.Float(), nullable=True),
        sa.Column('max_steps', sa.Integer(), nullable=True),
        sa.Column('current_step', sa.Integer(), nullable=True),
        sa.Column('consecutive_losses', sa.Integer(), nullable=True),
        sa.Column('total_wins', sa.Integer(), nullable=True),
        sa.Column('total_losses', sa.Integer(), nullable=True),
        sa.Column('total_profit', sa.Float(), nullable=True),
        sa.Column('max_drawdown', sa.Float(), nullable=True),
        sa.Column('win_rate', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_po_martingale_states_id'), 'po_martingale_states', ['id'], unique=False)
    op.create_index(op.f('ix_po_martingale_states_user_id'), 'po_martingale_states', ['user_id'], unique=False)

    # Create po_trades table
    op.create_table('po_trades',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('signal_id', sa.Integer(), nullable=True),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('asset_name', sa.String(length=50), nullable=False),
        sa.Column('direction', po_signal_direction_enum, nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('timeframe', sa.Integer(), nullable=False),
        sa.Column('entry_price', sa.Float(), nullable=False),
        sa.Column('close_price', sa.Float(), nullable=True),
        sa.Column('result', po_signal_result_enum, nullable=True),
        sa.Column('profit_loss', sa.Float(), nullable=True),
        sa.Column('payout_percent', sa.Float(), nullable=True),
        sa.Column('po_order_id', sa.String(length=100), nullable=True),
        sa.Column('po_deal_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['signal_id'], ['po_signals.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_po_trades_id'), 'po_trades', ['id'], unique=False)
    op.create_index(op.f('ix_po_trades_user_id'), 'po_trades', ['user_id'], unique=False)
    op.create_index(op.f('ix_po_trades_signal_id'), 'po_trades', ['signal_id'], unique=False)

    # Create po_backtest_results table
    op.create_table('po_backtest_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('strategy_type', po_strategy_type_enum, nullable=False),
        sa.Column('asset_name', sa.String(length=50), nullable=False),
        sa.Column('timeframe', sa.Integer(), nullable=False),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('total_trades', sa.Integer(), nullable=True),
        sa.Column('winning_trades', sa.Integer(), nullable=True),
        sa.Column('losing_trades', sa.Integer(), nullable=True),
        sa.Column('win_rate', sa.Float(), nullable=True),
        sa.Column('initial_balance', sa.Float(), nullable=True),
        sa.Column('final_balance', sa.Float(), nullable=True),
        sa.Column('total_profit', sa.Float(), nullable=True),
        sa.Column('max_drawdown', sa.Float(), nullable=True),
        sa.Column('profit_factor', sa.Float(), nullable=True),
        sa.Column('strategy_params', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_po_backtest_results_id'), 'po_backtest_results', ['id'], unique=False)
    op.create_index(op.f('ix_po_backtest_results_user_id'), 'po_backtest_results', ['user_id'], unique=False)

    # Create po_assets table
    op.create_table('po_assets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('po_asset_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('is_otc', sa.Boolean(), nullable=True),
        sa.Column('payout_percent', sa.Float(), nullable=True),
        sa.Column('available_timeframes', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('current_price', sa.Float(), nullable=True),
        sa.Column('price_change', sa.Float(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('po_asset_id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_po_assets_id'), 'po_assets', ['id'], unique=False)

    # Add relationship to users table
    # Note: This is handled in the User model via relationship


def downgrade() -> None:
    op.drop_index(op.f('ix_po_assets_id'), table_name='po_assets')
    op.drop_table('po_assets')
    
    op.drop_index(op.f('ix_po_backtest_results_user_id'), table_name='po_backtest_results')
    op.drop_index(op.f('ix_po_backtest_results_id'), table_name='po_backtest_results')
    op.drop_table('po_backtest_results')
    
    op.drop_index(op.f('ix_po_trades_signal_id'), table_name='po_trades')
    op.drop_index(op.f('ix_po_trades_user_id'), table_name='po_trades')
    op.drop_index(op.f('ix_po_trades_id'), table_name='po_trades')
    op.drop_table('po_trades')
    
    op.drop_index(op.f('ix_po_martingale_states_user_id'), table_name='po_martingale_states')
    op.drop_index(op.f('ix_po_martingale_states_id'), table_name='po_martingale_states')
    op.drop_table('po_martingale_states')
    
    op.drop_index(op.f('ix_po_signals_signal_type'), table_name='po_signals')
    op.drop_index(op.f('ix_po_signals_status'), table_name='po_signals')
    op.drop_index(op.f('ix_po_signals_user_id'), table_name='po_signals')
    op.drop_index(op.f('ix_po_signals_id'), table_name='po_signals')
    op.drop_table('po_signals')
    
    # Drop enums
    sa.Enum(name='podirection').drop(op.get_bind())
    sa.Enum(name='postrength').drop(op.get_bind())
    sa.Enum(name='postatus').drop(op.get_bind())
    sa.Enum(name='poresult').drop(op.get_bind())
    sa.Enum(name='postrategytype').drop(op.get_bind())
