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

        current_user.balance = new_balance

        po_user_result = await db.execute(
            select(PocketOptionUser).where(PocketOptionUser.pocket_option_id == current_user.pocket_option_id)
        )
        po_user = po_user_result.scalar_one_or_none()

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
