# PocketOption API Service
# Сервис для синхронизации данных с PocketOption API

import httpx
from typing import Optional, Dict, Any
from datetime import datetime
import asyncio
import hashlib
from app.config import get_settings

settings = get_settings()


class PocketOptionAPIError(Exception):
    """Ошибка при работе с PocketOption API"""
    pass


class PocketOptionService:
    """
    Сервис для работы с PocketOption Affiliate API
    Синхронизация баланса и данных пользователя
    """
    
    def __init__(self):
        # API данные из конфига
        self.api_token = settings.POCKETOPTION_API_TOKEN
        self.partner_id = settings.NEXT_PUBLIC_PARTNER_ID
        self.base_url = "https://affiliate.pocketoption.com/api"
        self.timeout = 30.0  # секунд
        
    def _generate_hash(self, user_id: str) -> str:
        """
        Генерация hash для API запроса
        hash = md5("{user_id}:{partner_id}:{api_token}")
        """
        hash_string = f"{user_id}:{self.partner_id}:{self.api_token}"
        return hashlib.md5(hash_string.encode()).hexdigest()
    
    async def get_user_data(self, pocket_option_id: str) -> Optional[Dict[str, Any]]:
        """
        Получение данных пользователя из PocketOption API
        API: https://affiliate.pocketoption.com/api/user-info/{user_id}/{partner_id}/{hash}
        """
        try:
            # Генерируем hash для запроса
            api_hash = self._generate_hash(pocket_option_id)

            # Формируем URL
            url = f"{self.base_url}/user-info/{pocket_option_id}/{self.partner_id}/{api_hash}"

            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(url)

                if response.status_code == 200:
                    data = response.json()
                    return self._parse_user_data(data, pocket_option_id)
                elif response.status_code == 404:
                    print(f"⚠️ Пользователь {pocket_option_id} не найден в PocketOption")
                    return None
                else:
                    error_msg = f"PocketOption API error: {response.status_code}"
                    print(f"❌ {error_msg}")
                    # Логируем только первые 200 символов ответа
                    print(f"Response: {response.text[:200]}")
                    raise PocketOptionAPIError(error_msg)

        except httpx.RequestError as e:
            error_msg = f"Request failed: {str(e)}"
            print(f"❌ {error_msg}")
            # НЕ возвращаем mock данные - выбрасываем ошибку
            raise PocketOptionAPIError(f"PocketOption API недоступно: {str(e)}")
    
    def _parse_user_data(self, api_response: Dict, pocket_option_id: str) -> Dict[str, Any]:
        """
        Парсинг ответа от PocketOption API
        """
        # Структура ответа ответа API (адаптируем под нашу схему)
        # PO Affiliate API использует другие ключи
        print(f"📦 PO API Response: {api_response}")
        
        return {
            "pocket_option_id": pocket_option_id,
            "email": api_response.get("email", ""),
            "current_balance": float(api_response.get("balance", 0)),
            "total_deposit": float(api_response.get("sum_deposits", api_response.get("totalDeposit", 0))),
            "total_withdrawal": float(api_response.get("sum_withdrawals", api_response.get("totalWithdrawal", 0))),
            "deposits_count": int(api_response.get("count_deposits", api_response.get("depositsCount", 0))),
            "withdrawals_count": int(api_response.get("count_withdrawals", api_response.get("withdrawalsCount", 0))),
            "verification_status": api_response.get("verificationStatus", "verified" if api_response.get("is_verified") else "pending"),
            "reg_date": api_response.get("reg_date", datetime.utcnow().isoformat()),
            "last_sync": datetime.utcnow().isoformat(),
        }
    
    async def get_balance(self, pocket_option_id: str) -> float:
        """
        Получение текущего баланса пользователя
        Возвращает 0 если API недоступно
        """
        try:
            user_data = await self.get_user_data(pocket_option_id)
            
            if not user_data:
                print(f"⚠️ Пользователь не найден, возвращаем баланс 0")
                return 0.0
            
            return user_data.get("current_balance", 0.0)
            
        except PocketOptionAPIError as e:
            print(f"❌ API недоступно: {e}")
            # Возвращаем 0 вместо mock данных
            return 0.0
    
    async def sync_user_data(self, pocket_option_id: str) -> Dict[str, Any]:
        """
        Полная синхронизация данных пользователя
        """
        try:
            user_data = await self.get_user_data(pocket_option_id)
            
            if not user_data:
                return {
                    "success": False,
                    "error": "User not found in PocketOption",
                }
            
            return {
                "success": True,
                "data": user_data
            }
        except PocketOptionAPIError as e:
            return {
                "success": False,
                "error": str(e),
            }
    
    def _get_mock_data(self, pocket_option_id: str) -> Dict[str, Any]:
        """
        Mock данные удалены - используем только реальные данные из API
        """
        raise NotImplementedError("Mock данные отключены. Используйте только реальный PocketOption API.")


# Singleton instance
pocket_option_service = PocketOptionService()


def get_pocket_option_service() -> PocketOptionService:
    """Получение экземпляра сервиса"""
    return pocket_option_service


async def sync_balance_with_po(pocket_option_id: str) -> float:
    """
    Быстрая функция для синхронизации баланса
    """
    service = get_pocket_option_service()
    return await service.get_balance(pocket_option_id)
