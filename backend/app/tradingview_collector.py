# TradingView Data Collector for Python Backend
# Получение данных и индикаторов для генерации сигналов

import asyncio
import aiohttp
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import numpy as np
from dataclasses import dataclass, field, asdict
import json


@dataclass
class Candle:
    time: int
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0


@dataclass
class Indicators:
    current_price: float = 0.0
    prev_price: float = 0.0
    price_change: float = 0.0
    
    rsi: float = 50.0
    rsi_signal: str = 'neutral'
    
    macd_line: float = 0.0
    macd_signal: float = 0.0
    macd_histogram: float = 0.0
    macd_signal_direction: str = 'neutral'
    
    bb_upper: float = 0.0
    bb_middle: float = 0.0
    bb_lower: float = 0.0
    bb_position: str = 'middle'
    bb_width: float = 0.0
    
    sma20: float = 0.0
    sma50: float = 0.0
    price_above_sma20: int = 0
    price_above_sma50: int = 0
    sma20_above_sma50: int = 0
    
    atr: float = 0.0
    volatility: float = 0.0
    
    volume: float = 0.0
    avg_volume: float = 0.0
    volume_ratio: float = 1.0
    
    trend: str = 'neutral'
    trend_strength: float = 0.0
    
    support: float = 0.0
    resistance: float = 0.0
    
    candle_pattern: str = 'unknown'
    candle_size: float = 0.0
    
    has_enough_data: bool = False


@dataclass
class MarketPair:
    symbol: str
    name: str
    current_price: float
    price_change: str
    change_direction: str
    candles: List[Candle] = field(default_factory=list)
    indicators: Optional[Indicators] = None
    timestamp: str = ''
    timeframe: str = '1m'
    volume: float = 0.0
    analysis_time: str = ''
    candles_count: int = 0
    has_enough_data: bool = False
    price_source: str = 'live'


