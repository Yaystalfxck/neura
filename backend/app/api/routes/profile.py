from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User
from app.schemas import UserUpdate, UserResponse, APIResponse
from app.dependencies import get_current_user
from app.pocketoption_service import get_pocket_option_service
from app.balance_utils import get_user_balance
from app.utils import get_password_hash

router = APIRouter(prefix="/api", tags=["Profile"])


@router.get("/profile", response_model=dict)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение профиля пользователя с синхронизацией баланса"""
    try:
        # Для flaun.feed@mail.ru получаем баланс с демо-счёта через WebSocket
        if current_user.email == "flaun.feed@mail.ru":
            po_balance = await get_user_balance(current_user, db)
        else:
            # Для остальных - синхронизация с PO Affiliate API
            from app.balance_utils import get_user_balance
            po_balance = await get_user_balance(current_user, db, sync_with_po=True)

        if abs(po_balance - current_user.balance) > 0.01:
            current_user.balance = po_balance
            await db.commit()
    except Exception as e:
        print(f"⚠️ Не удалось синхронизировать баланс: {str(e)}")

    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "pocket_option_id": current_user.pocket_option_id,
            "balance": current_user.balance,
            "phone": current_user.phone,
            "country": current_user.country,
            "language": current_user.language,
            "status": current_user.status,
            "role": current_user.role,
            "referral_code": current_user.referral_code,
            "total_referrals": current_user.total_referrals,
            "total_commission": current_user.total_commission,
            "pending_commission": current_user.pending_commission,
            "paid_commission": current_user.paid_commission,
            "created_at": current_user.created_at,
        }
    }


@router.put("/profile", response_model=dict)
async def update_profile(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновление профиля"""
    update_data = user_data.model_dump(exclude_unset=True)
    
    print(f"📝 Update profile for {current_user.email}:")
    print(f"   Received data: {update_data}")

    for field, value in update_data.items():
        if hasattr(current_user, field):
            old_value = getattr(current_user, field)
            setattr(current_user, field, value)
            print(f"   Updated {field}: {old_value} → {value}")

    await db.commit()
    await db.refresh(current_user)
    
    print(f"✅ Profile updated successfully")

    return {
        "success": True,
        "message": "Профиль успешно обновлен",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "pocket_option_id": current_user.pocket_option_id,
            "balance": current_user.balance,
            "phone": current_user.phone,
            "country": current_user.country,
            "language": current_user.language,
            "status": current_user.status,
            "role": current_user.role,
        }
    }


@router.put("/profile/password", response_model=dict)
async def change_password(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Смена пароля"""
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        raise HTTPException(status_code=400, detail="Заполните все поля")

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Пароль должен содержать минимум 6 символов")

    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    if not pwd_context.verify(old_password, current_user.password):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")

    current_user.password = get_password_hash(new_password)
    await db.commit()

    return {"success": True, "message": "Пароль успешно изменен"}
