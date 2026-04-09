"""
Финальный тест: get_candles БЕЗ wait_for_assets
"""
import asyncio
import time
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import get_settings
from BinaryOptionsToolsV2 import PocketOptionAsync

settings = get_settings()
SSID = settings.POCKETOPTION_SESSION_TOKEN
ASSET = "EURUSD_otc"


async def test_get_candles_only():
    """Пробуем ТОЛЬКО get_candles без wait_for_assets"""
    
    print("\n" + "="*70)
    print("🧪 ТЕСТ: Только get_candles (без wait_for_assets)")
    print("="*70)
    
    # ТЕСТ 1: connect -> get_candles (без wait_for_assets)
    print("\n[ТЕСТ 1] Connect -> 2 сек пауза -> get_candles")
    try:
        client = PocketOptionAsync(ssid=SSID)
        await client.connect()
        print("✅ Connected")
        
        # Ждем 2 секунды чтобы соединение стабилизировалось
        print("⏳ Ожидание 2 сек...")
        await asyncio.sleep(2)
        
        # Пробуем получить свечи
        print(f"📊 get_candles({ASSET}, 60, 100)...")
        candles = await client.get_candles(ASSET, 60, 100)
        print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
        
        if candles and len(candles) > 0:
            print(f"\n📈 Последние 3 свечи:")
            for i, c in enumerate(candles[-3:]):
                print(f"   [{i+1}] O={c.get('open'):.5f}, H={c.get('high'):.5f}, L={c.get('low'):.5f}, C={c.get('close'):.5f}")
        
        await client.disconnect()
        print("✅ Закрыто")
        return True
        
    except Exception as e:
        print(f"❌ Тест 1: {e}")
        return False
    
    # ТЕСТ 2: connect -> get_candles_advanced
    print("\n[ТЕСТ 2] Connect -> get_candles_advanced")
    try:
        client = PocketOptionAsync(ssid=SSID)
        await client.connect()
        print("✅ Connected")
        
        await asyncio.sleep(2)
        
        import time as t
        now = int(t.time())
        print(f"📊 get_candles_advanced({ASSET}, 60, 100, {now})...")
        candles = await client.get_candles_advanced(ASSET, 60, 100, now)
        print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
        
        await client.disconnect()
        return True
        
    except Exception as e:
        print(f"❌ Тест 2: {e}")
        return False
    
    # ТЕСТ 3: Отдельный клиент на 3 свечи
    print("\n[ТЕСТ 3] 3 отдельных клиента для 3 свечей")
    try:
        for i in range(3):
            client = PocketOptionAsync(ssid=SSID)
            await client.connect()
            await asyncio.sleep(1)
            
            print(f"   [{i+1}] get_candles...")
            candles = await client.get_candles(ASSET, 60, 50)
            print(f"   ✅ {len(candles)} свечей")
            
            await client.disconnect()
            await asyncio.sleep(2)
        
        return True
        
    except Exception as e:
        print(f"❌ Тест 3: {e}")
        return False


async def main():
    success = await test_get_candles_only()
    
    if success:
        print("\n" + "="*70)
        print("✅ БИБЛИОТЕКА РАБОЕТ! Можно использовать в production")
        print("="*70)
    else:
        print("\n" + "="*70)
        print("❌ BinaryOptionsToolsV2 не работает для получения свечей")
        print("💡 Возможно нужен другой SSID или версия библиотеки")
        print("="*70)


if __name__ == "__main__":
    asyncio.run(main())
