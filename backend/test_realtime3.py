import asyncio
import time
from datetime import datetime
from app.config import get_settings
from pocketoptionapi_async.client import AsyncPocketOptionClient

async def main():
    ssid = get_settings().POCKETOPTION_SESSION_TOKEN
    is_demo = '"isDemo":1' in ssid or '"isDemo": 1' in ssid
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
    await client.connect()
    await asyncio.sleep(3)
    
    print('Real-time цены EURUSD_otc (15 сек):')
    print('Время           Цена         Изменение')
    print('='*45)
    
    start = time.time()
    prices = []
    last_candle_time = 0
    
    while time.time() - start < 15:
        try:
            # Пробуем получить свечи с таймфреймом 1 секунда
            candles = await client.get_candles('EURUSD_otc', 1)
            if candles and len(candles) > 0:
                last = candles[-1]
                price = last.close if hasattr(last, 'close') else last.get('close', 0)
                ts = last.timestamp if hasattr(last, 'timestamp') else last.get('time', 0)
                
                # Проверяем что это новая свеча
                if ts and ts != last_candle_time and price > 0:
                    last_candle_time = ts
                    prices.append(price)
                    t = datetime.utcnow().strftime('%H:%M:%S')
                    change = price - prices[0] if len(prices) > 1 else 0
                    print(f'{t:<15} {price:<12.5f} {change:+.5f}')
        except Exception as e:
            pass
        
        await asyncio.sleep(0.5)
    
    if prices:
        print(f'\nСтатистика:')
        print(f'  Обновлений: {len(prices)}')
        print(f'  Первая: {prices[0]:.5f}, Последняя: {prices[-1]:.5f}')
        print(f'  Изменение: {prices[-1] - prices[0]:+.5f}')
    else:
        print('\nНет данных')
    
    await client.disconnect()

asyncio.run(main())
