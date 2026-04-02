from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.tradingview_collector import TradingViewCollector
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/market", tags=["Market Data"])


@router.get("/data", response_model=dict)
async def get_market_data(
    market: str = 'demo',
    timeframe: str = '1',
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение данных рынка с TradingView
    market: 'otc', 'market', 'demo'
    timeframe: '1', '5', '15', '60' (минуты)
    """
    try:
        collector = TradingViewCollector()
        
        # Получаем данные
        data = await collector.get_current_data(market, timeframe)
        
        # Конвертируем в dict
        result = [collector.market_pair_to_dict(pair) for pair in data]
        
        # Очищаем свечи (они слишком большие для ответа)
        for pair in result:
            pair['candles'] = pair['candles'][-10:]  # Только последние 10 свечей
        
        return {
            "success": True,
            "data": result,
            "count": len(result),
            "market": market,
            "timeframe": timeframe,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/indicators/{symbol}", response_model=dict)
async def get_indicators(
    symbol: str,
    timeframe: str = '1',
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение индикаторов для конкретной валютной пары
    """
    try:
        collector = TradingViewCollector()
        await collector.init()
        
        # Получаем свечи
        candles = await collector.get_candles(symbol, timeframe, 500)
        
        if not candles or len(candles) < 50:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Недостаточно данных для анализа"
            )
        
        # Рассчитываем индикаторы
        indicators = collector.calculate_indicators(candles)
        
        return {
            "success": True,
            "symbol": symbol,
            "timeframe": timeframe,
            "indicators": {
                "current_price": indicators.current_price,
                "rsi": indicators.rsi,
                "rsi_signal": indicators.rsi_signal,
                "macd_line": indicators.macd_line,
                "macd_signal": indicators.macd_signal,
                "macd_histogram": indicators.macd_histogram,
                "macd_signal_direction": indicators.macd_signal_direction,
                "bb_upper": indicators.bb_upper,
                "bb_middle": indicators.bb_middle,
                "bb_lower": indicators.bb_lower,
                "bb_position": indicators.bb_position,
                "sma20": indicators.sma20,
                "sma50": indicators.sma50,
                "trend": indicators.trend,
                "trend_strength": indicators.trend_strength,
                "volatility": indicators.volatility,
                "support": indicators.support,
                "resistance": indicators.resistance,
                "candle_pattern": indicators.candle_pattern,
            },
            "candles_count": len(candles),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/analyze", response_model=dict)
async def analyze_market(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Анализ рынка и генерация сигнала
    data: {
        "symbol": "FX:EURUSD",
        "timeframe": "1",
        "market": "demo"
    }
    """
    try:
        symbol = data.get("symbol", "FX:EURUSD")
        timeframe = data.get("timeframe", "1")
        market = data.get("market", "demo")
        
        collector = TradingViewCollector()
        await collector.init()
        
        # Получаем свечи
        candles = await collector.get_candles(symbol, timeframe, 500)
        
        if not candles or len(candles) < 50:
            return {
                "success": False,
                "error": "Недостаточно данных для анализа",
                "signal": None
            }
        
        # Рассчитываем индикаторы
        indicators = collector.calculate_indicators(candles)
        
        # Генерируем сигнал на основе индикаторов
        signal = generate_signal_from_indicators(indicators, symbol)
        
        return {
            "success": True,
            "symbol": symbol,
            "timeframe": timeframe,
            "indicators": {
                "rsi": indicators.rsi,
                "rsi_signal": indicators.rsi_signal,
                "macd_direction": indicators.macd_signal_direction,
                "trend": indicators.trend,
                "bb_position": indicators.bb_position,
            },
            "signal": signal,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def generate_signal_from_indicators(indicators, symbol: str) -> Optional[dict]:
    """
    Генерация сигнала на основе индикаторов
    """
    confidence = 50
    signals = []
    
    # RSI анализ
    if indicators.rsi_signal == 'oversold':
        confidence += 15
        signals.append("RSI перепродан")
    elif indicators.rsi_signal == 'overbought':
        confidence -= 15
        signals.append("RSI перекуплен")
    
    # MACD анализ
    if indicators.macd_signal_direction == 'bullish':
        confidence += 15
        signals.append("MACD бычий")
    elif indicators.macd_signal_direction == 'bearish':
        confidence -= 15
        signals.append("MACD медвежий")
    
    # Тренд анализ
    if indicators.trend == 'bullish':
        confidence += 10
        signals.append("Восходящий тренд")
    elif indicators.trend == 'bearish':
        confidence -= 10
        signals.append("Нисходящий тренд")
    
    # Bollinger Bands
    if indicators.bb_position == 'below_lower':
        confidence += 10
        signals.append("Цена у нижней полосы BB")
    elif indicators.bb_position == 'above_upper':
        confidence -= 10
        signals.append("Цена у верхней полосы BB")
    
    # Определяем направление сигнала
    signal_type = None
    if confidence >= 70:
        signal_type = 'CALL'
    elif confidence <= 30:
        signal_type = 'PUT'
    
    if not signal_type:
        return None
    
    # Определяем силу сигнала
    if confidence >= 80:
        strength = 'strong'
    elif confidence >= 65:
        strength = 'medium'
    else:
        strength = 'weak'
    
    # Экспирация (1-5 минут)
    expiry = 3
    if indicators.volatility > 0.02:
        expiry = 1
    elif indicators.volatility > 0.015:
        expiry = 2
    elif indicators.volatility > 0.01:
        expiry = 3
    elif indicators.volatility > 0.007:
        expiry = 4
    else:
        expiry = 5
    
    from datetime import timedelta
    now = datetime.utcnow()
    expiry_time = now + timedelta(minutes=expiry)
    valid_until = now + timedelta(seconds=30)
    
    return {
        "symbol": symbol,
        "direction": signal_type,
        "strength": strength,
        "confidence": min(95, confidence),
        "expiry_minutes": expiry,
        "expiry_time": expiry_time.strftime('%H:%M'),
        "valid_until": valid_until.strftime('%H:%M:%S'),
        "entry_price": indicators.current_price,
        "reasoning": ", ".join(signals),
        "indicators": {
            "rsi": indicators.rsi,
            "macd": indicators.macd_signal_direction,
            "trend": indicators.trend,
            "volatility": indicators.volatility
        }
    }
