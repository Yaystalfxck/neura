"""
Минимальный тест BinaryOptionsToolsV2
Читаем SSID из .env файла
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

print(f"\n📋 SSID ({len(SSID)} символов):")
print(f"   Начало: {SSID[:80]}")
print(f"   Конец: {SSID[-80:]}")


async def test_all_methods():
    """Тестируем все методы BinaryOptionsToolsV2"""
    
    print("\n" + "="*70)
    print("🧪 ПОЛНЫЙ ТЕСТ BinaryOptionsToolsV2")
    print("="*70)
    
    # ТЕСТ 1: Отдельный клиент на каждый метод
    print("\n" + "="*70)
    print("[ТЕСТ 1] Отдельный клиент на каждый метод")
    print("="*70)
    
    methods_to_test = [
        ("balance", lambda c: c.balance()),
        ("payout", lambda c: c.payout(ASSET)),
        ("candles", lambda c: c.candles(ASSET, 60)),
        ("get_candles", lambda c: c.get_candles(ASSET, 60, 100)),
    ]
    
    for method_name, method_func in methods_to_test:
        print(f"\n{'='*50}")
        print(f"[{method_name}] Создание нового клиента...")
        print(f"{'='*50}")
        try:
            client = PocketOptionAsync(ssid=SSID)
            await client.connect()
            print(f"✅ Connected")
            
            await asyncio.wait_for(client.wait_for_assets(timeout=15.0), timeout=20.0)
            print(f"✅ Assets loaded")
            
            result = await method_func(client)
            
            if isinstance(result, (int, float)):
                print(f"✅ {method_name}: {result}")
            elif isinstance(result, list):
                print(f"✅ {method_name}: {len(result)} элементов")
                if len(result) > 0:
                    print(f"   Последний: {result[-1]}")
            elif isinstance(result, dict):
                print(f"✅ {method_name}: {result}")
            
            print(f"🔌 Shutdown...")
            await client.shutdown()
            print(f"✅ Закрыто")
            
            await asyncio.sleep(3)  # Пауза между клиентами
            
        except Exception as e:
            print(f"❌ {method_name}: {e}")
            import traceback
            traceback.print_exc()
    
    # ТЕСТ 2: Real-time подписка
    print("\n" + "="*70)
    print("[ТЕСТ 2] Real-time подписка EURUSD_otc (5 сек)")
    print("="*70)
    
    try:
        client = PocketOptionAsync(ssid=SSID)
        await client.connect()
        print(f"✅ Connected")
        
        await asyncio.wait_for(client.wait_for_assets(timeout=15.0), timeout=20.0)
        print(f"✅ Assets loaded")
        
        print(f"📡 Подписка на {ASSET}...")
        prices = []
        start_time = time.time()
        
        async for candle in await client.subscribe_symbol(ASSET):
            price = candle.get('close', candle.get('price', 0))
            try:
                price = float(price)
                prices.append(price)
                if len(prices) % 10 == 0:
                    print(f"   💰 #{len(prices)}: {price:.5f}")
            except:
                pass
            
            if time.time() - start_time >= 5:
                break
        
        if prices:
            print(f"\n✅ Real-time: {len(prices)} обновлений за 5 сек")
            print(f"   Первая: {prices[0]:.5f}")
            print(f"   Последняя: {prices[-1]:.5f}")
            print(f"   Изменение: {prices[-1] - prices[0]:.5f}")
        else:
            print(f"❌ Real-time: нет данных")
        
        await client.shutdown()
        
    except Exception as e:
        print(f"❌ Real-time: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*70)
    print("✅ ТЕСТЫ ЗАВЕРШЕНЫ")
    print("="*70)


if __name__ == "__main__":
    asyncio.run(test_all_methods())