class TradingViewCollector:
    """
    Коллектор данных для TradingView
    Получает свечи и рассчитывает индикаторы
    """
    
    SYMBOLS = {
        'otc': [
            {'symbol': 'FX_IDC:EURUSD', 'name': 'EUR/USD OTC'},
            {'symbol': 'FX_IDC:GBPUSD', 'name': 'GBP/USD OTC'},
            {'symbol': 'FX_IDC:USDJPY', 'name': 'USD/JPY OTC'},
            {'symbol': 'FX_IDC:AUDUSD', 'name': 'AUD/USD OTC'},
            {'symbol': 'FX_IDC:USDCAD', 'name': 'USD/CAD OTC'},
            {'symbol': 'FX_IDC:USDCHF', 'name': 'USD/CHF OTC'},
            {'symbol': 'FX_IDC:NZDUSD', 'name': 'NZD/USD OTC'},
            {'symbol': 'FX_IDC:GBPJPY', 'name': 'GBP/JPY OTC'},
            {'symbol': 'FX_IDC:EURJPY', 'name': 'EUR/JPY OTC'},
            {'symbol': 'FX_IDC:AUDJPY', 'name': 'AUD/JPY OTC'},
        ],
        'market': [
            {'symbol': 'FX:EURUSD', 'name': 'EUR/USD'},
            {'symbol': 'FX:GBPUSD', 'name': 'GBP/USD'},
            {'symbol': 'FX:USDJPY', 'name': 'USD/JPY'},
            {'symbol': 'FX:AUDUSD', 'name': 'AUD/USD'},
            {'symbol': 'FX:USDCAD', 'name': 'USD/CAD'},
            {'symbol': 'FX:USDCHF', 'name': 'USD/CHF'},
            {'symbol': 'FX:NZDUSD', 'name': 'NZD/USD'},
            {'symbol': 'FX:GBPJPY', 'name': 'GBP/JPY'},
            {'symbol': 'FX:EURJPY', 'name': 'EUR/JPY'},
            {'symbol': 'FX:AUDJPY', 'name': 'AUD/JPY'},
        ],
        'demo': [
            {'symbol': 'FX:EURUSD', 'name': 'EUR/USD'},
            {'symbol': 'FX:GBPUSD', 'name': 'GBP/USD'},
            {'symbol': 'FX:USDJPY', 'name': 'USD/JPY'},
            {'symbol': 'FX:AUDUSD', 'name': 'AUD/USD'},
            {'symbol': 'FX:USDCAD', 'name': 'USD/CAD'},
            {'symbol': 'FX:USDCHF', 'name': 'USD/CHF'},
        ]
    }
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.current_prices: Dict[str, float] = {}
        
    async def init(self):
        """Инициализация сессии"""
        if not self.session:
            self.session = aiohttp.ClientSession()
            print("✅ TradingView Collector инициализирован")
    
    async def close(self):
        """Закрытие сессии"""
        if self.session:
            await self.session.close()
            print("🔌 TradingView Collector закрыт")
    
    async def get_candles(
        self, 
        symbol: str, 
        timeframe: str = '1', 
        bars: int = 500
    ) -> List[Candle]:
        """
        Получение свечей с TradingView
        timeframe: '1', '5', '15', '60' (минуты)
        """
        try:
            # TradingView не имеет публичного API, используем mock данные для демонстрации
            # В production нужно использовать библиотеку типа 'tradingview-ta' или парсинг
            
            # Для демонстрации генерируем данные на основе текущего времени
            candles = []
            base_price = 1.0850  # Базовая цена для EUR/USD
            
            for i in range(bars):
                timestamp = datetime.utcnow() - timedelta(minutes=bars-i)
                
                # Генерация случайных колебаний цены
                noise = np.random.normal(0, 0.0001)
                trend = 0.00001 * i  # Небольшой тренд
                
                close = base_price + noise + trend
                open_price = close + np.random.normal(0, 0.00005)
                high = max(open_price, close) + abs(np.random.normal(0, 0.0001))
                low = min(open_price, close) - abs(np.random.normal(0, 0.0001))
                
                candle = Candle(
                    time=int(timestamp.timestamp()),
                    timestamp=timestamp.isoformat(),
                    open=round(open_price, 5),
                    high=round(high, 5),
                    low=round(low, 5),
                    close=round(close, 5),
                    volume=np.random.randint(100, 1000)
                )
                candles.append(candle)
            
            # Сохраняем последнюю цену
            if candles:
                self.current_prices[symbol] = candles[-1].close
            
            return candles
            
        except Exception as e:
            print(f"❌ Ошибка получения свечей {symbol}: {e}")
            return []
    
    def calculate_sma(self, prices: List[float], period: int) -> float:
        """Расчет SMA"""
        if len(prices) < period:
            return prices[-1] if prices else 0.0
        return sum(prices[-period:]) / period
    
    def calculate_ema(self, prices: List[float], period: int) -> float:
        """Расчет EMA"""
        if len(prices) < period:
            return prices[-1] if prices else 0.0
        
        multiplier = 2 / (period + 1)
        ema = sum(prices[:period]) / period
        
        for price in prices[period:]:
            ema = (price - ema) * multiplier + ema
        
        return ema
    
    def calculate_rsi(self, prices: List[float], period: int = 14) -> float:
        """Расчет RSI"""
        if len(prices) < period + 1:
            return 50.0
        
        gains = []
        losses = []
        
        for i in range(len(prices) - period, len(prices)):
            change = prices[i] - prices[i-1]
            if change > 0:
                gains.append(change)
                losses.append(0)
            else:
                gains.append(0)
                losses.append(-change)
        
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))
    
    def calculate_macd(
        self, 
        prices: List[float],
        fast: int = 12,
        slow: int = 26,
        signal: int = 9
    ) -> Dict[str, Any]:
        """Расчет MACD"""
        if len(prices) < slow:
            return {
                'macdLine': 0.0,
                'signalLine': 0.0,
                'histogram': 0.0,
                'signal': 'neutral'
            }
        
        ema_fast = self.calculate_ema(prices, fast)
        ema_slow = self.calculate_ema(prices, slow)
        macd_line = ema_fast - ema_slow
        
        # Расчет signal line
        macd_values = []
        for i in range(slow, len(prices) + 1):
            fast_ema = self.calculate_ema(prices[:i], fast)
            slow_ema = self.calculate_ema(prices[:i], slow)
            macd_values.append(fast_ema - slow_ema)
        
        signal_line = self.calculate_ema(macd_values, signal) if len(macd_values) >= signal else 0.0
        histogram = macd_line - signal_line
        
        # Определение направления
        if histogram > 0 and macd_line > signal_line:
            signal_dir = 'bullish'
        elif histogram < 0 and macd_line < signal_line:
            signal_dir = 'bearish'
        else:
            signal_dir = 'neutral'
        
        return {
            'macdLine': macd_line,
            'signalLine': signal_line,
            'histogram': histogram,
            'signal': signal_dir
        }
    
    def calculate_bollinger_bands(
        self, 
        prices: List[float], 
        period: int = 20,
        std_dev: float = 2.0
    ) -> Dict[str, float]:
        """Расчет полос Боллинджера"""
        if len(prices) < period:
            return {'upper': 0.0, 'middle': 0.0, 'lower': 0.0}
        
        slice_prices = prices[-period:]
        middle = sum(slice_prices) / period
        
        variance = sum((p - middle) ** 2 for p in slice_prices) / period
        std = variance ** 0.5
        
        return {
            'upper': middle + (std_dev * std),
            'middle': middle,
            'lower': middle - (std_dev * std)
        }
    
    def calculate_atr(
        self,
        highs: List[float],
        lows: List[float],
        closes: List[float],
        period: int = 14
    ) -> float:
        """Расчет ATR (Average True Range)"""
        if len(highs) < period + 1:
            return 0.0
        
        tr_values = []
        for i in range(len(highs) - period, len(highs)):
            high_low = highs[i] - lows[i]
            high_prev_close = abs(highs[i] - closes[i-1])
            low_prev_close = abs(lows[i] - closes[i-1])
            true_range = max(high_low, high_prev_close, low_prev_close)
            tr_values.append(true_range)
        
        return sum(tr_values) / period
    
    def calculate_volatility(self, prices: List[float], period: int = 20) -> float:
        """Расчет волатильности"""
        if len(prices) < period:
            return 0.0
        
        slice_prices = prices[-period:]
        returns = [
            (slice_prices[i] - slice_prices[i-1]) / slice_prices[i-1]
            for i in range(1, len(slice_prices))
        ]
        
        mean_return = sum(returns) / len(returns)
        variance = sum((r - mean_return) ** 2 for r in returns) / len(returns)
        
        return (variance ** 0.5) * (365 ** 0.5)
    
    def determine_trend(self, prices: List[float], period: int = 20) -> str:
        """Определение тренда"""
        if len(prices) < period:
            return 'neutral'
        
        sma = self.calculate_sma(prices, period)
        current_price = prices[-1]
        price_change = ((current_price - sma) / sma) * 100 if sma > 0 else 0
        
        if price_change > 1:
            return 'bullish'
        elif price_change < -1:
            return 'bearish'
        return 'neutral'
    
    def get_rsi_signal(self, rsi: float) -> str:
        """Определение сигнала RSI"""
        if rsi > 70:
            return 'overbought'
        elif rsi < 30:
            return 'oversold'
        elif rsi > 55:
            return 'bullish'
        elif rsi < 45:
            return 'bearish'
        return 'neutral'
    
    def get_bb_position(self, price: float, bb: Dict[str, float]) -> str:
        """Определение позиции цены относительно полос Боллинджера"""
        if price > bb['upper']:
            return 'above_upper'
        elif price < bb['lower']:
            return 'below_lower'
        elif price > bb['middle']:
            return 'above_middle'
        return 'below_middle'
    
    def identify_candle_pattern(self, candle: Candle) -> str:
        """Определение свечного паттерна"""
        body = abs(candle.close - candle.open)
        wick = candle.high - max(candle.open, candle.close)
        tail = min(candle.open, candle.close) - candle.low
        candle_range = candle.high - candle.low
        
        if candle_range == 0:
            return 'doji'
        if body < candle_range * 0.1:
            return 'doji'
        if candle.close > candle.open and wick > body * 2:
            return 'hammer'
        if candle.close < candle.open and tail > body * 2:
            return 'shooting_star'
        if candle.close > candle.open and body > candle_range * 0.7:
            return 'strong_bull'
        if candle.close < candle.open and body > candle_range * 0.7:
            return 'strong_bear'
        return 'normal'
    
    def calculate_indicators(
        self, 
        candles: List[Candle],
        current_price: Optional[float] = None
    ) -> Indicators:
        """Расчет всех индикаторов"""
        if not candles or len(candles) < 30:
            return self.get_default_indicators(current_price)
        
        prices = [c.close for c in candles]
        highs = [c.high for c in candles]
        lows = [c.low for c in candles]
        volumes = [c.volume for c in candles]
        
        # Текущая и предыдущая цена
        price = current_price or candles[-1].close
        prev_price = candles[-2].close if len(candles) > 1 else price
        
        # Индикаторы
        rsi = self.calculate_rsi(prices, 14)
        macd = self.calculate_macd(prices)
        bb = self.calculate_bollinger_bands(prices, 20)
        atr = self.calculate_atr(highs, lows, prices, 14)
        
        sma20 = self.calculate_sma(prices, 20)
        sma50 = self.calculate_sma(prices, 50)
        
        volume = candles[-1].volume if candles else 0
        avg_volume = sum(volumes[-10:]) / min(10, len(volumes))
        
        trend = self.determine_trend(prices, 20)
        volatility = self.calculate_volatility(prices, 20)
        
        # Поддержка и сопротивление
        last_20_prices = prices[-20:]
        support = min(last_20_prices)
        resistance = max(last_20_prices)
        
        # Свечной паттерн
        candle_pattern = self.identify_candle_pattern(candles[-1])
        
        return Indicators(
            current_price=price,
            prev_price=prev_price,
            price_change=((price - prev_price) / prev_price * 100) if prev_price > 0 else 0,
            
            rsi=round(rsi, 2),
            rsi_signal=self.get_rsi_signal(rsi),
            
            macd_line=round(macd['macdLine'], 5),
            macd_signal=round(macd['signalLine'], 5),
            macd_histogram=round(macd['histogram'], 5),
            macd_signal_direction=macd['signal'],
            
            bb_upper=round(bb['upper'], 5),
            bb_middle=round(bb['middle'], 5),
            bb_lower=round(bb['lower'], 5),
            bb_position=self.get_bb_position(price, bb),
            bb_width=round((bb['upper'] - bb['lower']) / bb['middle'] * 100, 2) if bb['middle'] > 0 else 0,
            
            sma20=round(sma20, 5),
            sma50=round(sma50, 5),
            price_above_sma20=1 if price > sma20 else 0,
            price_above_sma50=1 if price > sma50 else 0,
            sma20_above_sma50=1 if sma20 > sma50 else 0,
            
            atr=round(atr, 5),
            volatility=round(volatility, 4),
            
            volume=volume,
            avg_volume=round(avg_volume, 2),
            volume_ratio=round(volume / avg_volume, 2) if avg_volume > 0 else 1.0,
            
            trend=trend,
            trend_strength=round(abs(price - sma20) / atr, 2) if atr > 0 else 0,
            
            support=round(support, 5),
            resistance=round(resistance, 5),
            
            candle_pattern=candle_pattern,
            candle_size=round((candles[-1].high - candles[-1].low) / price * 100, 3) if price > 0 else 0,
            
            has_enough_data=len(candles) >= 200
        )
    
    def get_default_indicators(self, current_price: Optional[float] = None) -> Indicators:
        """Индикаторы по умолчанию"""
        return Indicators(
            current_price=current_price or 0.0,
            rsi=50.0,
            rsi_signal='neutral',
            macd_line=0.0,
            macd_signal=0.0,
            macd_histogram=0.0,
            macd_signal_direction='neutral',
            bb_upper=0.0,
            bb_middle=0.0,
            bb_lower=0.0,
            bb_position='middle',
            bb_width=0.0,
            sma20=0.0,
            sma50=0.0,
            price_above_sma20=0,
            price_above_sma50=0,
            sma20_above_sma50=0,
            atr=0.0,
            volatility=0.0,
            volume=0.0,
            avg_volume=0.0,
            volume_ratio=1.0,
            trend='neutral',
            trend_strength=0.0,
            support=0.0,
            resistance=0.0,
            candle_pattern='unknown',
            candle_size=0.0,
            has_enough_data=False
        )
    
    async def get_current_data(
        self,
        market: str = 'demo',
        timeframe: str = '1'
    ) -> List[MarketPair]:
        """
        Получение данных по всем валютным парам
        """
        await self.init()
        
        symbols = self.SYMBOLS.get(market, self.SYMBOLS['demo'])
        all_data = []
        
        print(f"\n📊 ========== АНАЛИЗ РЫНКА ==========")
        print(f"📈 Таймфрейм: {timeframe}м")
        print(f"🎯 Всего пар: {len(symbols)}")
        print(f"=====================================\n")
        
        for pair in symbols:
            try:
                print(f"🔍 Анализ: {pair['name']}")
                
                # Получаем свечи
                candles = await self.get_candles(pair['symbol'], timeframe, 500)
                
                if not candles or len(candles) < 50:
                    print(f"   ⚠️ Недостаточно свечей ({len(candles)}/50)")
                    continue
                
                # Получаем текущую цену
                current_price = self.current_prices.get(pair['symbol']) or candles[-1].close
                
                # Рассчитываем индикаторы
                indicators = self.calculate_indicators(candles, current_price)
                
                # Предыдущая цена
                prev_price = candles[-2].close if len(candles) > 1 else current_price
                price_change = ((current_price - prev_price) / prev_price * 100) if prev_price > 0 else 0
                
                market_pair = MarketPair(
                    symbol=pair['symbol'],
                    name=pair['name'],
                    current_price=current_price,
                    price_change=f"{price_change:.3f}%",
                    change_direction='up' if price_change >= 0 else 'down',
                    candles=candles,
                    indicators=indicators,
                    timestamp=datetime.utcnow().isoformat(),
                    timeframe=f"{timeframe}m",
                    volume=candles[-1].volume,
                    analysis_time=datetime.utcnow().strftime('%H:%M:%S'),
                    candles_count=len(candles),
                    has_enough_data=len(candles) >= 200,
                    price_source='live'
                )
                
                all_data.append(market_pair)
                
                print(f"   ✅ {pair['name']} | Цена: {current_price:.5f} | "
                      f"RSI: {indicators.rsi:.1f} | Тренд: {indicators.trend}")
                print(f"   ----------------------------------------")
                
                # Небольшая задержка между запросами
                await asyncio.sleep(0.25)
                
            except Exception as e:
                print(f"   ❌ Ошибка {pair['symbol']}: {e}")
                continue
        
        if not all_data:
            raise Exception("Не удалось получить данные")
        
        print(f"\n====================================")
        print(f"🎯 Анализ завершен: {len(all_data)} пар")
        print(f"📈 Проанализированы: {', '.join(d.name for d in all_data)}")
        print(f"====================================\n")
        
        return all_data
    
    def market_pair_to_dict(self, pair: MarketPair) -> Dict:
        """Конвертация MarketPair в dict для JSON"""
        return {
            'symbol': pair.symbol,
            'name': pair.name,
            'current_price': pair.current_price,
            'price_change': pair.price_change,
            'change_direction': pair.change_direction,
            'candles': [asdict(c) for c in pair.candles[-100:]],  # Последние 100 свечей
            'indicators': asdict(pair.indicators) if pair.indicators else None,
            'timestamp': pair.timestamp,
            'timeframe': pair.timeframe,
            'volume': pair.volume,
            'analysis_time': pair.analysis_time,
            'candles_count': pair.candles_count,
            'has_enough_data': pair.has_enough_data,
            'price_source': pair.price_source
        }


# Пример использования
async def main():
    collector = TradingViewCollector()
    
    try:
        # Получение данных
        data = await collector.get_current_data('demo', '1')
        
        print(f"\n📊 Получено {len(data)} валютных пар")
        
        # Пример первой пары
        if data:
            first_pair = data[0]
            print(f"\n💡 Пример данных для {first_pair.name}:")
            print(f"   Цена: {first_pair.current_price}")
            print(f"   RSI: {first_pair.indicators.rsi}")
            print(f"   MACD: {first_pair.indicators.macd_signal_direction}")
            print(f"   Тренд: {first_pair.indicators.trend}")
            print(f"   Свечей: {first_pair.candles_count}")
        
    finally:
        await collector.close()


if __name__ == '__main__':
    asyncio.run(main())
