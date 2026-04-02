from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import UserResponse
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/api", tags=["Auth"])


@router.get("/auth", response_model=dict)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Получение информации о текущем пользователе"""
    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "pocket_option_id": current_user.pocket_option_id,
            "balance": current_user.balance,
            "status": current_user.status,
            "role": current_user.role,
            "created_at": current_user.created_at,
        }
    }


@router.post("/auth/logout")
async def logout():
    """Выход из системы (клиент должен удалить токен)"""
    return {"success": True, "message": "Выход выполнен успешно"}
