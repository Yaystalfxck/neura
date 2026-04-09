"""
Тест цены с минимальной задержкой
Получаем свечи каждые 2 секунды для актуальной цены
"""
import asyncio
import time
from datetime import datetime
from app.config import get_settings
from pocketoptionapi_async.client import AsyncPocketOptionClient

settings = get_settings()


async def main():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    is_demo = '"isDemo":1' in ssid or '"isDemo": 1' in ssid
    asset = "EURUSD_otc"
    
    print("\n" + "="*60)
    print("🧪 Цена с обновлением каждые 2 секунды")
    print("="*60)
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
    
    try:
        # 1. Подключаемся
        print("\n🔌 Подключение...")
        await client.connect()
        print("✅ Connected!")
        
        await asyncio.sleep(3)
        
        # 2. Получаем начальные свечи
        print(f"\n📊 Начальные свечи...")
        candles = await client.get_candles(asset, 60)
        if candles and len(candles) > 0:
            last = candles[-1]
            price = last.close if hasattr(last, 'close') else last.get('close', 0)
            print(f"   ✅ Начальная цена: {price:.5f}")
        
        # 3. Обновляем каждые 2 секунды
        print(f"\n⏳ Мониторинг (20 сек, обновление каждые 2 сек)...")
        print(f"   {'Время':<15} {'Цена':<12} {'Изменение':<12} {'Свечей'}")
        print(f"   {'='*50}")
        
        start_time = time.time()
        prices = []
        update_num = 0
        
        while time.time() - start_time < 20:
            try:
                candles = await client.get_candles(asset, 60)
                if candles and len(candles) > 0:
                    last = candles[-1]
                    price = last.close if hasattr(last, 'close') else last.get('close', 0)
                    
                    if price > 0:
                        update_num += 1
                        prices.append(price)
                        
                        t = datetime.utcnow().strftime('%H:%M:%S')
                        change = price - prices[0] if len(prices) > 1 else 0
                        print(f"   {t:<15} {price:<12.5f} {change:+.5f}      {len(candles)}")
                
            except Exception as e:
                pass
            
            await asyncio.sleep(2)
        
        # 4. Статистика
        if prices:
            print(f"\n📊 Статистика:")
            print(f"   Обновлений: {update_num}")
            print(f"   Первая цена: {prices[0]:.5f}")
            print(f"   Последняя: {prices[-1]:.5f}")
            print(f"   Изменение: {prices[-1] - prices[0]:+.5f}")
            print(f"   Мин: {min(prices):.5f}")
            print(f"   Макс: {max(prices):.5f}")
        else:
            print(f"\n⚠️ Нет данных")
        
        await client.disconnect()
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
