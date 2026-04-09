"""
Быстрая проверка текущей цены EURUSD_otc
"""
import asyncio
from datetime import datetime
from app.config import get_settings
from pocketoptionapi_async.client import AsyncPocketOptionClient

settings = get_settings()


async def main():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    is_demo = '"isDemo":1' in ssid or '"isDemo": 1' in ssid
    
    print(f"Demo: {is_demo}")
    print(f"SSID: {ssid[:60]}...")
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
    await client.connect()
    await asyncio.sleep(3)
    
    # Получаем свечи
    candles = await client.get_candles("EURUSD_otc", 60)
    
    if candles and len(candles) > 0:
        last = candles[-1]
        price = last.close if hasattr(last, 'close') else last.get('close', 0)
        ts = last.timestamp if hasattr(last, 'timestamp') else last.get('time', 0)
        
        print(f"\n📊 EURUSD_otc:")
        print(f"   Цена: {price:.5f}")
        print(f"   Open: {last.open if hasattr(last, 'open') else last.get('open', 0):.5f}")
        print(f"   High: {last.high if hasattr(last, 'high') else last.get('high', 0):.5f}")
        print(f"   Low: {last.low if hasattr(last, 'low') else last.get('low', 0):.5f}")
        
        if ts:
            if hasattr(ts, 'strftime'):
                t = ts.strftime('%H:%M:%S')
            elif isinstance(ts, (int, float)):
                t = datetime.utcfromtimestamp(ts).strftime('%H:%M:%S')
            else:
                t = str(ts)
            print(f"   Время свечи: {t}")
        
        print(f"   Всего свечей: {len(candles)}")
        
        # Последние 3 свечи
        print(f"\n   Последние 3 свечи:")
        for i, c in enumerate(candles[-3:]):
            p = c.close if hasattr(c, 'close') else c.get('close', 0)
            ts_c = c.timestamp if hasattr(c, 'timestamp') else c.get('time', 0)
            if ts_c:
                if hasattr(ts_c, 'strftime'):
                    t = ts_c.strftime('%H:%M:%S')
                elif isinstance(ts_c, (int, float)):
                    t = datetime.utcfromtimestamp(ts_c).strftime('%H:%M:%S')
                else:
                    t = str(ts_c)
            else:
                t = '???'
            print(f"   [{i+1}] {t}  C={p:.5f}")
    else:
        print("❌ Нет данных")
    
    await client.disconnect()


asyncio.run(main())
