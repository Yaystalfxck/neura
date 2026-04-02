from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from app.database import get_db
from app.otc_models import OTCSignal, MarketAnalysis, SignalPattern
from app.otc_analyzer import get_analyzer, OTCSignalAnalyzer
from app.dependencies import get_current_user
from app.models import User
from datetime import datetime, timedelta
import json

router = APIRouter(prefix="/api/otc", tags=["OTC Signals"])


@router.post("/analyze", response_model=dict)
async def analyze_otc_asset(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Анализ OTC актива и генерация сигнала
    """
    symbol = data.get("symbol", "UNKNOWN")
    prices = data.get("prices", [])  # [{timestamp, price}, ...]
    timeframe = data.get("timeframe", "1m")
    
    if not prices or len(prices) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недостаточно данных для анализа (минимум 50 свечей)"
        )
    
    # Получаем анализатор
    analyzer = get_analyzer()
    
    # Анализируем актив
    analysis_result = analyzer.analyze_otc_asset(prices, symbol)
    
    if "error" in analysis_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=analysis_result["error"]
        )
    
    # Сохраняем анализ рынка
    current_price = analysis_result.get("current_price", 0)
    
    market_analysis = MarketAnalysis(
        symbol=symbol,
        timeframe=timeframe,
        current_price=current_price,
        price_change=analysis_result.get("price_change", 0),
        price_change_percent=analysis_result.get("price_change_percent", 0),
        rsi_14=analysis_result.get("signal", {}).get("indicators", {}).get("rsi", 0),
        candles_data=json.dumps(prices[-100:]),  # Последние 100 свечей
    )
    
    db.add(market_analysis)
    
    # Если есть сигнал - сохраняем
    signal_data = analysis_result.get("signal")
    if signal_data:
        otc_signal = OTCSignal(
            symbol=symbol,
            signal_type=signal_data.get("signal_type"),
            strength=signal_data.get("strength"),
            confidence=signal_data.get("confidence"),
            current_price=current_price,
            rsi=signal_data.get("indicators", {}).get("rsi"),
            macd=signal_data.get("indicators", {}).get("macd"),
            macd_signal=signal_data.get("indicators", {}).get("macd_signal"),
            bollinger_upper=signal_data.get("indicators", {}).get("bollinger_upper"),
            bollinger_middle=signal_data.get("indicators", {}).get("bollinger_middle"),
            bollinger_lower=signal_data.get("indicators", {}).get("bollinger_lower"),
            trend_short=signal_data.get("trend", {}).get("direction"),
            pattern_detected=signal_data.get("pattern", {}).get("type") if signal_data.get("pattern") else None,
            price_history=json.dumps(prices[-100:]),
            expires_at=datetime.utcnow() + timedelta(minutes=15),
        )
        db.add(otc_signal)
    
    await db.commit()
    
    return {
        "success": True,
        "analysis": analysis_result,
        "message": "Анализ завершен"
    }


@router.get("/signals", response_model=dict)
async def get_otc_signals(
    symbol: Optional[str] = None,
    status: Optional[str] = "active",
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение списка OTC сигналов
    """
    query = select(OTCSignal)
    
    if symbol:
        query = query.where(OTCSignal.symbol == symbol)
    
    if status:
        query = query.where(OTCSignal.status == status)
    
    query = query.order_by(desc(OTCSignal.created_at)).limit(limit)
    
    result = await db.execute(query)
    signals = result.scalars().all()
    
    signals_list = [
        {
            "id": s.id,
            "symbol": s.symbol,
            "signal_type": s.signal_type,
            "strength": s.strength,
            "confidence": s.confidence,
            "current_price": s.current_price,
            "rsi": s.rsi,
            "macd": s.macd,
            "trend_short": s.trend_short,
            "pattern_detected": s.pattern_detected,
            "status": s.status,
            "result": s.result,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        }
        for s in signals
    ]
    
    return {
        "success": True,
        "signals": signals_list,
        "total": len(signals_list),
    }


@router.get("/signals/{signal_id}", response_model=dict)
async def get_otc_signal(
    signal_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение конкретного сигнала
    """
    result = await db.execute(
        select(OTCSignal).where(OTCSignal.id == signal_id)
    )
    signal = result.scalar_one_or_none()
    
    if not signal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сигнал не найден"
        )
    
    return {
        "success": True,
        "signal": {
            "id": signal.id,
            "symbol": signal.symbol,
            "signal_type": signal.signal_type,
            "strength": signal.strength,
            "confidence": signal.confidence,
            "current_price": signal.current_price,
            "entry_price": signal.entry_price,
            "target_price": signal.target_price,
            "stop_loss": signal.stop_loss,
            "rsi": signal.rsi,
            "macd": signal.macd,
            "bollinger_upper": signal.bollinger_upper,
            "bollinger_middle": signal.bollinger_middle,
            "bollinger_lower": signal.bollinger_lower,
            "trend_short": signal.trend_short,
            "trend_medium": signal.trend_medium,
            "trend_long": signal.trend_long,
            "pattern_detected": signal.pattern_detected,
            "notes": signal.notes,
            "status": signal.status,
            "result": signal.result,
            "timeframe": signal.timeframe,
            "expiration_minutes": signal.expiration_minutes,
            "created_at": signal.created_at.isoformat() if signal.created_at else None,
            "expires_at": signal.expires_at.isoformat() if signal.expires_at else None,
        }
    }


@router.put("/signals/{signal_id}/result", response_model=dict)
async def update_signal_result(
    signal_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Обновление результата сигнала (win/loss)
    """
    result = await db.execute(
        select(OTCSignal).where(OTCSignal.id == signal_id)
    )
    signal = result.scalar_one_or_none()
    
    if not signal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сигнал не найден"
        )
    
    signal.result = data.get("result", signal.result)  # win, loss, draw
    signal.status = "completed"
    
    await db.commit()
    
    return {
        "success": True,
        "message": f"Результат сигнала обновлен на {signal.result}",
    }


@router.get("/market/{symbol}/analysis", response_model=dict)
async def get_market_analysis(
    symbol: str,
    timeframe: str = "1m",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение последнего анализа рынка для актива
    """
    result = await db.execute(
        select(MarketAnalysis)
        .where(MarketAnalysis.symbol == symbol)
        .where(MarketAnalysis.timeframe == timeframe)
        .order_by(desc(MarketAnalysis.analyzed_at))
        .limit(1)
    )
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        return {
            "success": True,
            "analysis": None,
            "message": "Анализ еще не проводился"
        }
    
    return {
        "success": True,
        "analysis": {
            "id": analysis.id,
            "symbol": analysis.symbol,
            "timeframe": analysis.timeframe,
            "current_price": analysis.current_price,
            "price_change": analysis.price_change,
            "price_change_percent": analysis.price_change_percent,
            "rsi_14": analysis.rsi_14,
            "rsi_signal": analysis.rsi_signal,
            "macd_value": analysis.macd_value,
            "macd_signal_value": analysis.macd_signal_value,
            "macd_histogram": analysis.macd_histogram,
            "macd_trend": analysis.macd_trend,
            "bb_upper": analysis.bb_upper,
            "bb_middle": analysis.bb_middle,
            "bb_lower": analysis.bb_lower,
            "bb_width": analysis.bb_width,
            "bb_position": analysis.bb_position,
            "sma_20": analysis.sma_20,
            "sma_50": analysis.sma_50,
            "sma_200": analysis.sma_200,
            "trend_direction": analysis.trend_direction,
            "trend_strength": analysis.trend_strength,
            "support_level": analysis.support_level,
            "resistance_level": analysis.resistance_level,
            "volatility": analysis.volatility,
            "analyzed_at": analysis.analyzed_at.isoformat() if analysis.analyzed_at else None,
        }
    }


@router.get("/statistics", response_model=dict)
async def get_signals_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Статистика сигналов
    """
    # Всего сигналов
    result = await db.execute(
        select(func.count(OTCSignal.id))
    )
    total_signals = result.scalar() or 0
    
    # Завершенные сигналы
    result = await db.execute(
        select(func.count(OTCSignal.id))
        .where(OTCSignal.status == "completed")
    )
    completed_signals = result.scalar() or 0
    
    # Выигрышные
    result = await db.execute(
        select(func.count(OTCSignal.id))
        .where(OTCSignal.result == "win")
    )
    win_signals = result.scalar() or 0
    
    # Проигрышные
    result = await db.execute(
        select(func.count(OTCSignal.id))
        .where(OTCSignal.result == "loss")
    )
    loss_signals = result.scalar() or 0
    
    # Активные
    result = await db.execute(
        select(func.count(OTCSignal.id))
        .where(OTCSignal.status == "active")
    )
    active_signals = result.scalar() or 0
    
    # Процент успеха
    win_rate = 0.0
    if completed_signals > 0:
        win_rate = (win_signals / completed_signals) * 100
    
    return {
        "success": True,
        "statistics": {
            "total_signals": total_signals,
            "completed_signals": completed_signals,
            "active_signals": active_signals,
            "win_signals": win_signals,
            "loss_signals": loss_signals,
            "win_rate": round(win_rate, 2),
        }
    }
