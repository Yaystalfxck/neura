#!/usr/bin/env python3
"""
Тест BinaryOptionsToolsV2 с TaskGroup для получения данных всех активов параллельно
"""

import asyncio
import sys
from datetime import datetime
from BinaryOptionsToolsV2 import PocketOptionAsync
from app.config import get_settings

settings = get_settings()


async def test_taskgroup():
    print("\n" + "="*60)
    print("🧪 POCKET OPTION TASKGROUP TEST")
    print("="*60)
    
    session_token = settings.POCKETOPTION_SESSION_TOKEN
    
    if not session_token or 'session' not in session_token:
        print("❌ REAL сессия невалидна!")
        return False
    
    print(f"\n📝 Config:")
    print(f"   SSID: {session_token[:60]}...")
    
    try:
        print("\n🔌 Подключение...")
        client = PocketOptionAsync(ssid=session_token)
        await client.connect()
        print("✅ Подключено!")
        
        # Ждём установления соединения
        print("⏳ Ожидание 3 сек...")
        await asyncio.sleep(3)
        
        # "Пробуждаем" соединение
        print("🔄 Пробуждение...")
        try:
            await client.get_candles("EURUSD_otc", 60, 10)
            print("✅ Пробуждение успешно")
        except Exception as e:
            print(f"⚠️ Пробуждение: {e}")
        
        # Тестируемые активы
        currency_pairs = [
            "EURUSD_otc", "GBPUSD_otc", "AUDUSD_otc",
            "USDJPY_otc", "USDCAD_otc", "AUDCAD_otc"
        ]
        
        print(f"\n🔍 Тест TaskGroup для {len(currency_pairs)} активов...")
        
        # TaskGroup для параллельного получения данных
        history_tasks = {}
        async with asyncio.TaskGroup() as tg:
            for asset_id in currency_pairs:
                print(f"   📡 Создание задачи для {asset_id}...")
                task = tg.create_task(client.get_candles(asset_id, 60, 50))
                history_tasks[asset_id] = task
        
        # Ждём завершения задач
        print("⏳ Ожидание 10 сек для завершения задач...")
        await asyncio.sleep(10)
        
        # Собираем результаты
        print("\n📊 Результаты:")
        for asset_id, task in history_tasks.items():
            try:
                result = task.result()
                if result and len(result) > 0:
                    last_candle = result[-1]
                    price = last_candle.get('close', 0)
                    ts = last_candle.get('time', 0)
                    if ts:
                        time_str = datetime.utcfromtimestamp(ts).strftime('%H:%M:%S')
                    else:
                        time_str = 'N/A'
                    print(f"   ✅ {asset_id}: {len(result)} свечей, цена: {price:.5f}, время: {time_str}")
                else:
                    print(f"   ❌ {asset_id}: пустой результат")
            except Exception as e:
                print(f"   ❌ {asset_id}: ошибка - {e}")
        
        # Отключение
        print("\n🔌 Отключение...")
        await client.disconnect()
        print("✅ Готово!")
        
        print("\n" + "="*60)
        print("✅ ТЕСТ ЗАВЕРШЁН!")
        return True
        
    except Exception as e:
        print(f"\n❌ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    success = await test_taskgroup()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
