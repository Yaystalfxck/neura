from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User, ReferralLink, Referral
from app.schemas import UserCreate, UserResponse, APIResponse
from app.utils import get_password_hash, generate_referral_code
from app.dependencies import validate_pocketoption_id
from app.config import get_settings
import random
import string
from datetime import datetime

settings = get_settings()

router = APIRouter(prefix="/api", tags=["Auth"])


def generate_random_pocket_id() -> str:
    """Генерация случайного PocketOption ID для теста"""
    return "PO" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))


@router.post("/register", response_model=dict)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Регистрация нового пользователя"""
    referral_code = user_data.referral_code
    # Проверка существующего email
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован",
        )

    # Валидация PocketOption ID
    if not validate_pocketoption_id(user_data.pocket_option_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат PocketOption ID",
        )

    # Проверка существующего PocketOption ID
    result = await db.execute(
        select(User).where(User.pocket_option_id == user_data.pocket_option_id)
    )
    existing_po = result.scalar_one_or_none()

    if existing_po:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Этот PocketOption ID уже используется",
        )

    # Хеширование пароля
    hashed_password = get_password_hash(user_data.password)

    # Генерация реферального кода
    referral_code_generated = generate_referral_code(0)  # ID будет после создания

    # Создание пользователя
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password=hashed_password,
        pocket_option_id=user_data.pocket_option_id,
        phone=user_data.phone,
        country=user_data.country,
        language=user_data.language,
        referral_code=referral_code_generated,
    )

    db.add(new_user)
    await db.flush()  # Чтобы получить ID

    # Обновление реферального кода с ID
    new_user.referral_code = generate_referral_code(new_user.id)

    # Создание реферальной ссылки
    referral_link = ReferralLink(
        user_id=new_user.id,
        code=new_user.referral_code,
        url=f"{settings.FRONTEND_URL}/?ref={new_user.referral_code}",
        is_active=True,
    )
    db.add(referral_link)

    # Если есть реферальный код, создаем связь
    referrer_user = None
    if referral_code:
        result = await db.execute(
            select(ReferralLink).where(ReferralLink.code == referral_code)
        )
        referrer_link = result.scalar_one_or_none()
        
        if referrer_link:
            referrer_user = await db.execute(
                select(User).where(User.id == referrer_link.user_id)
            )
            referrer_user = referrer_user.scalar_one_or_none()
            
            if referrer_user:
                # Создаем запись о реферале
                referral = Referral(
                    referrer_id=referrer_user.id,
                    referred_id=new_user.id,
                    referral_link_id=referrer_link.id,
                    status="active",
                    joined_at=datetime.utcnow()
                )
                db.add(referral)
                
                # Увеличиваем счетчики у пригласившего
                referrer_user.total_referrals = (referrer_user.total_referrals or 0) + 1
                referrer_user.active_referrals = (referrer_user.active_referrals or 0) + 1
                
                # Увеличиваем регистрации у реферальной ссылки
                referrer_link.registrations = (referrer_link.registrations or 0) + 1
                
                print(f"✅ Referral registered: {referrer_user.email} -> {new_user.email}")

    await db.commit()
    await db.refresh(new_user)

    return {
        "success": True,
        "message": "Регистрация успешно завершена!",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "pocket_option_id": new_user.pocket_option_id,
            "balance": new_user.balance,
            "status": new_user.status,
            "role": new_user.role,
            "referral_code": new_user.referral_code,
        },
        "referrer": {
            "found": referrer_user is not None,
            "email": referrer_user.email if referrer_user else None
        } if referral_code else None
    }


# Import settings here to avoid circular import
from app.config import get_settings
settings = get_settings()
