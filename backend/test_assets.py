"""
Тест: какие активы доступны и можно ли получить с них свечи
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import get_settings
from BinaryOptionsToolsV2 import PocketOptionAsync

settings = get_settings()


async def main():
    ssid = settings.POCKETOPTION_SESSION_TOKEN
    
    print(f"\n🧪 Тест: доступные активы")
    
    client = PocketOptionAsync(ssid=ssid)
    await client.connect()
    print(f"✅ Connected")
    
    await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
    print(f"✅ Assets loaded")
    
    # Получаем список активных активов
    print(f"\n📋 Active assets...")
    assets = await client.active_assets()
    
    otc = [a for a in assets if a.get('is_otc') and a.get('is_active')]
    print(f"✅ OTC активов: {len(otc)}")
    
    # Пробуем первые 3
    for i, asset in enumerate(otc[:3]):
        symbol = asset['symbol']
        print(f"\n[{i+1}] {symbol} (payout: {asset.get('payout', '?')}%)")
        try:
            candles = await client.candles(symbol, 60)
            print(f"    ✅ candles(): {len(candles)} свечей")
        except Exception as e:
            print(f"    ❌ candles(): {e}")
    
    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
