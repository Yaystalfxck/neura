"""
TradingView Signal Router
Использует TradingView для обычных валютных пар (не OTC)
Данные получаются через HTTP запрос к frontend API
ENHANCED: С улучшенным анализом сигналов
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime, timedelta
import json
import aiohttp
import asyncio

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, SignalUsage, PocketOptionUser
from app.balance_utils import get_user_balance
from app.ml_signal_generator import get_ml_generator
from app.po_models import POSignal
from app.enhanced_signal_analyzer import EnhancedSignalAnalyzer

router = APIRouter(prefix="/api", tags=["Signals"])


def get_next_limit_balance(current_balance: float) -> float:
    """Возвращает необходимый баланс для следующего лимита сигналов"""
    if current_balance >= 200:
        return 200  # Максимум достигнут
    elif current_balance >= 100:
        return 200
    elif current_balance >= 50:
        return 100
    elif current_balance >= 25:
        return 50
    else:
        return 25


async def get_tradingview_data(market: str = "market", timeframe: str = "5"):
    """
    Получение данных из TradingView через frontend API
    """
    try:
        print(f"\n📊 Запрос данных TradingView ({market}, {timeframe}m)...")
        
        # Отправляем запрос на frontend API
        # host.docker.internal - это хост машина из Docker контейнера
        frontend_url = "http://host.docker.internal:3000/api/tradingview-data"
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                frontend_url,
                json={"market": market, "timeframe": timeframe},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    data = result.get('data', [])
                    print(f"✅ Получено данных TradingView: {len(data)} пар")
                    return data
                else:
                    print(f"⚠️ TradingView API error: {response.status}")
                    return None
        
    except Exception as e:
        print(f"❌ Ошибка получения данных TradingView: {e}")
        # Fallback на демо-данные
        return get_demo_tradingview_data(market, timeframe)


def get_demo_tradingview_data(market: str, timeframe: str):
    """Генерация демо-данных если frontend недоступен"""
    import random
    
    currency_pairs = [
        {"symbol": "FX:EURUSD", "name": "EUR/USD", "base_price": 1.098},
        {"symbol": "FX:GBPUSD", "name": "GBP/USD", "base_price": 1.265},
        {"symbol": "FX:USDJPY", "name": "USD/JPY", "base_price": 148.5},
        {"symbol": "FX:AUDUSD", "name": "AUD/USD", "base_price": 0.748},
        {"symbol": "FX:USDCAD", "name": "USD/CAD", "base_price": 1.352},
    ]
    
    data = []
    for pair in currency_pairs:
        price_change = random.uniform(-0.002, 0.002)
        current_price = pair['base_price'] * (1 + price_change)
        
        data.append({
            "symbol": pair['symbol'],
            "name": pair['name'],
            "current_price": current_price,
            "indicators": {
                "rsi": random.uniform(30, 70),
                "macd_signal_direction": random.choice(['bullish', 'bearish', 'neutral']),
                "trend": random.choice(['bullish', 'bearish', 'neutral']),
                "volatility": random.uniform(0.5, 2.5)
            }
        })
    
    print(f"✅ Сгенерировано демо-данных: {len(data)} пар")
    return data


def analyze_tradingview_signal(tv_data: list, strategy_type: str) -> Optional[dict]:
    """
    Анализ данных TradingView и генерация сигнала
    
    Args:
        tv_data: список данных по валютным парам
        strategy_type: тип стратегии
    """
    if not tv_data or len(tv_data) == 0:
        return None
    
    # Выбираем лучшую пару на основе индикаторов
    best_pair = None
    best_score = 0
    
    for pair_data in tv_data:
        indicators = pair_data.get('indicators', {})
        
        # Расчет качества сигнала (0-100)
        score = 0
        
        # RSI (30 баллов)
        rsi = indicators.get('rsi', 50)
        if 25 <= rsi <= 35 or 65 <= rsi <= 75:
            score += 30  # Хорошая зона
        elif rsi < 25 or rsi > 75:
            score += 20  # Сильная перекупленность/перепроданность
        else:
            score += 10
        
        # MACD (25 баллов)
        macd_direction = indicators.get('macd_signal_direction', 'neutral')
        if macd_direction == 'bullish':
            score += 25
        elif macd_direction == 'bearish':
            score += 15
        else:
            score += 5
        
        # Bollinger Bands (20 баллов)
        bb_position = indicators.get('bb_position', 'middle')
        if bb_position == 'below_lower':
            score += 20  # Потенциальный разворот вверх
        elif bb_position == 'above_upper':
            score += 15  # Потенциальный разворот вниз
        else:
            score += 10
        
        # Trend (15 баллов)
        trend = indicators.get('trend', 'neutral')
        if trend == 'bullish':
            score += 15
        elif trend == 'bearish':
            score += 10
        else:
            score += 5
        
        # Volume (10 баллов)
        volume_ratio = indicators.get('volume_ratio', 1)
        if volume_ratio > 1.5:
            score += 10  # Высокий объем
        elif volume_ratio > 1:
            score += 5
        else:
            score += 3
        
        # Обновляем лучший
        if score > best_score:
            best_score = score
            best_pair = {
                **pair_data,
                'signal_score': score
            }
    
    if not best_pair:
        return None
    
    # Определяем направление сигнала
    indicators = best_pair.get('indicators', {})
    rsi = indicators.get('rsi', 50)
    macd = indicators.get('macd_signal_direction', 'neutral')
    trend = indicators.get('trend', 'neutral')
    
    # Голосование индикаторов
    bullish_votes = 0
    bearish_votes = 0
    
    if rsi < 50:
        bullish_votes += 1
    else:
        bearish_votes += 1
    
    if macd == 'bullish':
        bullish_votes += 1
    elif macd == 'bearish':
        bearish_votes += 1
    
    if trend == 'bullish':
        bullish_votes += 1
    elif trend == 'bearish':
        bearish_votes += 1
    
    # Определяем направление
    if bullish_votes > bearish_votes:
        signal_type = "call"
        direction = "BUY"
    elif bearish_votes > bullish_votes:
        signal_type = "put"
        direction = "SELL"
    else:
        # Ничья - используем RSI
        signal_type = "call" if rsi < 50 else "put"
        direction = "BUY" if rsi < 50 else "SELL"
    
    # Рассчитываем уверенность
    confidence = min(95, 50 + best_score / 3)
    
    # Оптимальная экспирация (3-10 минут, но в основном 5 минут)
    volatility = indicators.get('volatility', 1)
    
    # 70% случаев - 5 минут, 30% - адаптивно от волатильности
    import random
    if random.random() < 0.7:
        optimal_timeframe = 5  # 70% - всегда 5 минут
    elif volatility < 0.5:
        optimal_timeframe = 10  # Низкая волатильность - дольше
    elif volatility > 2:
        optimal_timeframe = 3  # Высокая волатильность - короче
    else:
        optimal_timeframe = 5  # Средняя - 5 минут

    return {
        "signal_type": signal_type,
        "strength": "strong" if confidence > 75 else "medium" if confidence > 60 else "weak",
        "confidence": f"{int(confidence)}%",
        "current_price": float(best_pair.get('current_price', 0)),
        "expiry_minutes": optimal_timeframe,
        "expiry_timestamp": (datetime.utcnow() + timedelta(minutes=optimal_timeframe)).isoformat(),
        "valid_until": (datetime.utcnow() + timedelta(seconds=30)).isoformat(),
        "pair_name": best_pair.get('name', 'Unknown'),
        "trend": trend,
        "rsi": int(rsi),
        "pattern_detected": strategy_type,
        "payout": "N/A",  # Для TradingView payout неизвестен
        "db_strategy": "INDICATORS",
        "data_source": "tradingview",
        "indicators": indicators,
        "signal_score": best_score,
        "bullish_votes": bullish_votes,
        "bearish_votes": bearish_votes
    }


@router.post("/signal-tv", response_model=dict)
async def get_signal_tradingview(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение сигнала на основе данных TradingView
    Для обычных валютных пар (не OTC)
    """
    try:
        market = data.get("market", "market")  # 'market' или 'demo'
        timeframe = data.get("timeframe", "5")
        strategy_type = data.get("strategy", data.get("ai_type", data.get("aiType", "indicators")))
        min_payout = data.get("min_payout", 80)

        print(f"\n📊 ========== ЗАПРОС СИГНАЛА (TradingView) ==========")
        print(f"Пользователь: {current_user.email} (ID: {current_user.id})")
        print(f"Параметры: market={market}, timeframe={timeframe}m, strategy={strategy_type}")

        # 🔴 ПРОВЕРКА ЛИМИТОВ СИГНАЛОВ
        from datetime import datetime as dt_module
        from sqlalchemy import cast, Date

        today = dt_module.utcnow().date()

        # Получаем использование сигналов сегодня (PostgreSQL совместимо)
        result = await db.execute(
            select(func.count(SignalUsage.id))
            .where(SignalUsage.user_id == current_user.id)
            .where(cast(SignalUsage.used_at, Date) == today)
        )
        used_today = result.scalar() or 0

        # Получаем баланс (для flaun.feed@mail.ru - с демо-счёта через WebSocket)
        user_balance = await get_user_balance(current_user, db)
        print(f"💰 Баланс: ${user_balance}")

        # Проверка для админов - безлимитно
        daily_limit = 999  # Для админов
        if current_user.role != 'admin':
            # Определяем лимит по балансу
            if user_balance >= 200:
                daily_limit = 5
            elif user_balance >= 100:
                daily_limit = 4
            elif user_balance >= 50:
                daily_limit = 3
            elif user_balance >= 25:
                daily_limit = 2
            else:
                daily_limit = 1  # Первый сигнал бесплатный
            
            # Проверяем лимит
            if used_today >= daily_limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Лимит сигналов исчерпан. Вы использовали {used_today} из {daily_limit} сигналов сегодня. "
                           f"Для получения {daily_limit + 1} сигналов необходим баланс от ${get_next_limit_balance(user_balance)}."
                )
        
        print(f"✅ Лимиты: {used_today}/{daily_limit if current_user.role != 'admin' else '∞'} использовано")

        # Получаем данные из TradingView
        tv_data = await get_tradingview_data(market=market, timeframe=timeframe)
        
        if not tv_data or len(tv_data) == 0:
            print("⚠️ Не удалось получить данные TradingView, используем демо")
            # Fallback на демо-данные
            return await get_demo_signal(current_user, db, timeframe, strategy_type)

        # Анализируем данные
        signal = None
        
        # Проверяем выбранный тип стратегии
        if strategy_type.lower() in ['ml', 'neural_ai', 'neural']:
            # 🤖 ML стратегия (Random Forest)
            print("\n🤖 ML стратегия: Обучение модели на данных TradingView...")
            ml_generator = get_ml_generator()
            
            # Конвертируем данные TradingView в формат для ML
            ml_candles = []
            for pair in tv_data:
                if hasattr(pair, 'candles') and pair.candles:
                    for c in pair.candles[-200:]:
                        ml_candles.append({
                            'time': c.time if hasattr(c, 'time') else 0,
                            'open': c.open if hasattr(c, 'open') else 0,
                            'close': c.close if hasattr(c, 'close') else 0,
                            'high': c.high if hasattr(c, 'high') else 0,
                            'low': c.low if hasattr(c, 'low') else 0,
                        })
            
            # Обучаем модель
            if ml_generator.train(ml_candles) and len(ml_candles) >= 50:
                print(f"✅ ML модель обучена (точность: {ml_generator.model_accuracy:.2f})")
                
                # Получаем предсказание
                ml_signal = ml_generator.predict(ml_candles)
                
                if ml_signal:
                    print(f"🎯 ML сигнал: {ml_signal['direction'].upper()} (уверенность: {ml_signal['confidence']:.2f})")
                    signal = {
                        'signal_type': ml_signal['direction'],
                        'strength': 'strong' if ml_signal['confidence'] > 0.75 else 'medium',
                        'confidence': f"{ml_signal['confidence']*100:.1f}%",
                        'current_price': float(tv_data[0].current_price if tv_data else 1.0850),
                        'expiry_minutes': 5,  # TradingView сигналы по 5 минут
                        'pair_name': tv_data[0].name if tv_data else 'EUR/USD',
                        'trend': 'bullish' if ml_signal['direction'] == 'call' else 'bearish',
                        'rsi': 50,
                        'db_strategy': 'machine_learning',  # Используем существующее значение enum
                        'ml_accuracy': ml_signal['ml_accuracy'],
                        'data_source': 'tradingview_ml'
                    }
                else:
                    print("⚠️ ML: Низкая уверенность (< 55%), используем индикаторы")
            
            # Если ML не вернул сигнал, используем индикаторы
            if not signal:
                signal = analyze_tradingview_signal(tv_data, strategy_type)
        else:
            # 📊 Обычная стратегия с индикаторами
            signal = analyze_tradingview_signal(tv_data, strategy_type)
        
        if not signal:
            print("⚠️ Не удалось проанализировать данные, используем демо")
            return await get_demo_signal(current_user, db, timeframe, strategy_type)

        print(f"\n✅ СИГНАЛ СГЕНЕРИРОВАН (TradingView):")
        print(f"   Пара: {signal['pair_name']}")
        print(f"   Направление: {signal['signal_type'].upper()}")
        print(f"   Уверенность: {signal['confidence']}")
        print(f"   Экспирация: {signal['expiry_minutes']} мин")
        print(f"   Score: {signal['signal_score']}/100")

        # Сохраняем сигнал в БД
        signal_record = POSignal(
            signal_type=signal.get("signal_type", "call"),
            strength=signal.get("strength", "medium"),
            confidence=float(signal.get("confidence", "50%").replace("%", "")),
            asset_name=signal.get("pair_name", "EUR/USD"),
            amount=1.0,
            timeframe=signal.get("expiry_minutes", 5) * 60,
            current_price=float(signal.get("current_price", "1.0850")),
            strategy_type=signal.get("db_strategy", "INDICATORS"),
            user_id=current_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=signal.get("expiry_minutes", 5)),
            status="pending",
            result="pending"
        )

        db.add(signal_record)

        signal_usage = SignalUsage(
            user_id=current_user.id,
            signal_data=json.dumps(signal)
        )
        db.add(signal_usage)
        await db.commit()

        # Форматируем ответ
        formatted_signal = format_tv_signal_response(signal, current_user.balance)

        return {
            "success": True,
            "signal": formatted_signal,
            "balance": current_user.balance,
            "market_data_summary": {
                "assets_analyzed": len(tv_data),
                "timeframe": timeframe,
                "market": market,
                "strategy": strategy_type,
                "data_source": "tradingview",
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
            detail=f"Ошибка при генерации сигнала: {str(e)}"
        )


async def get_demo_signal(current_user: User, db: AsyncSession, timeframe: str, strategy_type: str):
    """Fallback на демо-данные"""
    import random

    demo_assets = [
        {"name": "EUR/USD", "payout": 92},
        {"name": "GBP/USD", "payout": 88},
        {"name": "USD/JPY", "payout": 92},
    ]

    best_asset = random.choice(demo_assets)
    signal_type = random.choice(["call", "put"])
    confidence = random.randint(70, 90)

    # Экспирация: 70% - 5 минут, 30% - адаптивно (3-10 мин)
    if random.random() < 0.7:
        expiry_minutes = 5
    elif random.random() < 0.5:
        expiry_minutes = 3
    else:
        expiry_minutes = random.choice([7, 8, 10])

    signal = {
        "signal_type": signal_type,
        "strength": "strong" if confidence > 80 else "medium",
        "confidence": f"{confidence}%",
        "current_price": random.uniform(1.08, 1.12),
        "expiry_minutes": expiry_minutes,  # 3-10 мин, но в основном 5 мин
        "pair_name": best_asset['name'],
        "payout": f"{best_asset['payout']}%",
        "db_strategy": "INDICATORS",
        "data_source": "demo"
    }
    
    return {
        "success": True,
        "signal": format_tv_signal_response(signal, current_user.balance),
        "balance": current_user.balance,
        "market_data_summary": {
            "assets_analyzed": len(demo_assets),
            "data_source": "demo"
        }
    }


def format_tv_signal_response(signal: dict, balance: float) -> dict:
    """Форматирование сигнала TradingView для frontend"""
    try:
        direction = "BUY" if signal.get("signal_type") == "call" else "SELL"
        current_price = signal.get("current_price", 1.0850)
        confidence_str = signal.get("confidence", "50%")
        confidence = float(confidence_str.replace("%", "")) if isinstance(confidence_str, str) else confidence_str

        expiry_minutes = signal.get("expiry_minutes", 5)
        expiry_time = datetime.utcnow() + timedelta(minutes=expiry_minutes)
        valid_until = datetime.utcnow() + timedelta(seconds=30)

        signal_strength = "strong" if confidence > 75 else "moderate" if confidence > 65 else "weak"

        # Рассчитываем TP/SL
        volatility = signal.get('indicators', {}).get('volatility', 0.01)
        tp_multiplier = 1 + (volatility * 0.4) if direction == "BUY" else 1 - (volatility * 0.4)
        sl_multiplier = 1 - (volatility * 0.2) if direction == "BUY" else 1 + (volatility * 0.2)

        return {
            "pair": signal.get("pair_name", "EUR/USD"),
            "direction": direction,
            "expiration": f"{expiry_minutes} минут",
            "expiry_minutes": expiry_minutes,
            "expiry_time": expiry_time.strftime("%H:%M"),
            "valid_until": valid_until.strftime("%H:%M:%S"),
            "confidence": f"{int(confidence)}%",
            "entry_price": f"{float(current_price):.5f}",
            "take_profit": f"{float(current_price) * tp_multiplier:.5f}",
            "stop_loss": f"{float(current_price) * sl_multiplier:.5f}",
            "signal_strength": signal_strength,
            "provider": "TradingView" if signal.get("data_source") == "tradingview" else "Demo",
            "payout": signal.get("payout", "N/A"),
            "signal_id": f"tv_{int(datetime.utcnow().timestamp())}",
            "generated_at": datetime.utcnow().isoformat(),
            "reasoning": f"{signal.get('pair_name', 'EUR/USD')}: {direction} ({confidence}%). "
                        f"Экспирация: {expiry_minutes} мин. "
                        f"Score: {signal.get('signal_score', 0)}/100",
            "market_data": {
                "current_price": f"{float(current_price):.5f}",
                "trend": signal.get("trend", "neutral"),
                "support": f"{float(current_price) * 0.995:.5f}",
                "resistance": f"{float(current_price) * 1.005:.5f}",
                "signal_strength": signal_strength,
                "confidence": f"{int(confidence)}%",
                "rsi": signal.get("rsi", 50),
                "macd": signal.get('indicators', {}).get('macd_signal_direction', 'neutral'),
                "payout": signal.get("payout", "N/A"),
                "data_source": signal.get("data_source", "demo")
            }
        }

    except Exception as e:
        print(f"❌ Ошибка форматирования сигнала: {e}")
        now = datetime.utcnow()
        return {
            "pair": "EUR/USD",
            "direction": "BUY",
            "expiration": "5 минут",
            "expiry_minutes": 5,
            "expiry_time": (now + timedelta(minutes=5)).strftime("%H:%M"),
            "valid_until": (now + timedelta(seconds=30)).strftime("%H:%M:%S"),
            "confidence": "60%",
            "entry_price": "1.08500",
            "take_profit": "1.08800",
            "stop_loss": "1.08300",
            "signal_strength": "weak",
            "provider": "Demo",
            "payout": "80%",
            "signal_id": f"tv_{int(now.timestamp())}",
            "generated_at": now.isoformat()
        }
