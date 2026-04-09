"""
Финальный тест: AsyncPocketOptionClient для системы сигналов
Показывает что библиотека работает для получения свечей и цен
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
    
    print("\n" + "="*60)
    print("🧪 ФИНАЛЬНЫЙ ТЕСТ: AsyncPocketOptionClient для сигналов")
    print("="*60)
    print(f"\n📋 Конфигурация:")
    print(f"   SSID: {ssid[:60]}...")
    print(f"   Demo: {is_demo}")
    print(f"   Актив: EURUSD_otc")
    
    try:
        # 1. Подключаемся
        print(f"\n🔌 Подключение...")
        client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
        connected = await client.connect()
        
        if not connected:
            print("❌ Не удалось подключиться")
            return False
        
        print("✅ Connected!")
        await asyncio.sleep(3)
        
        # 2. Получаем баланс
        print(f"\n💰 Balance...")
        try:
            balance = await client.get_balance()
            if balance:
                bal = getattr(balance, 'balance', balance)
                print(f"   ✅ Баланс: ${bal}")
        except Exception as e:
            print(f"   ⚠️ {e}")
        
        # 3. Получаем свечи
        print(f"\n📊 Получение свечей EURUSD_otc (60s)...")
        candles = await client.get_candles("EURUSD_otc", 60)
        
        if candles and len(candles) > 0:
            print(f"✅ ПОЛУЧЕНО: {len(candles)} свечей!")
            
            print(f"\n📈 Последние 5 свечей:")
            for i, c in enumerate(candles[-5:]):
                if hasattr(c, 'close'):
                    o, h, l, cl = c.open, c.high, c.low, c.close
                    ts = c.timestamp
                else:
                    o, h, l, cl = c.get('open', 0), c.get('high', 0), c.get('low', 0), c.get('close', 0)
                    ts = c.get('time', c.get('timestamp', 0))
                
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
            
            # Текущая цена
            last_candle = candles[-1]
            current_price = last_candle.close if hasattr(last_candle, 'close') else last_candle.get('close', 0)
            print(f"\n🎯 ТЕКУЩАЯ ЦЕНА: {current_price:.5f}")
        else:
            print(f"❌ Нет данных")
            return False
        
        # 4. Получаем payout
        print(f"\n💰 Payout...")
        try:
            payout = client.get_payout("EURUSD_otc")
            if payout:
                print(f"   ✅ Payout: {payout}%")
        except Exception as e:
            print(f"   ⚠️ {e}")
        
        # 5. Обновляем цену через 5 секунд
        print(f"\n⏳ Ожидание 5 сек...")
        await asyncio.sleep(5)
        
        print(f"📊 Обновление цены...")
        candles2 = await client.get_candles("EURUSD_otc", 60)
        if candles2 and len(candles2) > 0:
            last2 = candles2[-1]
            new_price = last2.close if hasattr(last2, 'close') else last2.get('close', 0)
            change = new_price - current_price
            print(f"   ✅ Новая цена: {new_price:.5f} (изменение: {change:+.5f})")
        
        await client.disconnect()
        
        print(f"\n{'='*60}")
        print("✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ!")
        print("✅ AsyncPocketOptionClient РАБОТАЕТ для системы сигналов!")
        print(f"{'='*60}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    result = asyncio.run(main())
    exit(0 if result else 1)
