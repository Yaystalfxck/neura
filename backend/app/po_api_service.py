# Pocket Option API Service
# Сервис для работы с Pocket Option API

import aiohttp
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
from app.po_config import POConfig

logger = logging.getLogger(__name__)


class RateLimiter:
    """Ограничитель частоты запросов (Rate Limiter)"""
    
    def __init__(self, calls_per_minute: int = 30):
        self.calls_per_minute = calls_per_minute
        self.min_interval = 60.0 / calls_per_minute  # Минимальный интервал между запросами
        self.last_call_time: Optional[datetime] = None
    
    async def wait_if_needed(self):
        """Ждать если нужно, чтобы не превысить лимит"""
        if self.last_call_time:
            elapsed = (datetime.utcnow() - self.last_call_time).total_seconds()
            if elapsed < self.min_interval:
                wait_time = self.min_interval - elapsed
                logger.debug(f"⏳ Rate limiter: ожидание {wait_time:.2f} сек")
                await asyncio.sleep(wait_time)
        self.last_call_time = datetime.utcnow()


class POAPIService:
    """Сервис для работы с Pocket Option API"""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.config = POConfig()
        self.assets_cache: List[Dict] = []
        self.last_update: Optional[datetime] = None
        self.rate_limiter = RateLimiter(calls_per_minute=30)  # 30 запросов в минуту
        self._cache_lock = asyncio.Lock()
    
    async def init_session(self):
        """Инициализация HTTP сессии"""
        if not self.session:
            self.session = aiohttp.ClientSession()
    
    async def close_session(self):
        """Закрытие сессии"""
        if self.session:
            await self.session.close()
            self.session = None
    
    async def get_payout_assets(self, min_payout: int = 80, market: str = "otc", use_cache: bool = True) -> List[Dict]:
        """
        Получение списка активов с высоким payout
        
        Args:
            min_payout: Минимальный payout процент
            market: Тип рынка (otc, live)
            use_cache: Использовать ли кэш (False для получения свежих данных)
            
        Returns:
            List[Dict]: Список активов
        """
        try:
            await self.init_session()
            
            # Проверяем кэш только если use_cache=True
            if use_cache:
                async with self._cache_lock:
                    if self.assets_cache and self.last_update:
                        if (datetime.utcnow() - self.last_update).seconds < 300:  # 5 минут
                            # Используем кэш если данные свежие
                            filtered = [
                                a for a in self.assets_cache 
                                if a.get('payout', 0) >= min_payout 
                                and (market == "all" or a.get('market_type', 'otc') == market)
                            ]
                            if filtered:
                                logger.info(f"✅ Используем кэш активов ({len(filtered)} шт.)")
                                return filtered
            
            # Ждем если нужно (rate limiting)
            await self.rate_limiter.wait_if_needed()
            
            # Получаем свежие данные из API
            logger.info("📡 Запрос свежих данных из API...")
            fresh_assets = await self._fetch_assets_from_api()
            
            if not fresh_assets:
                logger.warning("⚠️ Не удалось получить данные из API, используем кэш")
                if self.assets_cache:
                    fresh_assets = self.assets_cache
                else:
                    return []
            
            # Фильтруем по payout и market
            filtered = [
                a for a in fresh_assets 
                if a.get('payout', 0) >= min_payout 
                and (market == "all" or a.get('market_type', 'otc') == market)
            ]
            
            # Обновляем кэш
            async with self._cache_lock:
                self.assets_cache = fresh_assets
                self.last_update = datetime.utcnow()
            
            logger.info(f"✅ Получено {len(filtered)} активов с payout >= {min_payout}%")
            return filtered
            
        except Exception as e:
            logger.error(f"❌ Ошибка получения активов: {e}")
            # Возвращаем кэш если есть
            if self.assets_cache:
                return [a for a in self.assets_cache if a.get('payout', 0) >= min_payout]
            return []
    
    async def _fetch_assets_from_api(self) -> List[Dict]:
        """
        Получение списка активов из Pocket Option API
        
        Returns:
            List[Dict]: Список активов
        """
        try:
            # TODO: Здесь будет реальный запрос к Pocket Option API
            # Пока возвращаем демо-данные
            demo_assets = [
                {"id": "EURUSD_otc", "name": "EUR/USD OTC", "payout": 92, "market_type": "otc"},
                {"id": "GBPUSD_otc", "name": "GBP/USD OTC", "payout": 88, "market_type": "otc"},
                {"id": "AUDUSD_otc", "name": "AUD/USD OTC", "payout": 92, "market_type": "otc"},
                {"id": "USDJPY_otc", "name": "USD/JPY OTC", "payout": 92, "market_type": "otc"},
                {"id": "USDCAD_otc", "name": "USD/CAD OTC", "payout": 92, "market_type": "otc"},
                {"id": "USDCHF_otc", "name": "USD/CHF OTC", "payout": 39, "market_type": "otc"},
                {"id": "BTCUSD_otc", "name": "Bitcoin OTC", "payout": 92, "market_type": "otc"},
                {"id": "ETHUSD_otc", "name": "Ethereum OTC", "payout": 32, "market_type": "otc"},
                {"id": "LTCUSD_otc", "name": "Litecoin OTC", "payout": 66, "market_type": "otc"},
                {"id": "DOGE_otc", "name": "Dogecoin OTC", "payout": 84, "market_type": "otc"},
            ]
            return demo_assets
            
        except Exception as e:
            logger.error(f"❌ Ошибка получения данных из API: {e}")
            return []
    
    async def get_balance_from_api(self) -> Optional[float]:
        """
        Получение баланса из Pocket Option API
        
        Returns:
            float: Баланс или None
        """
        try:
            # TODO: Здесь будет реальный запрос к API
            # Пока возвращаем демо-баланс
            return 10000.00
            
        except Exception as e:
            logger.error(f"❌ Ошибка получения баланса: {e}")
            return None
    
    async def get_asset_quotes(self, asset_id: str) -> Optional[Dict]:
        """
        Получение котировок по активу
        
        Args:
            asset_id: ID актива
            
        Returns:
            Dict: Котировки или None
        """
        try:
            await self.init_session()
            
            # TODO: Реальный запрос к API
            # Пока возвращаем демо-данные
            return {
                "id": asset_id,
                "price": 1.0850,
                "change": 0.0012,
                "change_percent": 0.11,
                "bid": 1.0848,
                "ask": 1.0852,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Ошибка получения котировок {asset_id}: {e}")
            return None
    
    async def get_candles(self, asset_id: str, timeframe: int = 60, count: int = 100) -> Optional[List[Dict]]:
        """
        Получение свечей по активу
        
        Args:
            asset_id: ID актива
            timeframe: Таймфрейм в секундах
            count: Количество свечей
            
        Returns:
            List[Dict]: Список свечей или None
        """
        try:
            await self.init_session()
            
            # TODO: Реальный запрос к API
            # Пока возвращаем демо-данные
            candles = []
            now = datetime.utcnow()
            
            for i in range(count):
                candle_time = now - timedelta(minutes=(count - i))
                candles.append({
                    "time": candle_time.isoformat(),
                    "open": 1.0850 + (i * 0.0001),
                    "high": 1.0855 + (i * 0.0001),
                    "low": 1.0845 + (i * 0.0001),
                    "close": 1.0852 + (i * 0.0001),
                    "volume": 1000 + i
                })
            
            return candles
            
        except Exception as e:
            logger.error(f"❌ Ошибка получения свечей {asset_id}: {e}")
            return None
    
    async def get_balance(self) -> Optional[float]:
        """
        Получение баланса счета
        
        Returns:
            float: Баланс или None
        """
        try:
            await self.init_session()
            
            # TODO: Реальный запрос к API
            # Пока возвращаем демо-баланс
            return 10000.00
            
        except Exception as e:
            logger.error(f"❌ Ошибка получения баланса: {e}")
            return None


# Singleton instance
_po_service: Optional[POAPIService] = None


def get_po_service() -> POAPIService:
    """Получение экземпляра сервиса"""
    global _po_service
    if _po_service is None:
        _po_service = POAPIService()
    return _po_service
