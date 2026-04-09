"""
Тест BinaryOptionsToolsV2 для получения real-time данных
"""
import asyncio
import time
from datetime import datetime
from app.config import get_settings
from BinaryOptionsToolsV2 import PocketOptionAsync

settings = get_settings()


async def main():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    
    print("\n" + "="*60)
    print("🧪 BinaryOptionsToolsV2 - Real-time тест")
    print("="*60)
    
    client = PocketOptionAsync(ssid=ssid)
    
    try:
        # 1. Connect
        print("\n1️⃣ Connect...")
        await client.connect()
        print("   ✅ Connected!")
        
        # 2. Wait for assets
        print("\n2️⃣ Wait for assets...")
        await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
        print("   ✅ Assets loaded!")
        
        # 3. Balance
        print("\n3️⃣ Balance...")
        balance = await client.balance()
        print(f"   ✅ Balance: ${balance}")
        
        # 4. Payout
        print("\n4️⃣ Payout...")
        payout = await client.payout("EURUSD_otc")
        print(f"   ✅ EURUSD_otc payout: {payout}%")
        
        # 5. Candles
        print("\n5️⃣ Candles (EURUSD_otc, 60s)...")
        try:
            candles = await client.get_candles("EURUSD_otc", 60, 100)
            if candles and len(candles) > 0:
                last = candles[-1]
                price = float(last.get('close', 0))
                ts = last.get('time', 0)
                t = datetime.utcfromtimestamp(ts).strftime('%H:%M:%S') if ts else '???'
                print(f"   ✅ {len(candles)} candles")
                print(f"   Last candle: {t}  Close={price:.5f}")
            else:
                print(f"   ❌ No candles")
        except Exception as e:
            print(f"   ❌ Candles error: {e}")
            import traceback
            traceback.print_exc()
        
        # 6. Real-time subscription
        print("\n6️⃣ Real-time subscription (EURUSD_otc, 10 sec)...")
        prices = []
        try:
            start = time.time()
            print(f"   {'Time':<15} {'Price':<12} {'Change'}")
            print(f"   {'='*40}")
            
            async for candle in await client.subscribe_symbol("EURUSD_otc"):
                price = candle.get('close', candle.get('price', 0))
                try:
                    price = float(price)
                    prices.append(price)
                    t = datetime.utcnow().strftime('%H:%M:%S.%f')[:-3]
                    change = price - prices[0] if len(prices) > 1 else 0
                    print(f"   {t:<15} {price:<12.5f} {change:+.5f}")
                except:
                    pass
                
                if time.time() - start >= 10:
                    break
            
            if prices:
                print(f"\n   ✅ {len(prices)} ticks received")
                print(f"   First: {prices[0]:.5f}")
                print(f"   Last: {prices[-1]:.5f}")
                print(f"   Change: {prices[-1] - prices[0]:+.5f}")
            else:
                print(f"   ❌ No ticks received")
                
        except Exception as e:
            print(f"   ❌ Subscription error: {e}")
            import traceback
            traceback.print_exc()
        
        # 7. Active assets
        print("\n7️⃣ Active assets...")
        try:
            assets = await client.active_assets()
            otc = [a for a in assets if a.get('is_otc') and a.get('is_active')]
            print(f"   ✅ {len(otc)} OTC assets")
            for a in otc[:5]:
                print(f"     {a['symbol']}: payout={a.get('payout', '?')}%")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        await client.disconnect()
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
