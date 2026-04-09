"""
Прямой тест WebSocket для получения real-time цен
"""
import asyncio
import time
from datetime import datetime
from app.config import get_settings
from pocketoptionapi_async.websocket_client import WebSocketClient
from pocketoptionapi_async.models import ConnectionInfo

settings = get_settings()


async def main():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    is_demo = '"isDemo":1' in ssid or '"isDemo": 1' in ssid
    
    print("\n🧪 Прямой WebSocket тест")
    print("="*50)
    
    prices = []
    
    # Создаем WebSocket клиент
    ws = WebSocketClient(enable_logging=False)
    
    # Обработчик сообщений
    @ws.on_event("stream_update")
    async def on_stream(data):
        try:
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, list) and len(item) >= 3:
                        asset, ts, price = item[0], item[1], float(item[2])
                        if asset == 'EURUSD_otc' and price > 0:
                            prices.append({'time': datetime.utcnow(), 'price': price})
                            t = prices[-1]['time'].strftime('%H:%M:%S.%f')[:-3]
                            change = price - prices[0]['price'] if len(prices) > 1 else 0
                            print(f"  {t:<18} {price:<10.5f} {change:+.5f}")
        except Exception as e:
            pass
    
    try:
        # Подключаемся
        print("\n🔌 Подключение...")
        connected = await ws.connect(
            ConnectionInfo(
                ssid=ssid,
                is_demo=is_demo,
                uid=111441110,
                platform=1
            )
        )
        
        if not connected:
            print("❌ Не удалось подключиться")
            return
        
        print("✅ Connected!")
        
        # Ждем авторизации
        await asyncio.sleep(3)
        
        # Отправляем запрос на стрим
        print(f"\n📡 Подписка на EURUSD_otc...")
        await ws.send_message('42["changeSymbol",{"asset":"EURUSD_otc","period":60}]')
        
        print(f"\n📡 Ожидание обновлений (15 сек)...")
        print(f"  {'Время':<18} {'Цена':<10} {'Изменение'}")
        print(f"  {'='*40}")
        
        # Ждем 15 секунд
        await asyncio.sleep(15)
        
        # Статистика
        if prices:
            print(f"\n📊 Статистика:")
            print(f"  Обновлений: {len(prices)}")
            print(f"  Первая: {prices[0]['price']:.5f}")
            print(f"  Последняя: {prices[-1]['price']:.5f}")
            print(f"  Изменение: {prices[-1]['price'] - prices[0]['price']:+.5f}")
        else:
            print(f"\n⚠️ Не получено обновлений")
        
        await ws.disconnect()
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
