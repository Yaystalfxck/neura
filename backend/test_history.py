"""
Тест получения истории актива через BinaryOptionsToolsV2
Показывает разные способы получения исторических данных
"""
import asyncio
import time
from datetime import datetime
from BinaryOptionsToolsV2 import PocketOptionAsync
from app.config import get_settings

settings = get_settings()


async def main():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    asset = "EURUSD_otc"
    
    print("\n" + "="*60)
    print("🧪 Получение истории актива")
    print("="*60)
    print(f"   Актив: {asset}")
    
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
        
        # 3. Способ 1: get_candles() - основной метод
        print("\n3️⃣ Способ 1: get_candles(asset, timeframe, offset)")
        print("   timeframe=60 (секунды), offset=10000 (секунды истории)")
        try:
            candles = await client.get_candles(asset, 60, 10000)
            if candles and len(candles) > 0:
                print(f"   ✅ Получено {len(candles)} свечей")
                
                # Показываем первые 3
                print(f"\n   Первые 3 свечи:")
                for i, c in enumerate(candles[:3]):
                    ts = c.get('time', 0)
                    t = datetime.utcfromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S') if ts else '???'
                    o, h, l, cl = float(c.get('open', 0)), float(c.get('high', 0)), float(c.get('low', 0)), float(c.get('close', 0))
                    print(f"   [{i+1}] {t}  O={o:.5f} H={h:.5f} L={l:.5f} C={cl:.5f}")
                
                # Последние 3
                print(f"\n   Последние 3 свечи:")
                for i, c in enumerate(candles[-3:]):
                    ts = c.get('time', 0)
                    t = datetime.utcfromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S') if ts else '???'
                    o, h, l, cl = float(c.get('open', 0)), float(c.get('high', 0)), float(c.get('low', 0)), float(c.get('close', 0))
                    print(f"   [{len(candles)-2+i}] {t}  O={o:.5f} H={h:.5f} L={l:.5f} C={cl:.5f}")
                
                # Статистика
                prices = [float(c.get('close', 0)) for c in candles if c.get('close')]
                if prices:
                    print(f"\n   📊 Статистика:")
                    print(f"      Мин: {min(prices):.5f}")
                    print(f"      Макс: {max(prices):.5f}")
                    print(f"      Средняя: {sum(prices)/len(prices):.5f}")
            else:
                print(f"   ❌ Нет данных")
        except Exception as e:
            print(f"   ❌ Ошибка: {e}")
            import traceback
            traceback.print_exc()
        
        # 4. Способ 2: candles() - альтернативный метод
        print("\n4️⃣ Способ 2: candles(asset, timeframe)")
        print("   timeframe=60 (секунды)")
        try:
            candles2 = await client.candles(asset, 60)
            if candles2 and len(candles2) > 0:
                print(f"   ✅ Получено {len(candles2)} свечей")
                
                # Последние 3
                print(f"\n   Последние 3 свечи:")
                for i, c in enumerate(candles2[-3:]):
                    ts = c.get('time', 0)
                    t = datetime.utcfromtimestamp(ts).strftime('%H:%M:%S') if ts else '???'
                    o, h, l, cl = float(c.get('open', 0)), float(c.get('high', 0)), float(c.get('low', 0)), float(c.get('close', 0))
                    print(f"   [{i+1}] {t}  O={o:.5f} H={h:.5f} L={l:.5f} C={cl:.5f}")
            else:
                print(f"   ❌ Нет данных")
        except Exception as e:
            print(f"   ❌ Ошибка: {e}")
        
        # 5. Способ 3: history() - еще один метод
        print("\n5️⃣ Способ 3: history(asset, timeframe)")
        print("   timeframe=60 (секунды)")
        try:
            history = await client.history(asset, 60)
            if history and len(history) > 0:
                print(f"   ✅ Получено {len(history)} записей")
                
                # Последние 3
                print(f"\n   Последние 3 записи:")
                for i, h in enumerate(history[-3:]):
                    ts = h.get('time', 0)
                    t = datetime.utcfromtimestamp(ts).strftime('%H:%M:%S') if ts else '???'
                    cl = float(h.get('close', 0))
                    print(f"   [{i+1}] {t}  C={cl:.5f}")
            else:
                print(f"   ❌ Нет данных")
        except Exception as e:
            print(f"   ❌ Ошибка: {e}")
        
        # 6. Разные таймфреймы
        print("\n6️⃣ Разные таймфреймы для EURUSD_otc:")
        timeframes = [1, 5, 15, 30, 60, 300]
        for tf in timeframes:
            try:
                candles = await client.get_candles(asset, tf, 1000)
                if candles and len(candles) > 0:
                    last = candles[-1]
                    price = float(last.get('close', 0))
                    print(f"   ✅ {tf}s: {len(candles)} свечей, последняя={price:.5f}")
                else:
                    print(f"   ❌ {tf}s: нет данных")
            except Exception as e:
                print(f"   ❌ {tf}s: {e}")
        
        await client.disconnect()
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
