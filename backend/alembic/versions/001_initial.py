"""Initial migration - create all tables

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password', sa.String(length=255), nullable=False),
        sa.Column('pocket_option_id', sa.String(length=100), nullable=False),
        sa.Column('balance', sa.Float(), nullable=True, default=0),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True, default='Россия'),
        sa.Column('language', sa.String(length=50), nullable=True, default='Русский'),
        sa.Column('status', sa.String(length=50), nullable=True, default='active'),
        sa.Column('role', sa.String(length=50), nullable=True, default='user'),
        sa.Column('referral_code', sa.String(length=100), nullable=True),
        sa.Column('referred_by', sa.Integer(), nullable=True),
        sa.Column('referral_rank', sa.String(length=50), nullable=True, default='Bronze'),
        sa.Column('total_referrals', sa.Integer(), nullable=True, default=0),
        sa.Column('active_referrals', sa.Integer(), nullable=True, default=0),
        sa.Column('total_commission', sa.Float(), nullable=True, default=0),
        sa.Column('pending_commission', sa.Float(), nullable=True, default=0),
        sa.Column('paid_commission', sa.Float(), nullable=True, default=0),
        sa.Column('lifetime_value', sa.Float(), nullable=True, default=0),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('pocket_option_id'),
        sa.UniqueConstraint('referral_code')
    )

    # Create sessions table
    op.create_table('sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=500), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )

    # Create referral_links table
    op.create_table('referral_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('custom_code', sa.String(length=100), nullable=True),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('clicks', sa.Integer(), nullable=True, default=0),
        sa.Column('unique_clicks', sa.Integer(), nullable=True, default=0),
        sa.Column('registrations', sa.Integer(), nullable=True, default=0),
        sa.Column('conversions', sa.Integer(), nullable=True, default=0),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )

    # Create referrals table
    op.create_table('referrals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('referrer_id', sa.Integer(), nullable=False),
        sa.Column('referred_id', sa.Integer(), nullable=False),
        sa.Column('referral_link_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True, default='active'),
        sa.Column('first_deposit', sa.Float(), nullable=True, default=0),
        sa.Column('total_deposit', sa.Float(), nullable=True, default=0),
        sa.Column('total_trades', sa.Integer(), nullable=True, default=0),
        sa.Column('total_profit', sa.Float(), nullable=True, default=0),
        sa.Column('commission_earned', sa.Float(), nullable=True, default=0),
        sa.Column('joined_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('last_active', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('referred_id'),
        sa.ForeignKeyConstraint(['referrer_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['referred_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['referral_link_id'], ['referral_links.id'], ondelete='SET NULL')
    )

    # Create commissions table
    op.create_table('commissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('referral_id', sa.Integer(), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True, default='pending'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['referral_id'], ['referrals.id'], ondelete='SET NULL')
    )

    # Create partner_ranks table
    op.create_table('partner_ranks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('min_referrals', sa.Integer(), nullable=True, default=0),
        sa.Column('min_deposit', sa.Float(), nullable=True, default=0),
        sa.Column('commission_rate', sa.Float(), nullable=True, default=0),
        sa.Column('icon', sa.String(length=100), nullable=True),
        sa.Column('color', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Create partner_payouts table
    op.create_table('partner_payouts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('method', sa.String(length=100), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True, default='pending'),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )

    # Create pocketoption_users table
    op.create_table('pocketoption_users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pocket_option_id', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('reg_date', sa.DateTime(), nullable=True),
        sa.Column('verification_status', sa.String(length=50), nullable=True),
        sa.Column('ftd_amount', sa.Float(), nullable=True, default=0),
        sa.Column('deposits_count', sa.Integer(), nullable=True, default=0),
        sa.Column('withdrawals_count', sa.Integer(), nullable=True, default=0),
        sa.Column('current_balance', sa.Float(), nullable=True, default=0),
        sa.Column('total_deposit', sa.Float(), nullable=True, default=0),
        sa.Column('total_withdrawal', sa.Float(), nullable=True, default=0),
        sa.Column('last_sync', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('pocket_option_id')
    )

    # Create trades table
    op.create_table('trades',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=50), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('total', sa.Float(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True, default='pending'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'])
    )

    # Create password_reset_codes table
    op.create_table('password_reset_codes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=10), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_password_reset_codes_email', 'password_reset_codes', ['email'], unique=False)

    # Create signal_usage table
    op.create_table('signal_usage',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('used_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('signal_data', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )


def downgrade() -> None:
    op.drop_table('signal_usage')
    op.drop_table('password_reset_codes')
    op.drop_table('trades')
    op.drop_table('pocketoption_users')
    op.drop_table('partner_payouts')
    op.drop_table('partner_ranks')
    op.drop_table('commissions')
    op.drop_table('referrals')
    op.drop_table('referral_links')
    op.drop_table('sessions')
    op.drop_table('users')
