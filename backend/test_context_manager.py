"""
Тест BinaryOptionsToolsV2 с правильным использованием контекстного менеджера
Согласно документации: async with PocketOptionAsync(ssid=ssid) as client:
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


async def test_with_context_manager():
    """Тест с использованием async with"""
    
    print("\n" + "="*70)
    print("🧪 ТЕСТ: BinaryOptionsToolsV2 с async with")
    print("="*70)
    
    # ТЕСТ 1: async with -> wait_for_assets -> balance
    print("\n[ТЕСТ 1] async with: wait_for_assets -> balance -> payout")
    try:
        async with PocketOptionAsync(ssid=SSID) as client:
            print("✅ Контекстный менеджер создан")
            
            # Ждем активы
            await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
            print("✅ Assets loaded")
            
            # Баланс
            balance = await client.balance()
            print(f"💰 Balance: ${balance}")
            
            # Payout
            payout = await client.payout(ASSET)
            print(f"💰 Payout {ASSET}: {payout}%")
        
        print("✅ Контекстный менеджер закрыт")
        
    except Exception as e:
        print(f"❌ Тест 1: {e}")
        import traceback
        traceback.print_exc()
    
    # ТЕСТ 2: async with -> subscribe_symbol
    print("\n[ТЕСТ 2] async with -> subscribe_symbol (5 сек)")
    try:
        async with PocketOptionAsync(ssid=SSID) as client:
            print("✅ Контекстный менеджер создан")
            
            await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
            print("✅ Assets loaded")
            
            print(f"📡 Подписка на {ASSET}...")
            prices = []
            start_time = time.time()
            
            async for candle in await client.subscribe_symbol(ASSET):
                price = candle.get('close', candle.get('price', 0))
                try:
                    price = float(price)
                    prices.append(price)
                    if len(prices) <= 5 or len(prices) % 10 == 0:
                        print(f"   💰 #{len(prices)}: {price:.5f}")
                except:
                    pass
                
                if time.time() - start_time >= 5:
                    break
            
            if prices:
                print(f"\n✅ Real-time: {len(prices)} обновлений")
                print(f"   Первая: {prices[0]:.5f}")
                print(f"   Последняя: {prices[-1]:.5f}")
        
        print("✅ Контекстный менеджер закрыт")
        
    except Exception as e:
        print(f"❌ Тест 2: {e}")
        import traceback
        traceback.print_exc()
    
    # ТЕСТ 3: async with -> candles
    print("\n[ТЕСТ 3] async with -> candles()")
    try:
        async with PocketOptionAsync(ssid=SSID) as client:
            print("✅ Контекстный менеджер создан")
            
            await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
            print("✅ Assets loaded")
            
            print(f"📊 candles({ASSET}, 60)...")
            candles = await client.candles(ASSET, 60)
            print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
            
            if candles and len(candles) > 0:
                print(f"\n📈 Последние 3 свечи:")
                for i, c in enumerate(candles[-3:]):
                    print(f"   [{i+1}] O={c.get('open'):.5f}, H={c.get('high'):.5f}, L={c.get('low'):.5f}, C={c.get('close'):.5f}")
        
        print("✅ Контекстный менеджер закрыт")
        
    except Exception as e:
        print(f"❌ Тест 3: {e}")
        import traceback
        traceback.print_exc()
    
    # ТЕСТ 4: async with -> get_candles
    print("\n[ТЕСТ 4] async with -> get_candles()")
    try:
        async with PocketOptionAsync(ssid=SSID) as client:
            print("✅ Контекстный менеджер создан")
            
            await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
            print("✅ Assets loaded")
            
            print(f"📊 get_candles({ASSET}, 60, 100)...")
            candles = await client.get_candles(ASSET, 60, 100)
            print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
            
            if candles and len(candles) > 0:
                print(f"\n📈 Последние 3 свечи:")
                for i, c in enumerate(candles[-3:]):
                    print(f"   [{i+1}] O={c.get('open'):.5f}, H={c.get('high'):.5f}, L={c.get('low'):.5f}, C={c.get('close'):.5f}")
        
        print("✅ Контекстный менеджер закрыт")
        
    except Exception as e:
        print(f"❌ Тест 4: {e}")
        import traceback
        traceback.print_exc()
    
    # ТЕСТ 5: async with -> history
    print("\n[ТЕСТ 5] async with -> history()")
    try:
        async with PocketOptionAsync(ssid=SSID) as client:
            print("✅ Контекстный менеджер создан")
            
            await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
            print("✅ Assets loaded")
            
            print(f"📊 history({ASSET}, 60)...")
            candles = await client.history(ASSET, 60)
            print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
            
            if candles and len(candles) > 0:
                print(f"\n📈 Последние 3 свечи:")
                for i, c in enumerate(candles[-3:]):
                    print(f"   [{i+1}] O={c.get('open'):.5f}, H={c.get('high'):.5f}, L={c.get('low'):.5f}, C={c.get('close'):.5f}")
        
        print("✅ Контекстный менеджер закрыт")
        
    except Exception as e:
        print(f"❌ Тест 5: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*70)
    print("✅ ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ")
    print("="*70)


if __name__ == "__main__":
    asyncio.run(test_with_context_manager())
