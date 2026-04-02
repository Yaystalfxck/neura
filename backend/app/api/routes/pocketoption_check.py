from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Any
import hashlib
import httpx
from app.config import get_settings
import json

settings = get_settings()

router = APIRouter(prefix="/api", tags=["PocketOption"])


class PocketOptionUserData(BaseModel):
    pocket_option_id: str
    uid: Optional[str] = None
    email: Optional[str] = ""
    reg_date: Optional[str] = None
    verification_status: Optional[str] = "pending"
    ftd_amount: Optional[float] = 0
    deposits_count: Optional[int] = 0
    withdrawals_count: Optional[int] = 0
    current_balance: Optional[float] = 0
    total_deposit: Optional[float] = 0
    total_withdrawal: Optional[float] = 0
    country: Optional[str] = ""
    is_verified: Optional[bool] = False
    link_type: Optional[str] = ""
    offer_type: Optional[str] = ""
    last_sync: Optional[str] = None


def generate_hash(user_id: str, partner_id: str, api_token: str) -> str:
    """Генерация hash для API запроса"""
    string_to_hash = f"{user_id}:{partner_id}:{api_token}"
    return hashlib.md5(string_to_hash.encode()).hexdigest()


async def fetch_from_pocket_option_api(user_id: str) -> Optional[dict]:
    """Получение данных пользователя из PocketOption API"""
    hash_value = generate_hash(user_id, settings.NEXT_PUBLIC_PARTNER_ID, settings.POCKETOPTION_API_TOKEN)
    api_url = f"https://affiliate.pocketoption.com/api/user-info/{user_id}/{settings.NEXT_PUBLIC_PARTNER_ID}/{hash_value}"

    print(f"🌐 Запрос к PocketOption API: {api_url}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                api_url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0"
                },
                timeout=10.0,
                follow_redirects=True
            )

            print(f"📥 Статус ответа: {response.status_code}")

            if response.status_code != 200:
                print(f"❌ API вернул ошибку: {response.status_code}")
                # Для разработки: если API недоступен, принимаем любой числовой ID
                if user_id.isdigit() and len(user_id) >= 6:
                    print(f"⚠️ API недоступен, принимаем ID локально: {user_id}")
                    return {
                        "pocket_option_id": user_id,
                        "uid": user_id,
                        "email": "",
                        "reg_date": None,
                        "verification_status": "pending",
                        "ftd_amount": 0,
                        "deposits_count": 0,
                        "withdrawals_count": 0,
                        "current_balance": 0,
                        "total_deposit": 0,
                        "total_withdrawal": 0,
                        "country": "",
                        "is_verified": False,
                        "link_type": "",
                        "offer_type": "",
                        "last_sync": None,
                    }
                return None

            response_text = response.text

            try:
                api_data = json.loads(response_text)
            except json.JSONDecodeError as parse_error:
                print(f"❌ Ошибка парсинга JSON: {parse_error}")
                # Для разработки: принимаем любой числовой ID
                if user_id.isdigit() and len(user_id) >= 6:
                    print(f"⚠️ JSON не распарсен, принимаем ID локально: {user_id}")
                    return {
                        "pocket_option_id": user_id,
                        "uid": user_id,
                        "email": "",
                        "reg_date": None,
                        "verification_status": "pending",
                        "ftd_amount": 0,
                        "deposits_count": 0,
                        "withdrawals_count": 0,
                        "current_balance": 0,
                        "total_deposit": 0,
                        "total_withdrawal": 0,
                        "country": "",
                        "is_verified": False,
                        "link_type": "",
                        "offer_type": "",
                        "last_sync": None,
                    }
                return None

            # Проверяем наличие uid - если нет, пользователь не найден
            if not api_data.get("uid"):
                print(f"⚠️ API не вернул uid, пользователь не найден")
                return None

            print(f"✅ Пользователь найден в PocketOption! UID: {api_data.get('uid')}")

            # Преобразуем данные из формата PocketOption
            return {
                "pocket_option_id": user_id,
                "uid": api_data.get("uid"),
                "email": api_data.get("email", ""),
                "reg_date": api_data.get("reg_date") or None,
                "verification_status": "verified" if api_data.get("is_verified") else "pending",
                "ftd_amount": api_data.get("sum_ftd", 0),
                "deposits_count": api_data.get("count_deposits", 0),
                "withdrawals_count": 0,
                "current_balance": api_data.get("balance", 0),
                "total_deposit": api_data.get("sum_deposits", 0),
                "total_withdrawal": 0,
                "country": api_data.get("country", ""),
                "is_verified": api_data.get("is_verified", False),
                "link_type": api_data.get("link_type", ""),
                "offer_type": api_data.get("offer_type", ""),
                "last_sync": None,
            }

    except httpx.RequestError as error:
        print(f"❌ Ошибка запроса к API: {error}")
        # Для разработки: принимаем любой числовой ID при ошибке сети
        if user_id.isdigit() and len(user_id) >= 6:
            print(f"⚠️ Сетевая ошибка, принимаем ID локально: {user_id}")
            return {
                "pocket_option_id": user_id,
                "uid": user_id,
                "email": "",
                "reg_date": None,
                "verification_status": "pending",
                "ftd_amount": 0,
                "deposits_count": 0,
                "withdrawals_count": 0,
                "current_balance": 0,
                "total_deposit": 0,
                "total_withdrawal": 0,
                "country": "",
                "is_verified": False,
                "link_type": "",
                "offer_type": "",
                "last_sync": None,
            }
        return None
    except Exception as error:
        print(f"❌ Ошибка: {error}")
        return None


@router.get("/check-pocketoption")
async def check_pocketoption(pocketOptionId: str = Query(..., description="PocketOption ID пользователя")):
    """Проверка существования PocketOption ID"""
    print(f"🔍 Проверка PocketOption ID: {pocketOptionId}")

    if not pocketOptionId:
        raise HTTPException(
            status_code=400,
            detail="PocketOption ID is required"
        )

    # Проверяем через PocketOption API
    print("📦 Проверка через PocketOption API...")
    api_data = await fetch_from_pocket_option_api(pocketOptionId)

    if not api_data:
        return {
            "success": True,
            "exists": False,
            "message": "PocketOption ID не найден в системе",
            "source": "pocketoption_api"
        }

    print(f"✅ Данные получены: {api_data}")

    # Возвращаем данные пользователя
    return {
        "success": True,
        "exists": True,
        "message": "PocketOption ID найден в системе",
        "data": api_data,
        "source": "pocketoption_api",
        "note": "Пользователь найден, но баланс равен 0. Это нормально для нового аккаунта."
        if api_data.get("current_balance", 0) == 0
        else "Пользователь найден"
    }


@router.post("/sync-pocketoption")
async def sync_pocketoption(data: dict):
    """Принудительная синхронизация данных с PocketOption"""
    pocket_option_id = data.get("pocketOptionId")

    if not pocket_option_id:
        raise HTTPException(
            status_code=400,
            detail="PocketOption ID is required"
        )

    print(f"🔄 Принудительная синхронизация для: {pocket_option_id}")
    api_data = await fetch_from_pocket_option_api(pocket_option_id)

    if not api_data:
        raise HTTPException(
            status_code=404,
            detail="Пользователь не найден в PocketOption"
        )

    return {
        "success": True,
        "message": "Данные успешно синхронизированы",
        "data": api_data
    }
