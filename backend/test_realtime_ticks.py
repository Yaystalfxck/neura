"""
Тест real-time цены через WebSocket стрим
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
    print("🧪 REAL-TIME цена через WebSocket стрим")
    print("="*60)
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
    
    prices = []
    last_price = 0
    
    # Обработчик stream обновлений
    async def on_stream_update(data):
        nonlocal last_price
        try:
            # Данные: [['EURUSD_otc', timestamp, price], ...]
            if isinstance(data, list) and len(data) > 0:
                for item in data:
                    if isinstance(item, list) and len(item) >= 3:
                        asset_name = item[0]
                        ts = item[1]
                        price = float(item[2])
                        
                        if asset_name == asset and price > 0:
                            prices.append({'time': datetime.utcnow(), 'price': price})
                            last_price = price
                            
                            t = prices[-1]['time'].strftime('%H:%M:%S.%f')[:-3]
                            change = price - prices[0]['price'] if len(prices) > 1 else 0
                            print(f"   {t:<20} {price:<12.5f} {change:+.5f}")
        except Exception as e:
            pass
    
    try:
        # 1. Подключаемся
        print("\n🔌 Подключение...")
        await client.connect()
        print("✅ Connected!")
        
        await asyncio.sleep(3)
        
        # 2. Регистрируем обработчик ДО запроса свечей
        print(f"\n📡 Регистрация обработчика...")
        client.add_event_callback('stream_update', on_stream_update)
        
        # 3. Запрашиваем свечи - это подпишет на стрим
        print(f"📊 Подписка на {asset}...")
        candles = await client.get_candles(asset, 60)
        
        if candles and len(candles) > 0:
            last = candles[-1]
            hist_price = last.close if hasattr(last, 'close') else last.get('close', 0)
            print(f"   ✅ Историческая цена: {hist_price:.5f}")
        
        # 4. Ждем real-time обновлений
        print(f"\n⏳ Ожидание real-time обновлений (15 сек)...")
        print(f"   {'Время':<20} {'Цена':<12} {'Изменение'}")
        print(f"   {'='*45}")
        
        await asyncio.sleep(15)
        
        # 5. Статистика
        if prices:
            print(f"\n📊 Статистика:")
            print(f"   Получено тиков: {len(prices)}")
            print(f"   Первый тик: {prices[0]['price']:.5f}")
            print(f"   Последний тик: {prices[-1]['price']:.5f}")
            print(f"   Изменение: {prices[-1]['price'] - prices[0]['price']:+.5f}")
            print(f"   Мин: {min(p['price'] for p in prices):.5f}")
            print(f"   Макс: {max(p['price'] for p in prices):.5f}")
            print(f"   Частота: {len(prices)/15:.1f} тиков/сек")
        else:
            print(f"\n⚠️ Не получено real-time обновлений")
            print(f"💡 Используем последнюю известную цену: {last_price:.5f}")
        
        await client.disconnect()
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
