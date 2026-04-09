"""
Тест real-time цен через AsyncPocketOptionClient
"""
import asyncio
import sys
import os
import time
from datetime import datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import get_settings
from pocketoptionapi_async.client import AsyncPocketOptionClient

settings = get_settings()


async def main():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    is_demo = '"isDemo":1' in ssid or '"isDemo": 1' in ssid
    asset = "EURUSD_otc"
    
    print("\n" + "="*60)
    print("🧪 Real-time цены EUR/USD OTC")
    print("="*60)
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
    
    # Словарь для хранения последних цен
    last_prices = []
    
    # Обработчик обновлений
    def on_price_update(data):
        """Получаем обновления цены"""
        try:
            # Извлекаем цену из данных
            if isinstance(data, dict):
                price = data.get('price', data.get('close', data.get('value', 0)))
            else:
                price = float(data)
            
            if price and price > 0:
                last_prices.append({
                    'time': datetime.utcnow(),
                    'price': float(price)
                })
                
                # Печатаем каждое обновление
                t = last_prices[-1]['time'].strftime('%H:%M:%S.%f')[:-3]
                print(f"   💰 {t}  {price:.5f}")
        except Exception as e:
            pass
    
    try:
        # 1. Подключаемся
        print("\n🔌 Подключение...")
        connected = await client.connect()
        if not connected:
            print("❌ Не удалось подключиться")
            return
        print("✅ Connected!")
        
        # Ждем авторизации
        print("⏳ Ожидание авторизации...")
        await asyncio.sleep(3)
        
        # 2. Получаем начальные свечи
        print(f"\n📊 Начальные свечи {asset}...")
        candles = await client.get_candles(asset, 60)
        if candles and len(candles) > 0:
            last = candles[-1]
            if hasattr(last, 'close'):
                print(f"   ✅ Последняя свеча: C={last.close:.5f}")
            else:
                print(f"   ✅ Последняя свеча: C={last.get('close', 0):.5f}")
        
        # 3. Подписываемся на обновления через события
        print(f"\n📡 Подписка на обновления {asset} (10 сек)...")
        
        # Регистрируем обработчик
        client.add_event_callback('candle', on_price_update)
        client.add_event_callback('tick', on_price_update)
        client.add_event_callback('price', on_price_update)
        client.add_event_callback('update', on_price_update)
        
        # Ждем 10 секунд
        start_time = time.time()
        while time.time() - start_time < 10:
            await asyncio.sleep(0.5)
        
        # 4. Показываем статистику
        if last_prices:
            print(f"\n📊 Статистика:")
            print(f"   Получено обновлений: {len(last_prices)}")
            print(f"   Первая цена: {last_prices[0]['price']:.5f}")
            print(f"   Последняя цена: {last_prices[-1]['price']:.5f}")
            change = last_prices[-1]['price'] - last_prices[0]['price']
            print(f"   Изменение: {change:+.5f}")
        else:
            print(f"\n⚠️ Не получено обновлений через события")
            print(f"💡 Используем последний candle...")
            
            # Пробуем получить свежие свечи еще раз
            candles = await client.get_candles(asset, 60)
            if candles and len(candles) > 0:
                last = candles[-1]
                if hasattr(last, 'close'):
                    print(f"   Текущая цена: {last.close:.5f}")
                else:
                    print(f"   Текущая цена: {last.get('close', 0):.5f}")
        
        # Отключаемся
        print(f"\n🔌 Disconnect...")
        await client.disconnect()
        print("✅ Done!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
