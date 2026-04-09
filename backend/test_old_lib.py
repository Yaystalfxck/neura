"""
Тест старой библиотеки AsyncPocketOptionClient для получения свечей
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import get_settings
from pocketoptionapi_async.client import AsyncPocketOptionClient

settings = get_settings()


async def test_old_lib():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    
    print(f"\n🧪 Тест AsyncPocketOptionClient (старая библиотека)")
    print(f"   SSID: {ssid[:60]}...")
    
    try:
        # Подключаемся
        print(f"\n🔌 Connect...")
        client = AsyncPocketOptionClient(ssid=ssid, is_demo=False, enable_logging=False)
        connected = await client.connect()
        
        if not connected:
            print(f"❌ Не удалось подключиться")
            return
        
        print(f"✅ Connected!")
        
        # Ждем авторизации
        print(f"⏳ Ожидание авторизации...")
        await asyncio.sleep(3)
        
        # Пробуем получить свечи
        print(f"\n📊 get_candles(EURUSD_otc, 60)...")
        candles = await client.get_candles("EURUSD_otc", 60)
        
        if candles:
            print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
            print(f"\n📈 Последние 5:")
            for c in candles[-5:]:
                print(f"   O={c.open:.5f}, H={c.high:.5f}, L={c.low:.5f}, C={c.close:.5f}")
        else:
            print(f"❌ Нет данных")
        
        await client.disconnect()
        print(f"\n✅ Завершено")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_old_lib())
