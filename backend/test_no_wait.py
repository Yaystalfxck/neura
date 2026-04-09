"""
Тест BinaryOptionsToolsV2 БЕЗ wait_for_assets
Пробуем получать данные сразу после connect
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


async def test_without_wait_for_assets():
    """Тестируем без wait_for_assets"""
    
    print("\n" + "="*70)
    print("🧪 ТЕСТ: BinaryOptionsToolsV2 БЕЗ wait_for_assets")
    print("="*70)
    
    # ТЕСТ 1: connect -> сразу get_candles
    print("\n[ТЕСТ 1] Connect -> сразу get_candles")
    try:
        client = PocketOptionAsync(ssid=SSID)
        await client.connect()
        print("✅ Connected")
        
        # Ждем немного
        await asyncio.sleep(3)
        
        print(f"📊 get_candles({ASSET})...")
        candles = await client.get_candles(ASSET, 60, 100)
        print(f"✅ get_candles: {len(candles)} свечей")
        if candles:
            print(f"   Последняя: {candles[-1]}")
        
        await client.disconnect()
        print("✅ Закрыто")
        
    except Exception as e:
        print(f"❌ Тест 1: {e}")
    
    # ТЕСТ 2: connect -> candles
    print("\n[ТЕСТ 2] Connect -> candles")
    try:
        client = PocketOptionAsync(ssid=SSID)
        await client.connect()
        print("✅ Connected")
        
        await asyncio.sleep(3)
        
        print(f"📊 candles({ASSET})...")
        candles = await client.candles(ASSET, 60)
        print(f"✅ candles: {len(candles)} свечей")
        if candles:
            print(f"   Последняя: {candles[-1]}")
        
        await client.disconnect()
        
    except Exception as e:
        print(f"❌ Тест 2: {e}")
    
    # ТЕСТ 3: connect -> subscribe_symbol
    print("\n[ТЕСТ 3] Connect -> subscribe_symbol (5 сек)")
    try:
        client = PocketOptionAsync(ssid=SSID)
        await client.connect()
        print("✅ Connected")
        
        await asyncio.sleep(3)
        
        print(f"📡 subscribe_symbol({ASSET})...")
        prices = []
        start_time = time.time()
        
        async for candle in await client.subscribe_symbol(ASSET):
            price = candle.get('close', candle.get('price', 0))
            try:
                price = float(price)
                prices.append(price)
                if len(prices) <= 10 or len(prices) % 20 == 0:
                    print(f"   💰 #{len(prices)}: {price:.5f}")
            except:
                pass
            
            if time.time() - start_time >= 5:
                break
        
        if prices:
            print(f"\n✅ Real-time: {len(prices)} обновлений")
            print(f"   Первая: {prices[0]:.5f}, Последняя: {prices[-1]:.5f}")
        
        await client.disconnect()
        
    except Exception as e:
        print(f"❌ Тест 3: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*70)
    print("✅ ТЕСТЫ ЗАВЕРШЕНЫ")
    print("="*70)


if __name__ == "__main__":
    asyncio.run(test_without_wait_for_assets())
