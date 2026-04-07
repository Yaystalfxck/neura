#!/usr/bin/env python3
"""
Тест реального времени Pocket Option WebSocket
Подключается к PO, получает актуальные свечи и показывает текущую цену
"""

import asyncio
import sys
from datetime import datetime
from pocketoptionapi_async.client import AsyncPocketOptionClient
from app.config import get_settings

settings = get_settings()


async def test_realtime_candles(is_demo: bool = True):
    """
    Тест получения реальных свечей с Pocket Option
    """
    print("\n" + "="*60)
    print(f"🧪 POCKET OPTION WEBSOCKET REAL-TIME TEST")
    print(f"   Режим: {'DEMO' if is_demo else 'REAL'}")
    print("="*60)
    
    # Получаем данные для подключения
    if is_demo:
        session_token = settings.POCKETOPTION_SESSION_TOKEN_DEMO
        uid = settings.POCKETOPTION_UID
    else:
        session_token = settings.POCKETOPTION_SESSION_TOKEN
        uid = settings.POCKETOPTION_UID
    
    if not session_token:
        print("❌ Session token не задан!")
        return False
    
    print(f"\n📝 Конфигурация:")
    print(f"   SSID: {session_token[:30]}...")
    print(f"   UID: {uid}")
    
    # Формируем SSID
    if is_demo:
        ssid = f'42["auth",{{"session":"{session_token}","isDemo":1,"uid":{uid},"platform":1,"isFastHistory":true,"isOptimized":true}}]'
    else:
        ssid = session_token
    
    print(f"\n🔌 Подключение к Pocket Option WebSocket...")
    print(f"   Режим: {'DEMO' if is_demo else 'REAL'}")
    print(f"   SSID: {ssid[:60]}...")
    
    try:
        client = AsyncPocketOptionClient(
            ssid=ssid,
            is_demo=is_demo,
            enable_logging=False,
        )
        
        print("⏳ Connecting...")
        connected = await client.connect()
        
        if not connected:
            print("❌ Не удалось подключиться!")
            return False
        
        print("✅ WebSocket подключен!")
        
        # Баланс
        print("\n💰 Баланс...")
        try:
            balance = await client.get_balance()
            if balance:
                bal = getattr(balance, 'balance', balance)
                print(f"✅ ${bal}")
        except Exception as e:
            print(f"⚠️ {e}")
        
        # Подписываемся на стрим
        print(f"\n📡 Подписка на real-time AUD/CAD OTC...")
        
        # Отправляем changeSymbol
        subscribe_msg = '42["changeSymbol",{"asset":"AUDCAD_otc","period":60}]'
        await client._websocket.send_message(subscribe_msg)
        
        # Ждём stream update
        print("⏳ Ожидание данных...")
        await asyncio.sleep(3)
        
        # Проверяем кэш
        candles_cache = getattr(client, '_candles_cache', {})
        asset_info_cache = getattr(client, '_asset_info', {})
        
        if candles_cache and "AUDCAD_otc_60" in candles_cache:
            candles = candles_cache["AUDCAD_otc_60"]
            print(f"✅ Stream свечи: {len(candles)} шт")
            
            # Последние 5
            print(f"\n{'Время':<12} {'Open':<10} {'High':<10} {'Low':<10} {'Close':<10}")
            print("="*55)
            for c in candles[-5:]:
                o = getattr(c, 'open', c.get('open', 0))
                h = getattr(c, 'high', c.get('high', 0))
                l = getattr(c, 'low', c.get('low', 0))
                cl = getattr(c, 'close', c.get('close', 0))
                ts = getattr(c, 'timestamp', c.get('time', 0))
                if ts and hasattr(ts, 'timestamp'):
                    ts = int(ts.timestamp())
                t = datetime.fromtimestamp(ts).strftime('%H:%M:%S') if ts else '--:--:--'
                print(f"{t:<12} {o:<10.5f} {h:<10.5f} {l:<10.5f} {cl:<10.5f}")
            
            last = candles[-1]
            price = getattr(last, 'close', last.get('close', 0))
            print(f"\n💰 РЕАЛЬНАЯ ЦЕНА: {price:.5f}")
        else:
            print("⚠️ Stream candles не получены")
        
        if asset_info_cache and "AUDCAD_otc" in asset_info_cache:
            info = asset_info_cache["AUDCAD_otc"]
            print(f"\n📈 Информация:")
            for k, v in info.items():
                print(f"   {k}: {v}")
        
        # Payout
        print("\n📈 Payout...")
        try:
            p = client.get_payout("AUDCAD_otc")
            print(f"✅ {p}%" if p else "⚠️ N/A")
        except:
            print("⚠️ Ошибка")
        
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
    is_demo = len(sys.argv) < 2 or sys.argv[1].lower() != 'real'
    success = await test_realtime_candles(is_demo)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
