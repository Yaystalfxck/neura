from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db, close_db
from app.api import router
from app.config import get_settings
from app.po_websocket_service import _pocket_option_ws
from app.api.routes.signal_po import close_all_po_connections, _po_pool

settings = get_settings()

app = FastAPI(
    title="Neura API",
    description="Backend API for Neura Trading Platform",
    version="1.0.0",
)

# CORS для всех источников (для разработки)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",  # Разрешить все origins для разработки
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.109:3000",
        "http://192.168.0.109:8000",
        "http://192.168.31.96:3000",
        "http://192.168.31.96:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутов
app.include_router(router)


@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске"""
    await init_db()
    print("✅ Database initialized")
    print(f"🚀 Neura API running on {settings.API_URL}")
    # BinaryOptionsToolsV2 не требует keepalive — соединения создаются по запросу




@app.on_event("shutdown")
async def shutdown_event():
    """Очистка при остановке"""
    await close_db()
    print("📦 Database connection closed")
    
    # Закрываем PO Connection Pool
    await close_all_po_connections()
    print("✅ PO Connection Pool closed")
    
    # Закрываем WebSocket соединение с Pocket Option (старый сервис)
    if _pocket_option_ws and _pocket_option_ws.is_connected():
        print("🔌 Closing Pocket Option WebSocket connection...")
        await _pocket_option_ws.disconnect()
        print("✅ Pocket Option WebSocket closed")


@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "ok",
        "message": "Neura API is running",
        "version": "1.0.0",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
