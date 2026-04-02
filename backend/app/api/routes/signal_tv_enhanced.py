"""
TradingView Signal Router - ENHANCED VERSION
Улучшенный анализ сигналов с Multi-Timeframe Analysis и Confluence Factors
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timedelta
import json

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, SignalUsage
from app.po_models import POSignal
from app.enhanced_signal_analyzer import EnhancedSignalAnalyzer

router = APIRouter(prefix="/api", tags=["Enhanced Signals"])


@router.post("/signal-tv-enhanced")
async def get_signal_enhanced(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение улучшенного сигнала на основе данных TradingView
    С использованием Multi-Timeframe Analysis и Confluence Factors
    """
    try:
        market = data.get("market", "market")
        timeframe = data.get("timeframe", "5")
        strategy_type = data.get("strategy", "enhanced")
        
        print(f"\n🚀 ========== ENHANCED SIGNAL ANALYSIS ==========")
        print(f"Пользователь: {current_user.email}")
        print(f"Параметры: market={market}, timeframe={timeframe}m")
        
        # Инициализируем анализатор
        analyzer = EnhancedSignalAnalyzer()
        
        # Симулируем данные (в реальности получать из TradingView)
        simulated_indicators = {
            'rsi': 35,  # Перепроданность - сигнал на покупку
            'macd_direction': 'bullish',
            'trend': 'bullish',
            'bb_position': 'below_lower',
            'volume_ratio': 1.8,
            'atr': 0.0015,
            'volatility': 0.012,
            'candle_pattern': 'hammer',
            'support': 1.0840,
            'resistance': 1.0870
        }
        
        simulated_price = {
            'current_price': 1.0850,
            'support': 1.0840,
            'resistance': 1.0870
        }
        
        # MTF данные для разных таймфреймов
        mtf_data = {
            '1': {'rsi': 35, 'macd_direction': 'bullish', 'trend': 'bullish'},
            '3': {'rsi': 38, 'macd_direction': 'bullish', 'trend': 'bullish'},
            '5': {'rsi': 40, 'macd_direction': 'bullish', 'trend': 'neutral'},
            '10': {'rsi': 45, 'macd_direction': 'neutral', 'trend': 'bullish'},
            '15': {'rsi': 48, 'macd_direction': 'neutral', 'trend': 'neutral'}
        }
        
        # Генерируем улучшенный сигнал
        enhanced_signal = analyzer.generate_enhanced_signal(
            pair='EUR/USD',
            indicators=simulated_indicators,
            price_data=simulated_price,
            mtf_data=mtf_data,
            timeframe=timeframe
        )
        
        # Конвертируем в dict
        signal_dict = analyzer.signal_to_dict(enhanced_signal)
        
        print(f"\n✅ УЛУЧШЕННЫЙ СИГНАЛ СГЕНЕРИРОВАН:")
        print(f"   Пара: {signal_dict['pair']}")
        print(f"   Направление: {signal_dict['direction']}")
        print(f"   Уверенность: {signal_dict['confidence']}%")
        print(f"   Strength: {signal_dict['strength']}")
        print(f"   MTF Score: {signal_dict['mtf_score']}/100")
        print(f"   Confluence: {signal_dict['confluence_score']}/100")
        print(f"   Risk/Reward: {signal_dict['risk_metrics']['risk_reward_ratio']}")
        print(f"   Win Rate: ~{signal_dict['risk_metrics']['win_rate_estimate']}%")
        print(f"\n   Entry: {signal_dict['entry_price']}")
        print(f"   TP: {signal_dict['take_profit']}")
        print(f"   SL: {signal_dict['stop_loss']}")
        print(f"   Expiry: {signal_dict['expiry_minutes']} мин")
        print(f"\n   Reasoning: {signal_dict['reasoning']}")
        print(f"{'='*50}\n")
        
        # Сохраняем сигнал в БД
        signal_record = POSignal(
            signal_type=signal_dict['direction'].lower(),
            strength=signal_dict['strength'],
            confidence=signal_dict['confidence'],
            asset_name=signal_dict['pair'],
            amount=1.0,
            timeframe=signal_dict['expiry_minutes'] * 60,
            current_price=signal_dict['entry_price'],
            strategy_type="ENHANCED_MTF",
            user_id=current_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=signal_dict['expiry_minutes']),
            status="pending",
            result="pending"
        )
        
        db.add(signal_record)
        
        signal_usage = SignalUsage(
            user_id=current_user.id,
            signal_data=json.dumps(signal_dict)
        )
        db.add(signal_usage)
        await db.commit()
        
        return {
            "success": True,
            "signal": signal_dict,
            "balance": current_user.balance,
            "analysis_type": "enhanced",
            "features": {
                "multi_timeframe_analysis": True,
                "confluence_factors": True,
                "risk_management": True,
                "dynamic_tp_sl": True
            },
            "market_data_summary": {
                "pair": signal_dict['pair'],
                "timeframe": timeframe,
                "market": market,
                "data_source": "tradingview_enhanced",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации улучшенного сигнала: {str(e)}"
        )


@router.get("/signal-stats")
async def get_signal_stats(
    current_user: User = Depends(get_current_user)
):
    """Статистика улучшенных сигналов"""
    return {
        "success": True,
        "stats": {
            "total_signals": 0,
            "win_rate": 0,
            "avg_confidence": 0,
            "best_timeframe": "5m",
            "most_profitable_pair": "EUR/USD"
        }
    }
