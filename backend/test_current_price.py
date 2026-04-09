"""
Тест REAL-TIME цены через постоянный запрос свечей
Каждые 2 секунды получаем свежие свечи - последняя свеча НЕ закрыта и показывает текущую цену
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
    print("🧪 REAL-TIME цена через обновление свечей")
    print("="*60)
    print("💡 Метод: каждые 2 сек получаем свечи")
    print("   Последняя свеча = текущая цена")
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
    
    try:
        # 1. Подключаемся
        print("\n🔌 Подключение...")
        await client.connect()
        print("✅ Connected!")
        
        await asyncio.sleep(3)
        
        # 2. Начальная цена
        print(f"\n📊 Начальная цена...")
        candles = await client.get_candles(asset, 60)
        if candles and len(candles) > 0:
            last = candles[-1]
            start_price = last.close if hasattr(last, 'close') else last.get('close', 0)
            print(f"   ✅ Стартовая цена: {start_price:.5f}")
        else:
            print(f"   ❌ Нет данных")
            return
        
        # 3. Мониторинг
        print(f"\n⏳ Мониторинг (20 сек, каждые 2 сек)...")
        print(f"   {'Время':<15} {'Цена':<12} {'Изменение':<12} {'Задержка'}")
        print(f"   {'='*55}")
        
        start_time = time.time()
        prices = []
        
        while time.time() - start_time < 20:
            try:
                candles = await client.get_candles(asset, 60)
                if candles and len(candles) > 0:
                    last = candles[-1]
                    price = last.close if hasattr(last, 'close') else last.get('close', 0)
                    
                    # Время свечи
                    ts = last.timestamp if hasattr(last, 'timestamp') else last.get('time', 0)
                    if ts:
                        if hasattr(ts, 'strftime'):
                            candle_time = ts
                            delay_sec = (datetime.utcnow() - candle_time).total_seconds()
                        elif isinstance(ts, (int, float)):
                            candle_time = datetime.utcfromtimestamp(ts)
                            delay_sec = (datetime.utcnow() - candle_time).total_seconds()
                        else:
                            delay_sec = 0
                    else:
                        delay_sec = 0
                    
                    if price > 0:
                        prices.append(price)
                        t = datetime.utcnow().strftime('%H:%M:%S')
                        change = price - prices[0] if len(prices) > 1 else 0
                        
                        # Определяем задержку
                        if delay_sec < 2:
                            delay_label = "REAL-TIME ✅"
                        elif delay_sec < 30:
                            delay_label = f"~{int(delay_sec)}сек"
                        else:
                            delay_label = f"~{int(delay_sec)}сек ⚠️"
                        
                        print(f"   {t:<15} {price:<12.5f} {change:+.5f}      {delay_label}")
                
            except Exception as e:
                pass
            
            await asyncio.sleep(2)
        
        # 4. Статистика
        if prices:
            print(f"\n📊 Статистика:")
            print(f"   Обновлений: {len(prices)}")
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
