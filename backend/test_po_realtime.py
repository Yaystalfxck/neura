"""
Тест получения реальных данных EUR/USD OTC
Сравниваем две библиотеки: BinaryOptionsToolsV2 vs AsyncPocketOptionClient
"""
import asyncio
import time
import sys
import os

# Добавляем путь к проекту
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import get_settings
settings = get_settings()


async def test_old_library():
    """Тест старой библиотеки AsyncPocketOptionClient"""
    print("\n" + "="*70)
    print("🧪 ТЕСТ 1: AsyncPocketOptionClient (старая библиотека)")
    print("="*70)
    
    try:
        from pocketoptionapi_async.client import AsyncPocketOptionClient
        
        ssid = settings.POCKETOPTION_SESSION_TOKEN
        is_demo = '"isDemo":1' in ssid
        
        print(f"\n📋 Конфигурация:")
        print(f"   SSID: {ssid[:60]}...")
        print(f"   Demo: {is_demo}")
        
        client = None
        
        try:
            # 1. Подключаемся
            print(f"\n🔌 Подключение...")
            client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
            connected = await client.connect()
            
            if not connected:
                print("❌ Не удалось подключиться")
                return
            
            print("✅ Подключено!")
            
            # 2. Получаем свечи
            print(f"\n📊 Получение свечей EURUSD_otc...")
            start = time.time()
            candles = await client.get_candles(asset='EURUSD_otc', timeframe=60)
            elapsed = time.time() - start
            
            print(f"✅ Получено {len(candles)} свечей за {elapsed:.2f} сек")
            
            if candles and len(candles) > 0:
                print(f"\n📈 Последние 5 свечей:")
                for i, candle in enumerate(candles[-5:]):
                    print(f"   [{i+1}] O={candle.open:.5f}, H={candle.high:.5f}, L={candle.low:.5f}, C={candle.close:.5f}, V={candle.volume}, T={candle.timestamp}")
            
            # 3. Подписка на реальное время
            print(f"\n📡 Подписка на реальные цены EURUSD_otc (10 сек)...")
            price_client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
            await price_client.connect()
            
            prices = []
            start_time = time.time()
            
            try:
                async for candle in await price_client.subscribe_symbol('EURUSD_otc'):
                    price = candle.close if hasattr(candle, 'close') else candle.get('close', 0)
                    if price:
                        prices.append(float(price))
                        if len(prices) % 5 == 0:  # Печатаем каждые 5 обновлений
                            print(f"   💰 Цена #{len(prices)}: {price:.5f}")
                    
                    if time.time() - start_time >= 10:
                        break
            except Exception as sub_err:
                print(f"   ⚠️ Подписка: {sub_err}")
            
            if prices:
                print(f"\n✅ Real-time: {len(prices)} обновлений")
                print(f"   Первая: {prices[0]:.5f}")
                print(f"   Последняя: {prices[-1]:.5f}")
                print(f"   Изменение: {prices[-1] - prices[0]:.5f}")
            
            await price_client.disconnect()
            
        finally:
            if client:
                await client.disconnect()
        
        print(f"\n{'='*70}")
        print("✅ AsyncPocketOptionClient: РАБОТАЕТ!")
        print(f"{'='*70}")
        
    except Exception as e:
        print(f"\n❌ AsyncPocketOptionClient: ОШИБКА - {e}")
        import traceback
        traceback.print_exc()


