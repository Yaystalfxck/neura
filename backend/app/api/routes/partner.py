from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.models import User, ReferralLink, Referral, Commission, PartnerPayout
from app.dependencies import get_current_user
from app.config import get_settings
from datetime import datetime
from typing import Optional
import asyncio

settings = get_settings()

router = APIRouter(prefix="/api/partner", tags=["Partner"])


# Модель для трекинга клика
class ReferralClickTrack(BaseModel):
    code: str
    user_agent: Optional[str] = None


# Глобальный кэш для предотвращения дублирования кликов
click_cache = {}

@router.post("/track-click")
async def track_referral_click(
    click_data: ReferralClickTrack,
    db: AsyncSession = Depends(get_db)
):
    """Отслеживание клика по реферальной ссылке"""
    try:
        # Ищем реферальную ссылку по коду
        result = await db.execute(
            select(ReferralLink)
            .where(ReferralLink.code == click_data.code)
            .where(ReferralLink.is_active == True)
        )
        link = result.scalar_one_or_none()

        if not link:
            raise HTTPException(status_code=404, detail="Referral link not found")

        # Создаем уникальный ключ для комбинации code + user_agent
        import hashlib
        import time
        from datetime import timedelta
        
        cache_key = f"{click_data.code}:{hashlib.md5((click_data.user_agent or 'unknown').encode()).hexdigest()}"
        current_time = time.time()
        
        # Проверяем, не было ли клика в последние 30 секунд
        if cache_key in click_cache:
            last_click_time = click_cache[cache_key]
            if current_time - last_click_time < 30:  # 30 секунд
                print(f"⚠️ Duplicate click ignored for {cache_key} (last click: {current_time - last_click_time:.1f}s ago)")
                return {
                    "success": True,
                    "message": "Duplicate click ignored (cached)",
                    "clicks": link.clicks,
                    "unique_clicks": link.unique_clicks,
                    "cached": True
                }
        
        # Увеличиваем счетчик кликов
        link.clicks = (link.clicks or 0) + 1
        link.unique_clicks = (link.unique_clicks or 0) + 1

        # Сохраняем время последнего клика в кэш
        click_cache[cache_key] = current_time
        
        # Очищаем старые записи из кэша (старше 1 минуты)
        keys_to_remove = [k for k, v in click_cache.items() if current_time - v > 60]
        for key in keys_to_remove:
            del click_cache[key]

        await db.commit()

        print(f"✅ Click tracked: code={click_data.code}, clicks={link.clicks}, unique={link.unique_clicks}")

        return {
            "success": True,
            "message": "Click tracked successfully",
            "clicks": link.clicks,
            "unique_clicks": link.unique_clicks,
            "cached": False
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error tracking click: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/referral-link")
async def get_referral_link(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение или создание реферальной ссылки"""
    try:
        # Ищем активную ссылку
        result = await db.execute(
            select(ReferralLink)
            .where(ReferralLink.user_id == current_user.id)
            .where(ReferralLink.is_active == True)
            .order_by(ReferralLink.created_at.desc())
            .limit(1)
        )
        link = result.scalar_one_or_none()

        if not link:
            # Создаем новую ссылку
            import random
            code = f"ref{current_user.id}{random.randint(1000, 9999)}"
            url = f"{settings.FRONTEND_URL}/?ref={code}"
            
            link = ReferralLink(
                user_id=current_user.id,
                code=code,
                custom_code=None,
                url=url,
                clicks=0,
                unique_clicks=0,
                registrations=0,
                conversions=0,
                is_active=True
            )
            db.add(link)
            await db.commit()
            await db.refresh(link)

        return {
            "success": True,
            "link": {
                "code": link.code,
                "url": link.url,
                "clicks": link.clicks or 0,
                "unique_clicks": link.unique_clicks or 0,
                "registrations": link.registrations or 0,
                "conversions": link.conversions or 0
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_partner_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Статистика партнера"""
    try:
        # Количество рефералов
        result = await db.execute(
            select(func.count(Referral.id))
            .where(Referral.referrer_id == current_user.id)
        )
        total_referrals = result.scalar() or 0

        # Активные рефералы
        result = await db.execute(
            select(func.count(Referral.id))
            .where(Referral.referrer_id == current_user.id)
            .where(Referral.status == "active")
        )
        active_referrals = result.scalar() or 0

        # БЕРЕМ ДАННЫЕ ИЗ USERS ТАБЛИЦЫ
        # Общий комиссионный доход (всего заработано)
        total_commission = current_user.total_commission or 0

        # Ожидаемый доход (доступно к выплате)
        pending_commission = current_user.pending_commission or 0

        # Выплаченный доход (уже выплачено)
        paid_commission = current_user.paid_commission or 0

        # Текущий ранг
        rank = current_user.referral_rank or "Bronze"

        # Следующий ранг
        ranks = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"]
        try:
            idx = ranks.index(rank)
            next_rank = ranks[idx + 1] if idx < len(ranks) - 1 else "Diamond"
        except:
            next_rank = "Silver"

        # Процент комиссии
        commission_rates = {
            "Bronze": 5,
            "Silver": 7,
            "Gold": 10,
            "Platinum": 12,
            "Diamond": 15
        }
        commission_rate = commission_rates.get(rank, 5)

        return {
            "success": True,
            "stats": {
                "total_referrals": total_referrals,
                "active_referrals": active_referrals,
                "total_commission": float(total_commission),
                "pending_commission": float(pending_commission),
                "paid_commission": float(paid_commission),
                "lifetime_value": float(current_user.lifetime_value or 0),
                "referral_rank": rank,
                "next_rank": next_rank,
                "commission_rate": commission_rate
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/referrals")
async def get_referrals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Список рефералов"""
    try:
        result = await db.execute(
            select(Referral, User)
            .join(User, Referral.referred_id == User.id)
            .where(Referral.referrer_id == current_user.id)
            .order_by(Referral.joined_at.desc())
            .limit(50)
        )
        rows = result.all()

        referrals_list = []
        for ref, user in rows:
            referrals_list.append({
                "id": user.id,
                "name": user.name or "Аноним",
                "email": user.email,
                "joined_at": ref.joined_at.isoformat() if ref.joined_at else None,
                "status": ref.status or "active",
                "total_deposit": float(ref.total_deposit or 0),
                "commission_earned": float(ref.commission_earned or 0)
            })

        return {
            "success": True,
            "referrals": referrals_list,
            "total": len(referrals_list)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/commissions")
async def get_commissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """История комиссий"""
    try:
        result = await db.execute(
            select(Commission)
            .where(Commission.user_id == current_user.id)
            .order_by(Commission.created_at.desc())
            .limit(50)
        )
        commissions = result.scalars().all()

        commissions_list = []
        for comm in commissions:
            commissions_list.append({
                "id": comm.id,
                "amount": float(comm.amount),
                "type": comm.type or "trade",
                "status": comm.status or "pending",
                "description": comm.description or f"Комиссия {comm.type or 'trade'}",
                "created_at": comm.created_at.isoformat() if comm.created_at else None,
                "paid_at": comm.paid_at.isoformat() if comm.paid_at else None
            })

        return {
            "success": True,
            "commissions": commissions_list,
            "total": len(commissions_list)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payouts")
async def get_user_payouts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """История выплат пользователя"""
    try:
        result = await db.execute(
            select(PartnerPayout)
            .where(PartnerPayout.user_id == current_user.id)
            .order_by(PartnerPayout.created_at.desc())
            .limit(50)
        )
        payouts = result.scalars().all()

        payouts_list = []
        for payout in payouts:
            payouts_list.append({
                "id": payout.id,
                "amount": float(payout.amount),
                "method": payout.method or "bank_transfer",
                "details": payout.details,
                "status": payout.status or "pending",
                "created_at": payout.created_at.isoformat() if payout.created_at else None,
                "processed_at": payout.processed_at.isoformat() if payout.processed_at else None
            })

        return {
            "success": True,
            "payouts": payouts_list,
            "total": len(payouts_list)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/request-payout")
async def request_payout(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Запрос на выплату"""
    try:
        amount = float(data.get("amount", 0))
        method = data.get("method", "bank_transfer")
        details = data.get("details", "")
        
        if amount < 100:
            raise HTTPException(
                status_code=400,
                detail="Минимальная сумма выплаты 100$"
            )
        
        if amount > (current_user.pending_commission or 0):
            raise HTTPException(
                status_code=400,
                detail=f"Недостаточно средств. Доступно: ${current_user.pending_commission or 0}"
            )
        
        # Создаем заявку на выплату
        payout = PartnerPayout(
            user_id=current_user.id,
            amount=amount,
            method=method,
            details=details,
            status="pending"
        )
        db.add(payout)

        # Обновляем статус комиссий (помечаем как "reserved" для выплаты)
        result = await db.execute(
            select(Commission)
            .where(Commission.user_id == current_user.id)
            .where(Commission.status == "pending")
            .order_by(Commission.created_at)
        )
        pending_commissions = result.scalars().all()

        total_to_reserve = 0
        for comm in pending_commissions:
            comm.status = "reserved"  # Меняем на reserved вместо paid
            comm.paid_at = datetime.utcnow()
            total_to_reserve += comm.amount
            if total_to_reserve >= amount:
                break

        # Обновляем балансы пользователя
        # Только уменьшаем pending, paid обновляется только когда админ подтвердит выплату
        current_user.pending_commission = (current_user.pending_commission or 0) - amount

        await db.commit()
        
        return {
            "success": True,
            "message": f"Заявка на выплату {amount}$ создана",
            "payout_id": payout.id,
            "amount": amount,
            "method": method
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ranks")
async def get_partner_ranks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Список всех рангов и требований"""
    ranks = [
        {
            "name": "Bronze",
            "min_referrals": 0,
            "min_deposit": 0,
            "commission_rate": 5,
            "color": "amber-600",
            "icon": "Award"
        },
        {
            "name": "Silver",
            "min_referrals": 10,
            "min_deposit": 1000,
            "commission_rate": 7,
            "color": "gray-400",
            "icon": "Award"
        },
        {
            "name": "Gold",
            "min_referrals": 25,
            "min_deposit": 5000,
            "commission_rate": 10,
            "color": "yellow-500",
            "icon": "Crown"
        },
        {
            "name": "Platinum",
            "min_referrals": 50,
            "min_deposit": 10000,
            "commission_rate": 12,
            "color": "blue-400",
            "icon": "Star"
        },
        {
            "name": "Diamond",
            "min_referrals": 100,
            "min_deposit": 25000,
            "commission_rate": 15,
            "color": "purple-500",
            "icon": "Crown"
        }
    ]
    
    current_rank = current_user.referral_rank or "Bronze"
    
    return {
        "success": True,
        "ranks": ranks,
        "current_rank": current_rank
    }
