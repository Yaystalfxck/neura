"""
Минимальный тест get_candles
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
    asset = "EURUSD_otc"
    
    print(f"\n🧪 Минимальный тест get_candles")
    print(f"   SSID: {ssid[:60]}...")
    
    # Создаем клиента
    print(f"\n🔌 Создание клиента...")
    client = PocketOptionAsync(ssid=ssid)
    
    print(f"🔌 Connect...")
    await client.connect()
    print(f"✅ Connected")
    
    print(f"⏳ Wait for assets...")
    await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
    print(f"✅ Assets loaded")
    
    # Сразу get_candles
    print(f"\n📊 get_candles({asset}, 60, 100)...")
    try:
        candles = await client.get_candles(asset, 60, 100)
        print(f"✅ УРА! Получено {len(candles)} свечей!")
        
        if candles:
            print(f"\n📈 Последние 3:")
            for c in candles[-3:]:
                print(f"   O={c.get('open'):.5f}, C={c.get('close'):.5f}")
        
    except Exception as e:
        print(f"❌ get_candles: {e}")
    
    # Disconnect
    print(f"\n🔌 Disconnect...")
    try:
        await client.disconnect()
        print(f"✅ Disconnected")
    except Exception as e:
        print(f"⚠️ Disconnect error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
