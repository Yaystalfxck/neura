"""
Тест получения свечей по примеру из официальных тестов
"""
import asyncio
from datetime import datetime
from app.config import get_settings
from pocketoptionapi_async.client import AsyncPocketOptionClient

settings = get_settings()


async def main():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    is_demo = '"isDemo":1' in ssid or '"isDemo": 1' in ssid
    
    print("Testing PocketOption API")
    print("=" * 50)
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
    
    try:
        print("\n1. Connecting...")
        await client.connect()
        print("   Connected!")
        
        await asyncio.sleep(3)
        
        # Test balance
        print("\n2. Balance...")
        try:
            balance = await client.get_balance()
            print(f"   Balance: ${balance.balance:.2f}")
        except Exception as e:
            print(f"   Error: {e}")
        
        # Test candles - КАК В ОФИЦИАЛЬНЫХ ТЕСТАХ
        print("\n3. Candles (timeframe='1m', count=10)...")
        try:
            candles = await client.get_candles(
                asset="EURUSD_otc", 
                timeframe="1m", 
                count=10
            )
            print(f"   Retrieved {len(candles)} candles")
            
            if candles and len(candles) > 0:
                print(f"\n   Last 3 candles:")
                for i, c in enumerate(candles[-3:]):
                    price = c.close if hasattr(c, 'close') else c.get('close', 0)
                    ts = c.timestamp if hasattr(c, 'timestamp') else c.get('time', 0)
                    if ts:
                        if hasattr(ts, 'strftime'):
                            t = ts.strftime('%H:%M:%S')
                        elif isinstance(ts, (int, float)):
                            t = datetime.utcfromtimestamp(ts).strftime('%H:%M:%S')
                        else:
                            t = str(ts)
                    else:
                        t = '???'
                    print(f"   [{i+1}] {t}  Close={price:.5f}")
                
                # Current price
                last = candles[-1]
                current_price = last.close if hasattr(last, 'close') else last.get('close', 0)
                print(f"\n   CURRENT PRICE: {current_price:.5f}")
                
        except Exception as e:
            print(f"   Error: {e}")
            import traceback
            traceback.print_exc()
        
        await client.disconnect()
        print("\nDone!")
        
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()


asyncio.run(main())
