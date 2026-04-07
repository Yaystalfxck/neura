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


async def test_realtime_candles():
    """
    Тест получения реальных свечей с Pocket Option
    
    Подключается к демо-счёту и получает последние 5 свечей для EURUSD OTC
    """
    print("\n" + "="*60)
    print("🧪 POCKET OPTION WEBSOCKET REAL-TIME TEST")
    print("="*60)
    
    # Получаем данные для подключения
    session_token = settings.POCKETOPTION_SESSION_TOKEN_DEMO
    uid = settings.POCKETOPTION_UID
    
    if not session_token:
        print("❌ POCKETOPTION_SESSION_TOKEN_DEMO не задан в .env!")
        print("   Добавьте в .env:")
        print("   POCKETOPTION_SESSION_TOKEN_DEMO=your-session-token")
        return False
    
    print(f"\n📝 Конфигурация:")
    print(f"   SSID: {session_token[:30]}...")
    print(f"   UID: {uid}")
    print(f"   Режим: DEMO")
    
    # Формируем SSID
    ssid = f'42["auth",{{"session":"{session_token}","isDemo":1,"uid":{uid},"platform":1,"isFastHistory":true,"isOptimized":true}}]'
    
    print(f"\n🔌 Подключение к Pocket Option WebSocket...")
    
    try:
        # Создаём клиент
        client = AsyncPocketOptionClient(
            ssid=ssid,
            is_demo=True,
            enable_logging=False,
        )
        
        # Подключаемся
        print("⏳ Connecting...")
        connected = await client.connect()
        
        if not connected:
            print("❌ Не удалось подключиться к PO WebSocket!")
            return False
        
        print("✅ WebSocket подключен!")
        
        # Проверяем баланс
        print("\n💰 Проверка баланса...")
        try:
            balance = await client.get_balance()
            if balance:
                bal_val = getattr(balance, 'balance', balance)
                print(f"✅ Баланс: ${bal_val}")
            else:
                print("⚠️ Баланс не доступен")
        except Exception as e:
            print(f"⚠️ Ошибка получения баланса: {e}")
        
        # Получаем свечи для AUDCAD OTC
        print("\n📊 Получение реальных свечей для AUD/CAD OTC...")
        
        try:
            candles = await client.get_candles("AUDCAD_otc", timeframe=60, count=5)
            
            if candles and len(candles) > 0:
                print(f"\n✅ Получено {len(candles)} свечей!")
                print(f"\n{'='*60}")
                print(f"{'Время':<20} {'Open':<10} {'High':<10} {'Low':<10} {'Close':<10}")
                print(f"{'='*60}")
                
                for i, candle in enumerate(candles):
                    # Получаем время
                    if hasattr(candle, 'time'):
                        timestamp = candle.time
                    elif isinstance(candle, dict):
                        timestamp = candle.get('time', 0)
                    else:
                        timestamp = 0
                    
                    if timestamp:
                        time_str = datetime.fromtimestamp(timestamp).strftime('%H:%M:%S')
                    else:
                        time_str = 'N/A'
                    
                    # Получаем цены
                    open_price = getattr(candle, 'open', candle.get('open', 0) if isinstance(candle, dict) else 0)
                    high = getattr(candle, 'high', candle.get('high', 0) if isinstance(candle, dict) else 0)
                    low = getattr(candle, 'low', candle.get('low', 0) if isinstance(candle, dict) else 0)
                    close = getattr(candle, 'close', candle.get('close', 0) if isinstance(candle, dict) else 0)
                    
                    print(f"{time_str:<20} {open_price:<10.5f} {high:<10.5f} {low:<10.5f} {close:<10.5f}")
                
                print(f"{'='*60}")
                
                # Показываем последнюю цену
                last_candle = candles[-1]
                last_close = getattr(last_candle, 'close', last_candle.get('close', 0) if isinstance(last_candle, dict) else 0)
                print(f"\n💰 ТЕКУЩАЯ ЦЕНА: {last_close:.5f}")
                print(f"📈 Свеча закрылась в: {datetime.now().strftime('%H:%M:%S')}")
                
            else:
                print("❌ Свечи не получены!")
                return False
                
        except Exception as e:
            print(f"❌ Ошибка получения свечей: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        # Получаем payout
        print("\n📈 Получение payout...")
        try:
            payout = await client.get_payout("AUDCAD_otc")
            if payout:
                payout_val = getattr(payout, 'payout', payout.get('payout', payout) if isinstance(payout, dict) else 0)
                print(f"✅ Payout для AUD/CAD OTC: {payout_val}%")
            else:
                print("⚠️ Payout не доступен")
        except Exception as e:
            print(f"⚠️ Ошибка получения payout: {e}")
        
        # Закрываем соединение
        print("\n🔌 Отключение...")
        await client.disconnect()
        print("✅ Отключено!")
        
        print("\n" + "="*60)
        print("✅ ТЕСТ ПРОШЁЛ УСПЕШНО!")
        print("="*60)
        
        return True
        
    except Exception as e:
        print(f"\n❌ КРИТИЧЕСКАЯ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Запуск теста"""
    success = await test_realtime_candles()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
