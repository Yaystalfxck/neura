"""
Тест real-time цен через постоянное обновление свечей
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
    print("🧪 Real-time цены через обновление свечей")
    print("="*60)
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
    
    try:
        # 1. Подключаемся
        print("\n🔌 Подключение...")
        connected = await client.connect()
        if not connected:
            print("❌ Не удалось подключиться")
            return
        print("✅ Connected!")
        
        await asyncio.sleep(3)
        
        # 2. Получаем начальные свечи
        print(f"\n📊 Начальные свечи...")
        candles = await client.get_candles(asset, 60)
        if candles and len(candles) > 0:
            last = candles[-1]
            if hasattr(last, 'close'):
                last_price = last.close
            else:
                last_price = last.get('close', 0)
            print(f"   ✅ Начальная цена: {last_price:.5f}")
        
        # 3. Постоянно обновляем цену
        print(f"\n📡 Мониторинг цены (15 сек)...")
        print(f"   {'Время':<15} {'Цена':<12} {'Изменение':<12}")
        print(f"   {'='*40}")
        
        start_time = time.time()
        prices = []
        update_count = 0
        
        while time.time() - start_time < 15:
            try:
                # Получаем свежие свечи
                candles = await client.get_candles(asset, 60)
                if candles and len(candles) > 0:
                    last = candles[-1]
                    if hasattr(last, 'close'):
                        price = last.close
                    else:
                        price = last.get('close', 0)
                    
                    if price and price > 0:
                        prices.append(price)
                        update_count += 1
                        
                        # Печатаем каждое обновление
                        t = datetime.utcnow().strftime('%H:%M:%S')
                        change = price - prices[0] if len(prices) > 1 else 0
                        print(f"   {t:<15} {price:<12.5f} {change:+.5f}")
                
            except Exception as e:
                pass
            
            # Пауза 1 секунда между обновлениями
            await asyncio.sleep(1)
        
        # 4. Статистика
        if prices:
            print(f"\n📊 Статистика:")
            print(f"   Обновлений: {update_count}")
            print(f"   Первая цена: {prices[0]:.5f}")
            print(f"   Последняя: {prices[-1]:.5f}")
            print(f"   Изменение: {prices[-1] - prices[0]:+.5f}")
            print(f"   Мин: {min(prices):.5f}")
            print(f"   Макс: {max(prices):.5f}")
        else:
            print(f"\n⚠️ Не получено данных")
        
        await client.disconnect()
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
