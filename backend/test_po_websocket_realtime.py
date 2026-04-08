#!/usr/bin/env python3
"""
Тест реального времени Pocket Option WebSocket
Использует BinaryOptionsToolsV2 для получения РЕАЛЬНОЙ цены и истории
"""

import asyncio
import sys
import time
from datetime import datetime
from BinaryOptionsToolsV2 import PocketOptionAsync
from app.config import get_settings

settings = get_settings()


async def test_realtime_price(is_demo: bool = True):
    print("\n" + "="*60)
    print(f"🧪 POCKET OPTION REAL-TIME (BinaryOptionsToolsV2)")
    print(f"   Режим: {'DEMO' if is_demo else 'REAL'}")
    print("="*60)
    
    # Session
    if is_demo:
        session_token = settings.POCKETOPTION_SESSION_TOKEN_DEMO
    else:
        session_token = settings.POCKETOPTION_SESSION_TOKEN
    
    if not session_token:
        print("❌ Token не задан!")
        return False
    
    print(f"\n📝 Config:")
    print(f"   SSID: {session_token[:40]}...")
    
    try:
        print("\n🔌 Connecting...")
        client = PocketOptionAsync(ssid=session_token)
        
        await client.connect()
        print("✅ Connected!")
        
        # Баланс
        print("\n💰 Balance...")
        try:
            balance = await client.balance()
            print(f"   ${balance}")
        except Exception as e:
            print(f"   ⚠️ {e}")
        
        # 1️⃣ Получаем ИСТОРИЧЕСКИЕ свечи для анализа
        print(f"\n📊 Получение истории EUR/USD OTC (100 свечей)...")
        try:
            history = await client.get_candles("EURUSD_otc", 60, 100)
            
            if history and len(history) > 0:
                print(f"   ✅ Получено {len(history)} исторических свечей")
                
                # Показываем последние 5
                print(f"\n   {'Время':<12} {'Open':<10} {'Close':<10} {'High':<10} {'Low':<10}")
                print(f"   {'='*55}")
                for c in history[-5:]:
                    ts = c.get('time', c.get('timestamp', 0))
                    o = float(c.get('open', 0))
                    cl = float(c.get('close', 0))
                    h = float(c.get('high', 0))
                    l = float(c.get('low', 0))
                    
                    t = datetime.utcfromtimestamp(ts).strftime('%H:%M:%S') if ts else '???'
                    print(f"   {t:<12} {o:<10.5f} {cl:<10.5f} {h:<10.5f} {l:<10.5f}")
                
                # Цена последней исторической свечи
                hist_last_price = float(history[-1].get('close', 0))
                hist_time = history[-1].get('time', 0)
                hist_time_str = datetime.utcfromtimestamp(hist_time).strftime('%H:%M:%S') if hist_time else '???'
                print(f"\n   📜 Историческая цена (закрытая): {hist_last_price:.5f}")
                print(f"   ⏱️ Время: {hist_time_str} UTC")
            else:
                print("   ❌ История не получена")
                history = []
        except Exception as e:
            print(f"   ❌ Ошибка истории: {e}")
            history = []
        
        # 2️⃣ Получаем ТЕКУЩУЮ реальную цену через стрим
        print(f"\n📡 Получение РЕАЛЬНОЙ цены EUR/USD OTC (стрим 3 сек)...")

        realtime_prices = []
        start_time = time.time()

        async for candle in await client.subscribe_symbol("EURUSD_otc"):
            price_raw = candle.get('close', candle.get('price', 0))
            ts = candle.get('time', candle.get('timestamp', 0))
            
            try:
                price = float(price_raw)
            except:
                price = 0.0
            
            if ts:
                t = datetime.utcfromtimestamp(ts).strftime('%H:%M:%S.%f')[:-3]
            else:
                t = datetime.utcnow().strftime('%H:%M:%S.%f')[:-3]
            
            realtime_prices.append(price)
            print(f"   💰 {t}  {price:.5f}")
            
            # Ждём 3 секунды
            if time.time() - start_time >= 3:
                break
        
        if realtime_prices:
            current_price = realtime_prices[-1]
            print(f"\n   🎯 ТЕКУЩАЯ РЕАЛЬНАЯ ЦЕНА: {current_price:.5f}")
        else:
            current_price = hist_last_price if history else 0
            print(f"\n   ⚠️ Стрим не получен, используем историю: {current_price:.5f}")
        
        # 3️⃣ Показываем разницу
        if history and realtime_prices:
            diff = current_price - hist_last_price
            diff_pct = (diff / hist_last_price) * 100
            print(f"\n📊 Сравнение:")
            print(f"   История:   {hist_last_price:.5f}")
            print(f"   Реальная:  {current_price:.5f}")
            print(f"   Разница:   {diff:+.5f} ({diff_pct:+.3f}%)")
        
        # Payout
        try:
            p = client.get_payout("AUDCAD_otc")
            print(f"\n💵 Payout: {p}%" if p else "💵 Payout: N/A")
        except:
            pass
        
        # Отключение
        print("\n🔌 Disconnecting...")
        try:
            await client.disconnect()
        except AttributeError:
            if hasattr(client, '__aexit__'):
                await client.__aexit__(None, None, None)
            pass
        print("✅ Done!")
        print("\n" + "="*60)
        print("✅ TEST COMPLETED!")
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    is_demo = len(sys.argv) < 2 or sys.argv[1].lower() != 'real'
    success = await test_realtime_price(is_demo)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
