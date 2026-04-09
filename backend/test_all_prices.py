"""
Проверка реальных цен по разным активам
"""
import asyncio
from datetime import datetime
from app.config import get_settings
from pocketoptionapi_async.client import AsyncPocketOptionClient

settings = get_settings()


async def main():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    is_demo = '"isDemo":1' in ssid or '"isDemo": 1' in ssid
    
    print("\n" + "="*60)
    print("🧪 Проверка реальных цен по активам")
    print("="*60)
    
    client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo, enable_logging=False)
    
    try:
        print("\n🔌 Подключение...")
        await client.connect()
        print("✅ Connected!")
        
        await asyncio.sleep(3)
        
        # Список активов для проверки
        assets = [
            "EURUSD_otc",
            "GBPUSD_otc", 
            "AUDUSD_otc",
            "USDJPY_otc",
            "USDCAD_otc",
            "EURJPY_otc",
            "GBPJPY_otc",
        ]
        
        print(f"\n📊 Цены активов:")
        print(f"   {'Актив':<15} {'Цена':<12} {'Payout':<8} {'Свечей'}")
        print(f"   {'='*45}")
        
        for asset in assets:
            try:
                # Получаем свечи
                candles = await client.get_candles(asset, 60)
                
                if candles and len(candles) > 0:
                    last = candles[-1]
                    price = last.close if hasattr(last, 'close') else last.get('close', 0)
                    
                    # Payout
                    try:
                        payout = client.get_payout(asset)
                        payout_str = f"{payout}%" if payout else "N/A"
                    except:
                        payout_str = "N/A"
                    
                    print(f"   {asset:<15} {price:<12.5f} {payout_str:<8} {len(candles)}")
                else:
                    print(f"   {asset:<15} {'Нет данных':<12}")
                
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"   {asset:<15} Ошибка: {str(e)[:30]}")
        
        # Проверим что ты видишь на маркете
        print(f"\n💡 Ты видишь цену 1.5975 - это может быть:")
        print(f"   • GBPUSD (обычно ~1.26-1.30)")
        print(f"   • AUDUSD (обычно ~0.65)")  
        print(f"   • USDJPY (обычно ~150-155)")
        print(f"   • EURJPY (обычно ~160-165)")
        print(f"   • GBPJPY (обычно ~190-195)")
        print(f"\n   1.5975 похоже на:")
        print(f"   • AUDCAD_otc (1.09-1.10)")
        print(f"   • NZDUSD_otc (0.60-0.62)")
        print(f"   • Или другой актив")
        
        await client.disconnect()
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
