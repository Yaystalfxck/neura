"""
Тест: candles БЕЗ wait_for_assets
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import get_settings
from BinaryOptionsToolsV2 import PocketOptionAsync

settings = get_settings()


async def main():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    
    print(f"\n🧪 Тест: candles БЕЗ wait_for_assets")
    
    # Создаем клиента
    client = PocketOptionAsync(ssid=ssid)
    await client.connect()
    print(f"✅ Connected")
    
    # НЕ вызываем wait_for_assets!
    # Ждем немного
    print(f"⏳ Ожидание 5 сек...")
    await asyncio.sleep(5)
    
    # Пробуем candles
    print(f"\n📊 candles(EURUSD_otc, 60)...")
    try:
        candles = await client.candles("EURUSD_otc", 60)
        print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
        if candles:
            print(f"   Последняя: O={candles[-1].get('open')}, C={candles[-1].get('close')}")
    except Exception as e:
        print(f"❌ candles(): {e}")
    
    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
