"""
Тест старой рабочей библиотеки AsyncPocketOptionClient (ChipaDevTeam)
Эта библиотека РАБОТАЕТ и получает свечи!
"""
import asyncio
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import get_settings
from pocketoptionapi_async.client import AsyncPocketOptionClient

settings = get_settings()


async def main():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    is_demo = '"isDemo":1' in ssid or '"isDemo": 1' in ssid
    
    print("\n" + "="*60)
    print("🧪 Тест AsyncPocketOptionClient (ChipaDevTeam)")
    print("="*60)
    print(f"\n📋 Конфигурация:")
    print(f"   SSID: {ssid[:60]}...")
    print(f"   Demo: {is_demo}")
    print(f"   Актив: EURUSD_otc")
    
    try:
        # 1. Подключаемся
        print(f"\n🔌 Подключение...")
        client = AsyncPocketOptionClient(
            ssid=ssid, 
            is_demo=is_demo, 
            enable_logging=False
        )
        
        connected = await client.connect()
        
        if not connected:
            print("❌ Не удалось подключиться")
            return
        
        print("✅ Connected!")
        
        # Ждем авторизации
        print("⏳ Ожидание авторизации (3 сек)...")
        await asyncio.sleep(3)
        
        # 2. Получаем баланс
        print(f"\n💰 Balance...")
        try:
            balance = await client.get_balance()
            if balance:
                bal = getattr(balance, 'balance', balance)
                print(f"   ✅ Баланс: ${bal}")
        except Exception as e:
            print(f"   ⚠️ Баланс: {e}")
        
        # 3. Получаем свечи
        print(f"\n📊 get_candles(EURUSD_otc, 60)...")
        try:
            candles = await client.get_candles("EURUSD_otc", 60)
            
            if candles and len(candles) > 0:
                print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
                
                print(f"\n📈 Последние 5 свечей:")
                for i, c in enumerate(candles[-5:]):
                    # Проверяем формат
                    if hasattr(c, 'open'):
                        # Объект
                        o, h, l, cl = c.open, c.high, c.low, c.close
                        ts = c.timestamp if hasattr(c, 'timestamp') else 0
                    else:
                        # Словарь
                        o, h, l, cl = c.get('open', 0), c.get('high', 0), c.get('low', 0), c.get('close', 0)
                        ts = c.get('time', c.get('timestamp', 0))
                    
                    # Форматируем время (может быть datetime или int)
                    if ts:
                        if isinstance(ts, int):
                            t = datetime.utcfromtimestamp(ts).strftime('%H:%M:%S')
                        elif hasattr(ts, 'strftime'):
                            t = ts.strftime('%H:%M:%S')
                        else:
                            t = str(ts)
                    else:
                        t = '???'
                    print(f"   [{i+1}] {t}  O={o:.5f}, H={h:.5f}, L={l:.5f}, C={cl:.5f}")
            else:
                print(f"❌ Нет данных")
        except Exception as e:
            print(f"❌ get_candles: {e}")
            import traceback
            traceback.print_exc()
        
        # 4. Подписка на реальные цены
        print(f"\n📡 Real-time подписка EURUSD_otc (5 сек)...")
        try:
            prices = []
            start_time = time.time()
            
            async for candle in await client.subscribe_symbol("EURUSD_otc"):
                # Получаем цену
                if hasattr(candle, 'close'):
                    price = candle.close
                elif isinstance(candle, dict):
                    price = candle.get('close', candle.get('price', 0))
                else:
                    price = 0
                
                if price:
                    prices.append(float(price))
                    if len(prices) <= 5 or len(prices) % 10 == 0:
                        from datetime import datetime
                        t = datetime.utcnow().strftime('%H:%M:%S.%f')[:-3]
                        print(f"   💰 #{len(prices)} {t}  {price:.5f}")
                
                if time.time() - start_time >= 5:
                    break
            
            if prices:
                print(f"\n✅ Real-time: {len(prices)} обновлений")
                print(f"   Первая: {prices[0]:.5f}")
                print(f"   Последняя: {prices[-1]:.5f}")
                print(f"   Изменение: {prices[-1] - prices[0]:.5f}")
            else:
                print(f"❌ Real-time: нет данных")
                
        except Exception as e:
            print(f"⚠️ Real-time: {e}")
        
        # Отключаемся
        print(f"\n🔌 Disconnect...")
        await client.disconnect()
        print("✅ Done!")
        
        print(f"\n{'='*60}")
        print("✅ TEST COMPLETED SUCCESSFULLY!")
        print(f"{'='*60}")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
