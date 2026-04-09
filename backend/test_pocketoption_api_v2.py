"""
Тест PocketOptionAPI-v2 (Mastaaa1987)
"""
import asyncio
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import get_settings
from pocketoptionapi.stable_api import PocketOption

settings = get_settings()


def test_api():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    
    print(f"\n🧪 Тест PocketOptionAPI-v2")
    print(f"   SSID: {ssid[:60]}...")
    
    try:
        # Создаем API
        print(f"\n🔌 Создание API...")
        api = PocketOption(ssid, demo=False)
        
        # Подключаемся
        print(f"📡 Connect...")
        api.connect()
        time.sleep(3)
        
        # Баланс
        print(f"\n💰 Balance...")
        balance = api.get_balance()
        print(f"   ✅ Баланс: {balance}")
        
        # Пары
        print(f"\n📋 Pairs...")
        pairs = api.get_pairs()
        if pairs:
            print(f"   ✅ Доступно пар: {len(pairs)}")
            # EURUSD_otc
            if 'EURUSD_otc' in pairs:
                print(f"   EURUSD_otc: {pairs['EURUSD_otc']}")
        
        # DataFrame
        print(f"\n📊 get_dataframe(EURUSD_otc, 60)...")
        df = api.get_dataframe("EURUSD_otc", period=60)
        if df is not None and len(df) > 0:
            print(f"   ✅ ПОЛУЧЕНО: {len(df)} свечей!")
            print(f"\n📈 Последние 5:")
            print(f"   {df.tail(5).to_string()}")
        else:
            print(f"   ❌ Нет данных")
        
        # History
        print(f"\n📊 get_history(EURUSD_otc, 60)...")
        history = api.get_history("EURUSD_otc", period=60, start_time=int(time.time()), end_time=int(time.time()) - 86400)
        if history and len(history) > 0:
            print(f"   ✅ ПОЛУЧЕНО: {len(history)} записей")
        else:
            print(f"   ❌ Нет данных")
        
        print(f"\n✅ Тест завершен!")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_api()
