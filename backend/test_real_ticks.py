"""
Тест REAL-TIME цены через тики (не свечи!)
Тики приходят каждые 0.5-1 секунды - это реальная цена
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
    print("🧪 REAL-TIME цена через тики (не свечи!)")
    print("="*60)
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
    
    tick_prices = []
    tick_count = 0
    
    # Обработчик тиков из WebSocket
    async def on_tick(data):
        nonlocal tick_count
        try:
            # Данные тика: [['EURUSD_otc', timestamp, price], ...]
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, list) and len(item) >= 3:
                        asset_name = item[0]
                        ts = item[1]
                        price = float(item[2])
                        
                        if asset_name == asset and price > 0:
                            tick_count += 1
                            tick_prices.append(price)
                            
                            t = datetime.utcnow().strftime('%H:%M:%S.%f')[:-3]
                            change = price - tick_prices[0] if len(tick_prices) > 1 else 0
                            print(f"   {t:<20} {price:<12.5f} {change:+.5f}")
        except Exception as e:
            pass
    
    try:
        # 1. Подключаемся
        print("\n🔌 Подключение...")
        await client.connect()
        print("✅ Connected!")
        
        # Добавляем обработчик тиков
        client.add_event_callback('stream_update', on_tick)
        
        await asyncio.sleep(3)
        
        # 2. Получаем исторические свечи для сравнения
        print(f"\n📊 Исторические свечи (60s)...")
        candles = await client.get_candles(asset, 60)
        if candles and len(candles) > 0:
            last = candles[-1]
            hist_price = last.close if hasattr(last, 'close') else last.get('close', 0)
            ts = last.timestamp if hasattr(last, 'timestamp') else last.get('time', 0)
            if ts:
                if hasattr(ts, 'strftime'):
                    t = ts.strftime('%H:%M:%S')
                elif isinstance(ts, (int, float)):
                    t = datetime.utcfromtimestamp(ts).strftime('%H:%M:%S')
                else:
                    t = str(ts)
            else:
                t = '???'
            print(f"   ✅ Историческая цена: {hist_price:.5f} (свеча закрыта в {t})")
        
        # 3. Ждем real-time тики
        print(f"\n📡 Real-time тики (10 сек)...")
        print(f"   {'Время':<20} {'Цена':<12} {'Изменение'}")
        print(f"   {'='*45}")
        
        await asyncio.sleep(10)
        
        # 4. Статистика
        if tick_prices:
            print(f"\n📊 Real-time статистика:")
            print(f"   Получено тиков: {len(tick_prices)}")
            print(f"   Первый тик: {tick_prices[0]:.5f}")
            print(f"   Последний тик: {tick_prices[-1]:.5f}")
            print(f"   Изменение: {tick_prices[-1] - tick_prices[0]:+.5f}")
            print(f"   Мин: {min(tick_prices):.5f}")
            print(f"   Макс: {max(tick_prices):.5f}")
            print(f"   Частота: {len(tick_prices)/10:.1f} тиков/сек")
            
            # Сравнение с исторической ценой
            if candles and len(candles) > 0:
                hist_price = candles[-1].close if hasattr(candles[-1], 'close') else candles[-1].get('close', 0)
                diff = tick_prices[-1] - hist_price
                print(f"\n🔍 Сравнение:")
                print(f"   Историческая (закрытая свеча): {hist_price:.5f}")
                print(f"   Real-time (последний тик):     {tick_prices[-1]:.5f}")
                print(f"   Разница: {diff:+.5f}")
        else:
            print(f"\n⚠️ Тики не получены")
            print(f"💡 Попробуем получить свежие свечи с минимальной задержкой...")
            
            # Пробуем получить последние свечи
            candles = await client.get_candles(asset, 60)
            if candles and len(candles) > 0:
                last = candles[-1]
                price = last.close if hasattr(last, 'close') else last.get('close', 0)
                print(f"   ✅ Свежая цена из свечи: {price:.5f}")
        
        await client.disconnect()
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
