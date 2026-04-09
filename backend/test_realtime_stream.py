"""
Тест real-time цен через обработку stream обновлений
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
    
    print("\n🧪 Real-time цены через stream обновления")
    print("="*50)
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
    
    prices = []
    
    # Обработчик stream обновлений
    async def on_stream(data):
        try:
            # Данные приходят как [['EURUSD_otc', timestamp, price], ...]
            if isinstance(data, list) and len(data) > 0:
                for item in data:
                    if isinstance(item, list) and len(item) >= 3:
                        asset = item[0]
                        ts = item[1]
                        price = float(item[2])
                        
                        if asset == 'EURUSD_otc' and price > 0:
                            prices.append({
                                'time': datetime.utcnow(),
                                'price': price
                            })
                            
                            t = prices[-1]['time'].strftime('%H:%M:%S.%f')[:-3]
                            change = price - prices[0]['price'] if len(prices) > 1 else 0
                            print(f"  {t:<18} {price:<10.5f} {change:+.5f}")
        except Exception as e:
            pass
    
    try:
        # Подключаемся
        print("\n🔌 Подключение...")
        await client.connect()
        print("✅ Connected!")
        
        await asyncio.sleep(3)
        
        # Регистрируем обработчик
        client.add_event_callback('stream_update', on_stream)
        
        print(f"\n📡 Ожидание обновлений (15 сек)...")
        print(f"  {'Время':<18} {'Цена':<10} {'Изменение'}")
        print(f"  {'='*40}")
        
        # Ждем 15 секунд
        await asyncio.sleep(15)
        
        # Статистика
        if prices:
            print(f"\n📊 Статистика:")
            print(f"  Обновлений: {len(prices)}")
            print(f"  Первая: {prices[0]['price']:.5f}")
            print(f"  Последняя: {prices[-1]['price']:.5f}")
            print(f"  Изменение: {prices[-1]['price'] - prices[0]['price']:+.5f}")
            print(f"  Мин: {min(p['price'] for p in prices):.5f}")
            print(f"  Макс: {max(p['price'] for p in prices):.5f}")
        else:
            print(f"\n⚠️ Не получено обновлений")
        
        await client.disconnect()
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
