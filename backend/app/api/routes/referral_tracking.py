from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.models import User, Referral, ReferralLink, Commission
from app.dependencies import get_current_user
from app.config import get_settings
from datetime import datetime
from typing import Optional

settings = get_settings()

router = APIRouter(prefix="/api/referral", tags=["Referral Tracking"])


# Конфигурация рангов
RANKS = {
    "Bronze": {"min_referrals": 0, "min_deposit": 0},
    "Silver": {"min_referrals": 10, "min_deposit": 1000},
    "Gold": {"min_referrals": 25, "min_deposit": 5000},
    "Platinum": {"min_referrals": 50, "min_deposit": 10000},
    "Diamond": {"min_referrals": 100, "min_deposit": 25000},
}

RANK_ORDER = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"]


async def check_and_update_rank(user: User, db: AsyncSession):
    """Проверка и обновление ранга пользователя"""
    current_rank = user.referral_rank or "Bronze"
    
    # Получаем общую сумму депозитов всех рефералов
    result = await db.execute(
        select(func.sum(Referral.total_deposit))
        .where(Referral.referrer_id == user.id)
    )
    total_deposits = result.scalar() or 0
    
    # Получаем количество рефералов
    total_referrals = user.total_referrals or 0
    
    print(f"📊 Check rank for {user.email}: rank={current_rank}, referrals={total_referrals}, deposits={total_deposits}")
    
    # Проверяем каждый ранг от высшего к низшему
    for rank_name in reversed(RANK_ORDER):
        rank_config = RANKS[rank_name]
        if (total_referrals >= rank_config["min_referrals"] and 
            total_deposits >= rank_config["min_deposit"]):
            if rank_name != current_rank:
                user.referral_rank = rank_name
                print(f"🎉 Rank updated: {current_rank} -> {rank_name}")
            break
    
    return user.referral_rank


class DepositTrack(BaseModel):
    user_id: int
    amount: float
    po_transaction_id: Optional[str] = None


@router.post("/track-deposit")
async def track_deposit(
    deposit_data: DepositTrack,
    db: AsyncSession = Depends(get_db)
):
    """
    Отслеживание депозита реферала
    Автоматически создает комиссию для пригласившего
    """
    try:
        # Находим пользователя
        result = await db.execute(
            select(User).where(User.id == deposit_data.user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Проверяем, есть ли у этого пользователя пригласивший (referrer)
        result = await db.execute(
            select(Referral)
            .where(Referral.referred_id == deposit_data.user_id)
        )
        referral = result.scalar_one_or_none()

        if not referral:
            return {
                "success": True,
                "message": "Deposit tracked, but no referrer found",
                "commission": None
            }

        # Находим пригласившего
        referrer = await db.execute(
            select(User).where(User.id == referral.referrer_id)
        )
        referrer = referrer.scalar_one_or_none()

        if not referrer:
            return {
                "success": True,
                "message": "Deposit tracked, but referrer not found",
                "commission": None
            }

        # Определяем процент комиссии на основе ранга
        commission_rates = {
            "Bronze": 5,
            "Silver": 7,
            "Gold": 10,
            "Platinum": 12,
            "Diamond": 15
        }
        commission_rate = commission_rates.get(referrer.referral_rank or "Bronze", 5)
        
        # Рассчитываем комиссию (5-15% от депозита)
        commission_amount = deposit_data.amount * (commission_rate / 100)

        # Проверяем, не была ли уже комиссия за этот депозит
        if deposit_data.po_transaction_id:
            result = await db.execute(
                select(Commission)
                .where(Commission.source == deposit_data.po_transaction_id)
            )
            existing_commission = result.scalar_one_or_none()
            
            if existing_commission:
                return {
                    "success": True,
                    "message": "Commission already exists for this deposit",
                    "commission": {
                        "id": existing_commission.id,
                        "amount": float(existing_commission.amount)
                    }
                }

        # Создаем комиссию
        commission = Commission(
            user_id=referrer.id,
            referral_id=referral.id,
            amount=commission_amount,
            type="deposit",
            status="pending",  # pending, paid, cancelled
            description=f"Комиссия {commission_rate}% с депозита ${deposit_data.amount} от {user.email}",
            source=deposit_data.po_transaction_id or f"deposit_{user.id}_{datetime.utcnow().timestamp()}",
            created_at=datetime.utcnow()
        )
        db.add(commission)

        # Обновляем данные у реферала
        referral.first_deposit = min(referral.first_deposit or deposit_data.amount, deposit_data.amount)
        referral.total_deposit = (referral.total_deposit or 0) + deposit_data.amount
        referral.commission_earned = (referral.commission_earned or 0) + commission_amount
        
        # Если это первый депозит - помечаем как конверсию
        is_conversion = referral.first_deposit == deposit_data.amount
        if is_conversion:
            # Увеличиваем конверсии у реферальной ссылки
            referrer_link = await db.execute(
                select(ReferralLink).where(ReferralLink.id == referral.referral_link_id)
            )
            referrer_link = referrer_link.scalar_one_or_none()
            
            if referrer_link:
                referrer_link.conversions = (referrer_link.conversions or 0) + 1
                print(f"🎉 Conversion! Referral link {referrer_link.code} now has {referrer_link.conversions} conversions")

        # Обновляем данные у пригласившего
        referrer.total_commission = (referrer.total_commission or 0) + commission_amount
        referrer.pending_commission = (referrer.pending_commission or 0) + commission_amount
        referrer.lifetime_value = (referrer.lifetime_value or 0) + commission_amount

        # Проверяем и обновляем ранг
        new_rank = await check_and_update_rank(referrer, db)

        await db.commit()

        print(f"💰 Commission created: ${commission_amount} for {referrer.email} from {user.email}")
        print(f"🎖️  Current rank: {new_rank}")

        return {
            "success": True,
            "message": "Deposit tracked and commission created",
            "commission": {
                "id": commission.id,
                "amount": float(commission_amount),
                "rate": commission_rate,
                "status": commission.status,
                "referrer": referrer.email,
                "referred": user.email
            },
            "is_conversion": is_conversion
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error tracking deposit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/{user_id}")
async def get_referral_stats(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получение статистики по рефералам пользователя"""
    try:
        # Находим всех рефералов пользователя
        result = await db.execute(
            select(Referral)
            .where(Referral.referrer_id == user_id)
        )
        referrals = result.scalars().all()

        total_referrals = len(referrals)
        active_referrals = sum(1 for r in referrals if r.status == "active")
        total_deposits = sum(r.total_deposit or 0 for r in referrals)
        total_commissions = sum(r.commission_earned or 0 for r in referrals)
        conversions = sum(1 for r in referrals if r.first_deposit is not None)

        return {
            "success": True,
            "stats": {
                "total_referrals": total_referrals,
                "active_referrals": active_referrals,
                "total_deposits": total_deposits,
                "total_commissions": total_commissions,
                "conversions": conversions,
                "conversion_rate": (conversions / total_referrals * 100) if total_referrals > 0 else 0
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check-rank/{user_id}")
async def check_rank(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Проверка и обновление ранга пользователя"""
    try:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        old_rank = user.referral_rank or "Bronze"
        new_rank = await check_and_update_rank(user, db)
        
        await db.commit()

        return {
            "success": True,
            "user_id": user_id,
            "email": user.email,
            "old_rank": old_rank,
            "new_rank": new_rank,
            "rank_changed": old_rank != new_rank
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
