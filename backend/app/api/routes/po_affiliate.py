from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
import hashlib
import httpx
import json
from datetime import datetime
from app.database import get_db
from app.models import User, Referral, Commission
from app.config import get_settings
from app.api.routes.referral_tracking import check_and_update_rank

settings = get_settings()

router = APIRouter(prefix="/api/po", tags=["PocketOption Affiliate"])


def generate_hash(user_id: str, partner_id: str, api_token: str) -> str:
    """Генерация hash для API запроса"""
    string_to_hash = f"{user_id}:{partner_id}:{api_token}"
    return hashlib.md5(string_to_hash.encode()).hexdigest()


class DepositRecord(BaseModel):
    """Модель депозита из PO API"""
    id: Optional[str] = None
    amount: float
    date: Optional[str] = None
    status: Optional[str] = "completed"


async def fetch_deposits_from_po(pocket_option_id: str) -> List[dict]:
    """Получение списка депозитов из PocketOption API"""
    hash_value = generate_hash(
        pocket_option_id, 
        settings.NEXT_PUBLIC_PARTNER_ID, 
        settings.POCKETOPTION_API_TOKEN
    )
    
    # Пробуем разные эндпоинты для депозитов
    urls = [
        f"https://affiliate.pocketoption.com/api/deposits/{pocket_option_id}/{settings.NEXT_PUBLIC_PARTNER_ID}/{hash_value}",
        f"https://affiliate.pocketoption.com/en/api/user-info/{pocket_option_id}/{settings.NEXT_PUBLIC_PARTNER_ID}/{hash_value}",
    ]
    
    for api_url in urls:
        print(f"🌐 Запрос к PO API: {api_url}")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    api_url,
                    headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
                    timeout=10.0,
                    follow_redirects=True
                )
                
                print(f"📥 Статус: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Если это данные пользователя, извлекаем депозиты
                    if isinstance(data, dict) and "sum_deposits" in data:
                        return [{
                            "id": f"po_{pocket_option_id}_{data.get('sum_deposits', 0)}",
                            "amount": data.get("sum_deposits", 0),
                            "date": data.get("reg_date", datetime.utcnow().isoformat()),
                            "status": "completed"
                        }]
                    
                    # Если это список депозитов
                    if isinstance(data, list):
                        return data
                    
        except Exception as e:
            print(f"❌ Ошибка запроса: {e}")
            continue
    
    return []


@router.get("/sync-referrals/{user_id}")
async def sync_referrals_status(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Синхронизация статуса рефералов из PocketOption Affiliate API
    Обновляет active/inactive статус для каждого реферала
    """
    try:
        from app.models import User as UserModel
        
        # Находим пользователя
        result = await db.execute(
            select(UserModel).where(UserModel.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Получаем всех рефералов пользователя
        referrals_result = await db.execute(
            select(Referral).where(Referral.referrer_id == user_id)
        )
        referrals = referrals_result.scalars().all()

        if not referrals:
            return {
                "success": True,
                "message": "No referrals to sync",
                "synced": 0
            }

        synced_count = 0
        
        # Для каждого реферала проверяем статус через PO API
        for referral in referrals:
            # Получаем referred пользователя
            referred_result = await db.execute(
                select(UserModel).where(UserModel.id == referral.referred_id)
            )
            referred_user = referred_result.scalar_one_or_none()
            
            if not referred_user or not referred_user.pocket_option_id:
                continue

            # Получаем данные из PO API
            hash_value = generate_hash(
                str(referred_user.pocket_option_id),
                settings.NEXT_PUBLIC_PARTNER_ID,
                settings.POCKETOPTION_API_TOKEN
            )

            api_url = f"https://affiliate.pocketoption.com/api/user-info/{referred_user.pocket_option_id}/{settings.NEXT_PUBLIC_PARTNER_ID}/{hash_value}"
            
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        api_url,
                        headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
                        timeout=5.0,
                        follow_redirects=True
                    )

                    if response.status_code == 200:
                        po_data = response.json()
                        
                        # Определяем активность по последнему депозиту или дате регистрации
                        is_active = False
                        
                        # Если есть сумма депозитов > 0, считаем активным
                        if po_data.get('sum_deposits', 0) > 0:
                            is_active = True
                        
                        # Если есть сумма вывода, тоже активен
                        if po_data.get('sum_withdraw', 0) > 0:
                            is_active = True
                        
                        # Обновляем статус
                        old_status = referral.status
                        new_status = 'active' if is_active else 'inactive'
                        
                        if old_status != new_status:
                            referral.status = new_status
                            referral.last_active = datetime.utcnow()
                            print(f"  ✅ Updated referral {referral.id}: {old_status} → {new_status}")
                            synced_count += 1

                    await db.commit()
                    
            except Exception as api_err:
                print(f"  ⚠️ PO API Error for {referred_user.pocket_option_id}: {api_err}")
                continue

        return {
            "success": True,
            "message": f"Synced {synced_count} referral statuses",
            "synced": synced_count,
            "total": len(referrals)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sync-deposits/{user_id}")
async def sync_deposits(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Синхронизация депозитов из PO Affiliate API
    Автоматически находит пользователя по PocketOption ID
    """
    try:
        # Находим пользователя
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if not user.pocket_option_id:
            raise HTTPException(
                status_code=400, 
                detail="PocketOption ID не указан у пользователя"
            )
        
        print(f"🔄 Синхронизация депозитов для {user.email} (PO: {user.pocket_option_id})")
        
        # Получаем депозиты из PO API
        po_deposits = await fetch_deposits_from_po(user.pocket_option_id)
        
        if not po_deposits:
            return {
                "success": True,
                "message": "Депозиты не найдены в PO API",
                "deposits_synced": 0,
                "commissions_created": 0
            }
        
        # Находим реферала (кто пригласил этого пользователя)
        referral_result = await db.execute(
            select(Referral).where(Referral.referred_id == user.id)
        )
        referral = referral_result.scalar_one_or_none()
        
        synced_count = 0
        commissions_created = 0
        total_amount = 0
        
        for dep in po_deposits:
            amount = float(dep.get("amount", 0))
            if amount <= 0:
                continue
                
            dep_id = dep.get("id", f"po_{user.id}_{datetime.utcnow().timestamp()}")
            
            # Проверяем, не была ли уже комиссия за этот депозит
            existing = await db.execute(
                select(Commission).where(Commission.source == dep_id)
            )
            if existing.scalar_one_or_none():
                print(f"⏭️  Комиссия уже есть для {dep_id}")
                continue
            
            # Если есть реферал - создаем комиссию
            if referral:
                referrer_result = await db.execute(
                    select(User).where(User.id == referral.referrer_id)
                )
                referrer = referrer_result.scalar_one_or_none()
                
                if referrer:
                    # Определяем процент комиссии
                    commission_rates = {
                        "Bronze": 5, "Silver": 7, "Gold": 10,
                        "Platinum": 12, "Diamond": 15
                    }
                    rate = commission_rates.get(referrer.referral_rank or "Bronze", 5)
                    commission_amount = amount * (rate / 100)
                    
                    # Создаем комиссию
                    commission = Commission(
                        user_id=referrer.id,
                        referral_id=referral.id,
                        amount=commission_amount,
                        type="deposit_sync",
                        status="pending",
                        description=f"Комиссия {rate}% с депозита ${amount} (PO Sync)",
                        source=dep_id,
                        created_at=datetime.utcnow()
                    )
                    db.add(commission)
                    
                    # Обновляем данные реферала
                    referral.first_deposit = min(referral.first_deposit or amount, amount)
                    referral.total_deposit = (referral.total_deposit or 0) + amount
                    referral.commission_earned = (referral.commission_earned or 0) + commission_amount
                    
                    referrer.total_commission = (referrer.total_commission or 0) + commission_amount
                    referrer.pending_commission = (referrer.pending_commission or 0) + commission_amount
                    referrer.lifetime_value = (referrer.lifetime_value or 0) + commission_amount
                    
                    # Проверяем ранг
                    await check_and_update_rank(referrer, db)
                    
                    commissions_created += 1
                    print(f"💰 Комиссия ${commission_amount} создана для {referrer.email}")
            
            synced_count += 1
            total_amount += amount
        
        await db.commit()
        
        return {
            "success": True,
            "message": f"Синхронизация завершена",
            "user": user.email,
            "pocket_option_id": user.pocket_option_id,
            "deposits_synced": synced_count,
            "total_deposit_amount": total_amount,
            "commissions_created": commissions_created
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error syncing deposits: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user-info/{pocket_option_id}")
async def get_user_info(pocket_option_id: str):
    """Получение информации о пользователе из PO API"""
    hash_value = generate_hash(
        pocket_option_id,
        settings.NEXT_PUBLIC_PARTNER_ID,
        settings.POCKETOPTION_API_TOKEN
    )
    
    api_url = f"https://affiliate.pocketoption.com/api/user-info/{pocket_option_id}/{settings.NEXT_PUBLIC_PARTNER_ID}/{hash_value}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                api_url,
                headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
                timeout=10.0,
                follow_redirects=True
            )
            
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            else:
                return {"success": False, "error": f"API returned {response.status_code}"}
                
    except Exception as e:
        return {"success": False, "error": str(e)}
