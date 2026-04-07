#!/usr/bin/env python3
"""
Тест реального времени Pocket Option WebSocket
Использует BinaryOptionsToolsV2 для получения РЕАЛЬНОЙ цены через subscribe_symbol
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
        
        # Подписываемся на реальные тики AUD/CAD OTC
        print(f"\n📡 subscribe_symbol: AUDCAD_otc...")
        print(f"   ⏳ Ожидание тиков (5 сек)...")
        
        prices = []
        start_time = time.time()
        
        async for candle in await client.subscribe_symbol("AUDCAD_otc"):
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
            
            prices.append(price)
            print(f"   💰 {t}  {price:.5f}")
            
            # Ждём 5 секунд
            if time.time() - start_time >= 5:
                break
        
        if prices:
            print(f"\n✅ Получено {len(prices)} тиков!")
            print(f"\n💰 РЕАЛЬНАЯ ЦЕНА СЕЙЧАС: {prices[-1]:.5f}")
        else:
            print("\n❌ Тики не получены — сессия истекла!")
        
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
            # BinaryOptionsToolsV2 может использовать другое имя метода
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
