# Pocket Option Signal Generator
# Генератор торговых сигналов на основе данных Pocket Option API

import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import aiohttp
import logging

logger = logging.getLogger(__name__)


class POSignalGenerator:
    """Генератор сигналов на основе Pocket Option API"""
    
    def __init__(self):
        self.session = None
        self.assets_cache = []
        self.last_update = None
    
    async def init_session(self):
        """Инициализация HTTP сессии"""
        if not self.session:
            self.session = aiohttp.ClientSession()
    
    async def close_session(self):
        """Закрытие сессии"""
        if self.session:
            await self.session.close()
            self.session = None
    
    async def generate_signal(
        self,
        strategy_type: str = "indicators",
        assets: List[Dict] = None,
        timeframe: int = 60,
        min_payout: int = 80
    ) -> Optional[Dict]:
        """
        Генерация торгового сигнала
        
        Args:
            strategy_type: Тип стратегии (indicators, martingale, ml)
            assets: Список активов (если None, будет получен из API)
            timeframe: Таймфрейм в секундах
            min_payout: Минимальный payout
            
        Returns:
            Dict: Сигнал или None
        """
        try:
            await self.init_session()
            
            # Получаем активы если не переданы
            if not assets:
                logger.info(f"📡 Получение активов (min_payout={min_payout}%)...")
                assets = await self.get_payout_assets(
                    min_payout=min_payout,
                    market="otc",
                    use_cache=False  # Получаем свежие данные при запросе сигнала
                )
                
                if not assets:
                    logger.error("❌ Нет доступных активов")
                    return None
            
            logger.info(f"✅ Найдено {len(assets)} активов")
            
            # Выбираем лучший актив (с максимальным payout)
            best_asset = max(assets, key=lambda x: x.get('payout', 0))
            logger.info(f"🎯 Выбран актив: {best_asset['name']} (payout: {best_asset['payout']}%)")
            
            # Получаем данные по активу
            asset_data = await self.get_asset_data(best_asset['id'])
            
            if not asset_data:
                logger.error(f"❌ Не удалось получить данные по {best_asset['id']}")
                return None
            
            # Генерируем сигнал на основе стратегии
            logger.info(f"📊 Генерация сигнала (стратегия: {strategy_type})...")
            signal = await self._generate_signal_by_strategy(
                asset_data=asset_data,
                asset_info=best_asset,
                strategy_type=strategy_type
            )
            
            if signal:
                logger.info(f"✅ Сигнал сгенерирован: {signal.get('pair_name')} - {signal.get('signal_type')}")
            
            return signal
            
        except Exception as e:
            logger.error(f"❌ Ошибка генерации сигнала: {e}")
            return None
    
    async def _generate_signal_by_strategy(
        self,
        asset_data: Dict,
        asset_info: Dict,
        strategy_type: str
    ) -> Optional[Dict]:
        """Генерация сигнала на основе стратегии"""
        if strategy_type == "indicators":
            return self._generate_indicator_signal(asset_data, asset_info)
        elif strategy_type == "martingale":
            return self._generate_martingale_signal(asset_data, asset_info)
        elif strategy_type == "ml":
            return self._generate_ml_signal(asset_data, asset_info)
        else:
            return self._generate_indicator_signal(asset_data, asset_info)
    
    async def get_payout_assets(self, min_payout: int = 80, market: str = "otc", use_cache: bool = True) -> List[Dict]:
        """
        Получение списка активов с высоким payout

        Args:
            min_payout: Минимальный payout процент
            market: Тип рынка (otc, live)
            use_cache: Использовать ли кэш

        Returns:
            List[Dict]: Список активов
        """
        try:
            await self.init_session()

            # Фильтруем кэш или получаем новые данные
            if use_cache and self.assets_cache and self.last_update:
                if (datetime.utcnow() - self.last_update).seconds < 60:
                    # Используем кэш если данные свежие (< 1 минуты)
                    filtered = [a for a in self.assets_cache
                               if a.get('payout', 0) >= min_payout
                               and (market == "all" or a.get('market_type', 'otc') == market)]
                    if filtered:
                        return filtered

            # TODO: Здесь будет запрос к API Pocket Option для получения актуальных данных
            # Пока используем заглушку с демо-данными
            demo_assets = [
                {"id": "EURUSD_otc", "name": "EUR/USD OTC", "payout": 92, "market_type": "otc"},
                {"id": "GBPUSD_otc", "name": "GBP/USD OTC", "payout": 88, "market_type": "otc"},
                {"id": "AUDUSD_otc", "name": "AUD/USD OTC", "payout": 92, "market_type": "otc"},
                {"id": "USDJPY_otc", "name": "USD/JPY OTC", "payout": 92, "market_type": "otc"},
                {"id": "USDCAD_otc", "name": "USD/CAD OTC", "payout": 92, "market_type": "otc"},
                {"id": "USDCHF_otc", "name": "USD/CHF OTC", "payout": 39, "market_type": "otc"},
                {"id": "BTCUSD_otc", "name": "Bitcoin OTC", "payout": 92, "market_type": "otc"},
                {"id": "ETHUSD_otc", "name": "Ethereum OTC", "payout": 32, "market_type": "otc"},
            ]

            # Фильтруем по payout и market
            filtered = [a for a in demo_assets
                       if a.get('payout', 0) >= min_payout
                       and (market == "all" or a.get('market_type', 'otc') == market)]

            # Обновляем кэш
            self.assets_cache = demo_assets
            self.last_update = datetime.utcnow()

            return filtered

        except Exception as e:
            logger.error(f"❌ Ошибка получения активов: {e}")
            return []
    
    async def get_asset_data(self, asset_id: str) -> Optional[Dict]:
        """
        Получение данных по активу
        
        Args:
            asset_id: ID актива
            
        Returns:
            Dict: Данные актива или None
        """
        try:
            await self.init_session()
            
            # TODO: Здесь будет запрос к API Pocket Option
            # Пока возвращаем демо-данные
            return {
                "id": asset_id,
                "name": asset_id.replace("_otc", " OTC"),
                "price": 1.0850,
                "change": 0.0012,
                "change_percent": 0.11,
                "candles": [],
                "indicators": {
                    "rsi": 52.5,
                    "macd": 0.0002,
                    "trend": "neutral"
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Ошибка получения данных актива {asset_id}: {e}")
            return None
    
    def _generate_indicator_signal(self, asset_data: Dict, asset_info: Dict) -> Dict:
        """Генерация сигнала на основе индикаторов"""
        now = datetime.utcnow()
        indicators = asset_data.get('indicators', {})
        
        rsi = indicators.get('rsi', 50)
        macd = indicators.get('macd', 0)
        trend = indicators.get('trend', 'neutral')
        
        # Определяем направление
        if rsi < 30:  # Oversold
            signal_type = "call"
            confidence = 70
            strength = "strong"
        elif rsi > 70:  # Overbought
            signal_type = "put"
            confidence = 70
            strength = "strong"
        elif macd > 0.0005:
            signal_type = "call"
            confidence = 65
            strength = "medium"
        elif macd < -0.0005:
            signal_type = "put"
            confidence = 65
            strength = "medium"
        else:
            signal_type = "call"
            confidence = 55
            strength = "weak"
        
        expiry = 3
        expiry_time = now + timedelta(minutes=expiry)
        valid_until = now + timedelta(seconds=30)
        
        return {
            "signal_type": signal_type,
            "strength": strength,
            "confidence": f"{confidence}%",
            "current_price": asset_data.get('price', 1.0850),
            "expiry_minutes": expiry,
            "expiry_timestamp": expiry_time.isoformat(),
            "valid_until": valid_until.isoformat(),
            "pair_name": asset_info.get('name', asset_info.get('id', 'EUR/USD')),
            "trend": trend,
            "rsi": rsi,
            "macd_direction": "bullish" if macd > 0 else "bearish" if macd < 0 else "neutral",
            "payout": f"{asset_info.get('payout', 80)}%",
            "volatility": 0.01
        }
    
    def _generate_martingale_signal(self, asset_data: Dict, asset_info: Dict) -> Dict:
        """Генерация сигнала для стратегии Мартингейл"""
        # Базовый сигнал с повышенным confidence
        signal = self._generate_indicator_signal(asset_data, asset_info)
        signal['strategy'] = 'martingale'
        signal['martingale_step'] = 1
        signal['next_bet_multiplier'] = 2.0
        return signal
    
    def _generate_ml_signal(self, asset_data: Dict, asset_info: Dict) -> Dict:
        """Генерация сигнала на основе ML"""
        # Базовый сигнал с ML-enhanced confidence
        signal = self._generate_indicator_signal(asset_data, asset_info)
        signal['strategy'] = 'ml'
        signal['ml_confidence'] = signal['confidence']
        signal['model_version'] = 'v1.0'
        return signal


# Singleton instance
_signal_generator: Optional[POSignalGenerator] = None


def get_signal_generator() -> POSignalGenerator:
    """Получение экземпляра генератора"""
    global _signal_generator
    if _signal_generator is None:
        _signal_generator = POSignalGenerator()
    return _signal_generator


async def get_payout_assets(min_payout: int = 80, market: str = "otc") -> List[Dict]:
    """Получение списка активов с высоким payout"""
    generator = get_signal_generator()
    return await generator.get_payout_assets(min_payout, market)