async def test_new_library():
    """Тест BinaryOptionsToolsV2"""
    print("\n" + "="*70)
    print("🧪 ТЕСТ 2: BinaryOptionsToolsV2 (новая библиотека)")
    print("="*70)
    
    try:
        from BinaryOptionsToolsV2 import PocketOptionAsync
        
        ssid = settings.POCKETOPTION_SESSION_TOKEN
        
        print(f"\n📋 Конфигурация:")
        print(f"   SSID: {ssid[:60]}...")
        
        client = None
        
        try:
            # 1. Подключаемся
            print(f"\n🔌 Подключение...")
            client = PocketOptionAsync(ssid=ssid)
            await client.connect()
            print("✅ Connected!")
            
            # 2. Ждем активы
            print(f"\n⏳ Ожидание активов...")
            start = time.time()
            await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
            elapsed = time.time() - start
            print(f"✅ Активы загружены за {elapsed:.2f} сек")
            
            # 3. Получаем payout
            print(f"\n💰 Payout EURUSD_otc...")
            payout = await client.payout('EURUSD_otc')
            print(f"✅ Payout: {payout}%")
            
            # 4. Пробуем получить свечи НАПРЯМУЮ (без wait_for_assets)
            print(f"\n📊 Получение свечей (метод 1: candles)...")
            client2 = PocketOptionAsync(ssid=ssid)
            await client2.connect()
            
            try:
                candles = await client2.candles('EURUSD_otc', 60)
                print(f"✅ Метод candles(): {len(candles)} свечей")
                if candles and len(candles) > 0:
                    print(f"   Последняя: O={candles[-1].get('open')}, C={candles[-1].get('close')}")
            except Exception as e1:
                print(f"   ❌ candles(): {e1}")
            
            await client2.shutdown()
            
            # 5. Пробуем get_candles с таймаутом
            print(f"\n📊 Получение свечей (метод 2: get_candles)...")
            client3 = PocketOptionAsync(ssid=ssid)
            await client3.connect()
            
            try:
                await asyncio.wait_for(client3.wait_for_assets(timeout=30.0), timeout=35.0)
                candles = await client3.get_candles('EURUSD_otc', 60, 100)
                print(f"✅ Метод get_candles(): {len(candles)} свечей")
                if candles and len(candles) > 0:
                    print(f"   Последняя: O={candles[-1].get('open')}, C={candles[-1].get('close')}")
            except Exception as e2:
                print(f"   ❌ get_candles(): {e2}")
            
            await client3.shutdown()
            
            # 6. Real-time подписка
            print(f"\n📡 Real-time подписка EURUSD_otc (5 сек)...")
            client4 = PocketOptionAsync(ssid=ssid)
            await client4.connect()
            await asyncio.wait_for(client4.wait_for_assets(timeout=30.0), timeout=35.0)
            
            prices = []
            start_time = time.time()
            
            try:
                async for candle in await client4.subscribe_symbol('EURUSD_otc'):
                    price = candle.get('close', candle.get('price', 0))
                    try:
                        price = float(price)
                        prices.append(price)
                        if len(prices) % 5 == 0:
                            print(f"   💰 Цена #{len(prices)}: {price:.5f}")
                    except:
                        pass
                    
                    if time.time() - start_time >= 5:
                        break
            except Exception as e3:
                print(f"   ⚠️ Подписка: {e3}")
            
            if prices:
                print(f"\n✅ Real-time: {len(prices)} обновлений")
            
            await client4.shutdown()
            
        finally:
            if client:
                await client.shutdown()
        
        print(f"\n{'='*70}")
        print("✅ BinaryOptionsToolsV2: РАБОТАЕТ (частично)")
        print(f"{'='*70}")
        
    except Exception as e:
        print(f"\n❌ BinaryOptionsToolsV2: ОШИБКА - {e}")
        import traceback
        traceback.print_exc()


async def main():
    print("\n" + "="*70)
    print("🧪 POCKET OPTION: СРАВНЕНИЕ БИБЛИОТЕК")
    print("="*70)
    print(f"\n📋 SSID: {settings.POCKETOPTION_SESSION_TOKEN[:60]}...")
    print(f"📋 Актив: EUR/USD OTC")
    
    # Тест 1: Старая библиотека
    await test_old_library()
    
    # Пауза между тестами
    print("\n⏳ Пауза 5 сек...")
    await asyncio.sleep(5)
    
    # Тест 2: Новая библиотека
    await test_new_library()
    
    print("\n" + "="*70)
    print("✅ ТЕСТЫ ЗАВЕРШЕНЫ")
    print("="*70)


if __name__ == "__main__":
    asyncio.run(main())
