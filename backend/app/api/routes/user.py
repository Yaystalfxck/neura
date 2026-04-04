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
    """Синхронизация баланса с PocketOption API"""
    try:
        po_service = get_pocket_option_service()
        user_data = await po_service.get_user_data(current_user.pocket_option_id)

        if not user_data:
            return {
                "success": True,
                "balance": float(current_user.balance or 0),
                "message": "PO API недоступно",
                "source": "database",
            }

        new_balance = user_data.get("current_balance", 0.0)
        total_deposit = user_data.get("total_deposit", 0.0)
        deposits_count = user_data.get("deposits_count", 0)

        # Получаем текущие записи о депозитах, чтобы найти новые
        po_user_result = await db.execute(
            select(PocketOptionUser).where(PocketOptionUser.pocket_option_id == current_user.pocket_option_id)
        )
        po_user = po_user_result.scalar_one_or_none()
        old_total_deposit = po_user.total_deposit if po_user else 0.0

        current_user.balance = new_balance

        if po_user:
            po_user.current_balance = new_balance
            po_user.total_deposit = total_deposit
            po_user.deposits_count = deposits_count
            po_user.last_sync = datetime.utcnow()
        else:
            po_user = PocketOptionUser(
                pocket_option_id=current_user.pocket_option_id,
                email=user_data.get("email", ""),
                current_balance=new_balance,
                total_deposit=total_deposit,
                deposits_count=deposits_count,
                last_sync=datetime.utcnow()
            )
            db.add(po_user)

        await db.commit()

        # === АВТОМАТИЧЕСКОЕ НАЧИСЛЕНИЕ КОМИССИИ ЗА ДЕПОЗИТ ===
        new_deposit_amount = total_deposit - old_total_deposit if total_deposit > old_total_deposit else 0

        if new_deposit_amount > 0:
            print(f"💰 Обнаружен новый депозит: ${new_deposit_amount} для {current_user.email}")
            await _create_referral_commission(db, current_user, new_deposit_amount, f"deposit_sync_{int(datetime.utcnow().timestamp())}")

        print(f"✅ Баланс синхронизирован для {current_user.email}: ${new_balance}")

        return {
            "success": True,
            "balance": new_balance,
            "message": "Баланс синхронизирован",
            "source": "pocketoption_api",
        }

    except Exception as e:
        print(f"❌ Ошибка синхронизации: {e}")
        return {
            "success": True,
            "balance": float(current_user.balance or 0),
            "message": "Использован кэш",
            "source": "cached",
        }


@router.get("/balance", response_model=dict)
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение баланса пользователя"""
    try:
        user_balance = await get_user_balance(current_user, db, sync_with_po=True)
        return {
            "success": True,
            "balance": user_balance,
            "source": "pocketoption_api"
        }
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return {
            "success": True,
            "balance": float(current_user.balance or 0),
            "source": "database"
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
