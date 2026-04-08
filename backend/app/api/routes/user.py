from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import User, ReferralLink, Referral, Commission, PartnerPayout, SignalUsage, PocketOptionUser
from app.schemas import ReferralLinkResponse, ReferralStats, APIResponse
from app.dependencies import get_current_user
from app.pocketoption_service import get_pocket_option_service, PocketOptionService
from app.balance_utils import get_user_balance
from datetime import datetime

router = APIRouter(prefix="/api/user", tags=["User"])


COMMISSION_RATES = {
    "Bronze": 5,
    "Silver": 7,
    "Gold": 10,
    "Platinum": 12,
    "Diamond": 15,
}


def get_next_limit_balance(current_balance: float) -> float:
    """Возвращает необходимый баланс для следующего лимита"""
    if current_balance >= 200:
        return 200
    elif current_balance >= 100:
        return 200
    elif current_balance >= 50:
        return 100
    elif current_balance >= 25:
        return 50
    else:
        return 25


@router.get("/signal-limits", response_model=dict)
async def get_signal_limits(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение лимитов на сигналы с проверкой баланса"""
    today = datetime.utcnow().date()

    result = await db.execute(
        select(func.count(SignalUsage.id))
        .where(SignalUsage.user_id == current_user.id)
        .where(func.date(SignalUsage.used_at) == today)
    )
    used_today = result.scalar() or 0

    # Получаем баланс пользователя с синхронизацией из PO API
    user_balance = await get_user_balance(current_user, db, sync_with_po=True)
    print(f"🎯 Баланс для {current_user.email}: ${user_balance}")

    if current_user.role == 'admin':
        return {
            "success": True,
            "daily_limit": 999,
            "used_today": used_today,
            "remaining": 999,
            "rank": current_user.referral_rank,
            "balance": user_balance,
            "is_admin": True,
        }

    if user_balance >= 200:
        daily_limit = 5
    elif user_balance >= 100:
        daily_limit = 4
    elif user_balance >= 50:
        daily_limit = 3
    elif user_balance >= 25:
        daily_limit = 2
    else:
        daily_limit = 1

    remaining = max(0, daily_limit - used_today)

    return {
        "success": True,
        "daily_limit": daily_limit,
        "used_today": used_today,
        "remaining": remaining,
        "rank": current_user.referral_rank,
        "balance": user_balance,
        "is_admin": False,
        "next_limit_balance": get_next_limit_balance(user_balance),
    }


@router.post("/sync-balance", response_model=dict)
async def sync_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Синхронизация баланса с PocketOption API - ОТКЛЮЧЕНО для стабильности"""
    # ВАЖНО: Отключаем синхронизацию через pocketoptionapi_async
    # т.к. она конфликтует с BinaryOptionsToolsV2
    # Используем баланс из БД напрямую
    return {
        "success": True,
        "message": "Баланс получен из БД (синхронизация отключена)",
        "balance": float(current_user.balance) if current_user.balance else 0.0
    }


@router.get("/balance", response_model=dict)
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение баланса пользователя - из БД без синхронизации"""
    return {
        "success": True,
        "balance": float(current_user.balance or 0),
        "message": "Баланс получен из БД",
        "source": "database",
    }


@router.post("/sync-balance", response_model=dict)
async def sync_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Синхронизация баланса - ОТКЛЮЧЕНО для стабильности"""
    return {
        "success": True,
        "message": "Синхронизация отключена. Используйте баланс из БД.",
        "balance": float(current_user.balance or 0)
    }


async def _create_referral_commission(
    db: AsyncSession,
    user: User,
    deposit_amount: float,
    source_id: str
) -> dict:
    """Автоматическое создание комиссии за депозит реферала"""
    # Ищем, есть ли у пользователя реферер
    result = await db.execute(
        select(Referral).where(Referral.referred_id == user.id)
    )
    referral = result.scalar_one_or_none()

    if not referral:
        return {"commission": None, "message": "No referrer found"}

    # Ищем реферера
    referrer_result = await db.execute(
        select(User).where(User.id == referral.referrer_id)
    )
    referrer = referrer_result.scalar_one_or_none()

    if not referrer:
        return {"commission": None, "message": "Referrer not found"}

    # Проверяем, не была ли уже создана комиссия за этот депозит
    existing_result = await db.execute(
        select(Commission).where(Commission.source == source_id)
    )
    if existing_result.scalar_one_or_none():
        return {"commission": None, "message": "Commission already exists"}

    # Определяем процент комиссии на основе ранга реферера
    commission_rate = COMMISSION_RATES.get(referrer.referral_rank or "Bronze", 5)
    commission_amount = deposit_amount * (commission_rate / 100)

    # Создаём запись комиссии
    commission = Commission(
        user_id=referrer.id,
        referral_id=referral.id,
        amount=commission_amount,
        type="deposit",
        status="pending",
        description=f"Комиссия {commission_rate}% с депозита ${deposit_amount:.2f} от {user.email}",
        source=source_id,
    )
    db.add(commission)

    # Обновляем статистику реферала
    referral.first_deposit = min(referral.first_deposit or deposit_amount, deposit_amount)
    referral.total_deposit = (referral.total_deposit or 0) + deposit_amount
    referral.commission_earned = (referral.commission_earned or 0) + commission_amount

    # Обновляем статистику реферера
    referrer.total_commission = (referrer.total_commission or 0) + commission_amount
    referrer.pending_commission = (referrer.pending_commission or 0) + commission_amount
    referrer.lifetime_value = (referrer.lifetime_value or 0) + commission_amount

    await db.commit()

    print(f"💰 Комиссия ${commission_amount:.2f} ({commission_rate}%) начислена для {referrer.email} от {user.email}")

    return {
        "commission": {
            "id": commission.id,
            "amount": commission_amount,
            "rate": commission_rate,
            "status": commission.status,
        },
        "message": "Commission created"
    }
