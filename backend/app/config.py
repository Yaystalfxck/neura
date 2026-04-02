from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://neura:neura_password@localhost:5432/neura_db"
    
    # JWT
    SECRET_KEY: str = "your-super-secret-key-change-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 7
    
    # SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "Neura Trading <noreply@neura.com>"
    
    # API
    API_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"  # Было http://192.168.0.109:3000
    
    # PocketOption API
    POCKETOPTION_API_TOKEN: str = "wOAxQ6FMHDL2PiOidmyZ"
    NEXT_PUBLIC_PARTNER_ID: str = "828455"
    POCKETOPTION_EMAIL: str = ""
    POCKETOPTION_PASSWORD: str = ""
    POCKETOPTION_API_KEY: str = ""  # Для совместимости
    
    # PocketOption WebSocket
    POCKETOPTION_SSID: str = ""
    POCKETOPTION_UUID: str = ""
    POCKETOPTION_CI_SESSION: str = ""
    POCKETOPTION_SESSION_TOKEN: str = ""
    POCKETOPTION_SESSION_TOKEN_DEMO: str = ""
    POCKETOPTION_UID: str = ""
    POCKETOPTION_WS_URL: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
