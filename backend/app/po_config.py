# Pocket Option API Configuration
# Конфигурация для интеграции с Pocket Option API

import os
from typing import Optional


class POConfig:
    """Конфигурация Pocket Option API"""
    
    # API Endpoints
    API_BASE_URL = os.getenv("PO_API_URL", "https://api-pocket-option.com")
    WS_URL = os.getenv("PO_WS_URL", "wss://ws-pocket-option.com")
    
    # Авторизация
    SESSION_TOKEN = os.getenv("PO_SESSION_TOKEN", "")
    UID = os.getenv("PO_UID", "")
    
    # Настройки торговли
    DEFAULT_MIN_PAYOUT = int(os.getenv("PO_MIN_PAYOUT", "80"))
    DEFAULT_TIMEFRAME = int(os.getenv("PO_DEFAULT_TIMEFRAME", "60"))
    MAX_TRADE_AMOUNT = float(os.getenv("PO_MAX_TRADE_AMOUNT", "100"))
    
    # Кэширование
    CACHE_TTL = int(os.getenv("PO_CACHE_TTL", "60"))  # секунд
    
    # Лимиты
    MAX_REQUESTS_PER_MINUTE = int(os.getenv("PO_RATE_LIMIT", "60"))
    
    @classmethod
    def is_configured(cls) -> bool:
        """Проверка настроенности API"""
        return bool(cls.SESSION_TOKEN and cls.UID)
    
    @classmethod
    def get_credentials(cls) -> dict:
        """Получение учетных данных"""
        return {
            "session_token": cls.SESSION_TOKEN,
            "uid": cls.UID
        }


# Глобальная конфигурация
po_config = POConfig()
