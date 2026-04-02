#!/usr/bin/env python3
"""
Простой тест PocketOption WebSocket
Запуск: python3 test_po_simple.py
"""

import asyncio
import sys
sys.path.insert(0, '.')

from app.config import get_settings
from pocketoptionapi_async import AsyncPocketOptionClient

settings = get_settings()

async def test_demo():
    """Тест демо подключения"""
    print("🔌 Тест ДЕМО подключения...")
    
    ssid = f'42["auth",{{"session":"{settings.POCKETOPTION_SESSION_TOKEN_DEMO}","isDemo":1,"uid":{settings.POCKETOPTION_UID},"platform":1}}]'
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=True, enable_logging=False)
    
    try:
        # Подключение с таймаутом
        connected = await asyncio.wait_for(client.connect(), timeout=10.0)
        
        if connected:
            print("✅ Подключено!")
            
            # Баланс
            balance = await asyncio.wait_for(client.get_balance(), timeout=5.0)
            if balance:
                if hasattr(balance, 'balance'):
                    print(f"💰 Баланс: ${balance.balance}")
                else:
                    print(f"💰 Баланс: ${balance}")
            
            await client.disconnect()
            return True
        else:
            print("❌ Не удалось подключиться")
            return False
            
    except asyncio.TimeoutError:
        print("⏱️ Таймаут подключения (10 сек)")
        return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False


if __name__ == "__main__":
    result = asyncio.run(test_demo())
    print(f"\n{'✅ Тест пройден' if result else '❌ Тест не пройден'}")
