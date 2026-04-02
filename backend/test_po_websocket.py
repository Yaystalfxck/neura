#!/usr/bin/env python3
"""
Тест PocketOption WebSocket подключения
Использует библиотеку pocketoptionapi_async

Запуск:
    python3 test_po_websocket.py
"""

import asyncio
import sys
from datetime import datetime

# Добавляем backend в path
sys.path.insert(0, '.')

from app.config import get_settings
from pocketoptionapi_async import AsyncPocketOptionClient

settings = get_settings()


async def test_connection():
    """Тест подключения к PO WebSocket"""
    print("=" * 70)
    print("🧪 PocketOption WebSocket Test")
    print("=" * 70)
    print()
    
    # Тестируем демо режим
    print("1️⃣ Тест ДЕМО подключения...")
    print("-" * 70)
    
    # Формируем полное сообщение в формате Socket.IO v4
    ssid_demo = f'42["auth",{{"session":"{settings.POCKETOPTION_SESSION_TOKEN_DEMO}","isDemo":1,"uid":{settings.POCKETOPTION_UID},"platform":1,"isFastHistory":true,"isOptimized":true}}]'
    
    print(f"   SSID: {ssid_demo[:60]}...")
    print(f"   URL: demo-api-eu.po.market (авто)")
    
    client_demo = AsyncPocketOptionClient(ssid=ssid_demo, is_demo=True, enable_logging=False)
    
    try:
        print("   🔌 Подключение...")
        connected = await client_demo.connect()
        print(f"   ✅ Подключение: {'УСПЕШНО' if connected else 'ОШИБКА'}")
        
        if connected:
            # Тест баланса
            print("\n   💰 Получение баланса...")
            balance = await client_demo.get_balance()
            if balance:
                if hasattr(balance, 'balance'):
                    print(f"   ✅ Баланс: ${balance.balance} {balance.currency}")
                else:
                    print(f"   ✅ Баланс: ${balance}")
            
            # Тест payout
            print("\n   📈 Получение payout...")
            try:
                # Получаем payout для конкретного актива (библиотека требует asset)
                payout = await client_demo.get_payout('EURUSD_otc')
                if payout:
                    print(f"   ✅ Payout для EURUSD_otc: {payout}%")
                    
                    # Пробуем получить для других активов
                    otc_assets = ['EURUSD_otc', 'GBPUSD_otc', 'AUDUSD_otc', 'USDJPY_otc']
                    print(f"   Примеры OTC:")
                    for asset in otc_assets:
                        try:
                            p = await client_demo.get_payout(asset)
                            if p:
                                print(f"      • {asset}: {p}%")
                        except:
                            pass
            except Exception as e:
                print(f"   ⚠️ Payout: {e}")
            
            # Тест свечей
            print("\n   📊 Получение свечей (EURUSD_otc)...")
            try:
                candles = await client_demo.get_candles('EURUSD_otc', timeframe=60, count=5)
                if candles:
                    print(f"   ✅ Свечи получены ({len(candles)} шт)")
                    last = candles[-1]
                    if hasattr(last, 'close'):
                        print(f"      Последняя: {last.close}")
                    else:
                        print(f"      Последняя: {last.get('close', 'N/A')}")
            except Exception as e:
                print(f"   ⚠️ Свечи: {e}")
            
            await client_demo.disconnect()
            print("\n   ✅ Демо тест завершён")
            
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    print("-" * 70)
    print()
    print("✅ Тестирование завершено")
    print("=" * 70)


if __name__ == "__main__":
    try:
        asyncio.run(test_connection())
    except KeyboardInterrupt:
        print("\n⚠️ Прервано пользователем")
    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
