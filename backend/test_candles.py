"""
Тест получения свечей с новым SSID
"""
import asyncio
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import get_settings
from BinaryOptionsToolsV2 import PocketOptionAsync

settings = get_settings()
SSID = settings.POCKETOPTION_SESSION_TOKEN
ASSET = "EURUSD_otc"


async def test_candles():
    """Тест получения свечей"""
    
    print("\n" + "="*70)
    print("🧪 ТЕСТ: Получение свечей EURUSD_otc")
    print("="*70)
    
    # ТЕСТ 1: candles()
    print("\n[ТЕСТ 1] candles(ASSET, 60)")
    try:
        client = PocketOptionAsync(ssid=SSID)
        await client.connect()
        print("✅ Connected")
        
        await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
        print("✅ Assets loaded")
        
        print(f"📊 candles({ASSET}, 60)...")
        candles = await client.candles(ASSET, 60)
        print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
        
        if candles and len(candles) > 0:
            print(f"\n📈 Последние 5 свечей:")
            for i, c in enumerate(candles[-5:]):
                print(f"   [{i+1}] Time={c.get('time')}, O={c.get('open'):.5f}, H={c.get('high'):.5f}, L={c.get('low'):.5f}, C={c.get('close'):.5f}")
        
        # НЕ вызываем shutdown - просто выходим
        print("\n✅ Тест 1 завершен (без shutdown)")
        
    except Exception as e:
        print(f"❌ Тест 1: {e}")
        import traceback
        traceback.print_exc()
    
    # Пауза
    print("\n⏳ Пауза 3 сек...")
    await asyncio.sleep(3)
    
    # ТЕСТ 2: get_candles()
    print("\n[ТЕСТ 2] get_candles(ASSET, 60, 100)")
    try:
        client = PocketOptionAsync(ssid=SSID)
        await client.connect()
        print("✅ Connected")
        
        await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
        print("✅ Assets loaded")
        
        print(f"📊 get_candles({ASSET}, 60, 100)...")
        candles = await client.get_candles(ASSET, 60, 100)
        print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
        
        if candles and len(candles) > 0:
            print(f"\n📈 Последние 5 свечей:")
            for i, c in enumerate(candles[-5:]):
                print(f"   [{i+1}] Time={c.get('time')}, O={c.get('open'):.5f}, H={c.get('high'):.5f}, L={c.get('low'):.5f}, C={c.get('close'):.5f}")
        
        print("\n✅ Тест 2 завершен (без shutdown)")
        
    except Exception as e:
        print(f"❌ Тест 2: {e}")
        import traceback
        traceback.print_exc()
    
    # Пауза
    print("\n⏳ Пауза 3 сек...")
    await asyncio.sleep(3)
    
    # ТЕСТ 3: history()
    print("\n[ТЕСТ 3] history(ASSET, 60)")
    try:
        client = PocketOptionAsync(ssid=SSID)
        await client.connect()
        print("✅ Connected")
        
        await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
        print("✅ Assets loaded")
        
        print(f"📊 history({ASSET}, 60)...")
        candles = await client.history(ASSET, 60)
        print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
        
        if candles and len(candles) > 0:
            print(f"\n📈 Последние 5 свечей:")
            for i, c in enumerate(candles[-5:]):
                print(f"   [{i+1}] Time={c.get('time')}, O={c.get('open'):.5f}, H={c.get('high'):.5f}, L={c.get('low'):.5f}, C={c.get('close'):.5f}")
        
        print("\n✅ Тест 3 завершен (без shutdown)")
        
    except Exception as e:
        print(f"❌ Тест 3: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*70)
    print("✅ ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ")
    print("="*70)


if __name__ == "__main__":
    asyncio.run(test_candles())
