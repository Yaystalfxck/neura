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
from app.signal_limits import get_signal_limits, get_next_limit_balance
from app.enhanced_signal_analyzer import EnhancedSignalAnalyzer
from app.po_strategies_enhanced import (
    detect_candlestick_patterns,
    analyze_trend_strength,
    analyze_volume_profile,
    combined_strategy_analysis
)
from app.po_strategies_advanced import calculate_support_resistance_levels

router = APIRouter(prefix="/api", tags=["Signals"])


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
    С использованием расширенного ML и комбинированного анализа
    """
    if not tv_data or len(tv_data) == 0:
        return None

    best_pair = None
    best_score = 0
    best_signal = None

    # 1. Анализируем каждую пару
    for pair_data in tv_data:
        indicators = pair_data.get('indicators', {})
        candles = pair_data.get('candles', [])

        # Расчет качества сигнала (0-100)
        score = 0

        # RSI (25 баллов)
        rsi = indicators.get('rsi', 50)
        if 25 <= rsi <= 35 or 65 <= rsi <= 75:
            score += 25
        elif rsi < 25 or rsi > 75:
            score += 15
        else:
            score += 10

        # MACD (20 баллов)
        macd_direction = indicators.get('macd_signal_direction', 'neutral')
        if macd_direction == 'bullish':
            score += 20
        elif macd_direction == 'bearish':
            score += 10
        else:
            score += 5

        # Bollinger Bands (20 баллов)
        bb_position = indicators.get('bb_position', 'middle')
        if bb_position == 'below_lower':
            score += 20
        elif bb_position == 'above_upper':
            score += 15
        else:
            score += 10

        # Stochastic (15 баллов)
        stoch = indicators.get('stochastic_k', 50)
        if stoch < 20:
            score += 15
        elif stoch > 80:
            score += 5

        # Trend (10 баллов)
        trend = indicators.get('trend', 'neutral')
        if trend == 'bullish':
            score += 10
        elif trend == 'bearish':
            score += 5

        # Volume (10 баллов)
        volume_ratio = indicators.get('volume_ratio', 1)
        if volume_ratio > 1.5:
            score += 10
        elif volume_ratio > 1:
            score += 5
        else:
            score += 3

        if score > best_score:
            best_score = score
            best_pair = {**pair_data, 'signal_score': score}

    if not best_pair:
        return None

    indicators = best_pair.get('indicators', {})
    candles = best_pair.get('candles', [])

    signal = None
    strategy_name = "INDICATORS"

    # 2. ML анализ с расширенными индикаторами
    if strategy_type.lower() in ['ml', 'neural_ai', 'neural'] and candles and len(candles) >= 50:
        try:
            ml_gen = get_ml_generator()
            ml_gen.train(candles)
            ml_result = ml_gen.predict(candles)

            if ml_result and ml_result.get('confidence', 0) > 0.50:  # Снижен порог
                direction = ml_result.get('direction', 'call')
                confidence_pct = ml_result.get('confidence', 0) * 100
                signal = {
                    "signal_type": direction,
                    "strength": "strong" if confidence_pct > 75 else "medium",
                    "confidence": f"{confidence_pct:.0f}%",
                    "current_price": candles[-1].close if hasattr(candles[-1], 'close') else candles[-1].get('close', 0),
                    "expiry_minutes": 5,
                    "pair_name": best_pair.get('name', 'Unknown'),
                    "trend": ml_result.get('trend', 'neutral'),
                    "rsi": indicators.get('rsi', 50),
                    "pattern_detected": "ML_PREDICTION",
                    "payout": "N/A",
                    "db_strategy": "MACHINE_LEARNING",
                    "data_source": "tradingview_ml",
                    "signal_score": int(confidence_pct)
                }
                strategy_name = "MACHINE_LEARNING"
                print(f"   🤖 ML сигнал: {direction.upper()} ({confidence_pct:.0f}%)")
        except Exception as e:
            print(f"⚠️ ML ошибка: {e}")

    # 3. Комбинированный анализ стратегий (если есть свечи)
    if candles and len(candles) >= 20:
        combined = combined_strategy_analysis(candles)

        if combined['signal'] and combined['confidence'] > 50:
            print(f"   🎯 Комбинированный анализ: {combined['signal'].upper()} ({combined['confidence']:.0f}%)")
            print(f"      Голоса стратегий: {combined.get('votes', {})}")

            # Если комбинированный анализ сильнее ML - используем его
            combined_conf = combined['confidence']
            current_conf = float(signal.get('confidence', '0').replace('%', '')) if signal else 0

            if combined_conf > current_conf:
                signal = {
                    "signal_type": combined['signal'],
                    "strength": "strong" if combined_conf > 75 else "medium",
                    "confidence": f"{combined_conf:.0f}%",
                    "current_price": candles[-1].get('close', 0) if isinstance(candles[-1], dict) else getattr(candles[-1], 'close', 0),
                    "expiry_minutes": 5,
                    "pair_name": best_pair.get('name', 'Unknown'),
                    "trend": combined['strategies'].get('trend', {}).get('signal', 'neutral'),
                    "rsi": indicators.get('rsi', 50),
                    "pattern_detected": "COMBINED_STRATEGIES",
                    "payout": "N/A",
                    "db_strategy": "INDICATORS",  # Используем существующий enum вместо COMBINED
                    "data_source": "tradingview_combined",
                    "signal_score": int(combined_conf),
                    "strategies_used": list(combined['strategies'].keys())
                }
                print(f"   ✅ Комбинированный сигнал выбран как основной")

    # 4. Анализ уровней поддержки/сопротивления (если есть свечи)
    sr_adjustment = 0
    if candles and len(candles) >= 20:
        sr_levels = calculate_support_resistance_levels(candles)

        if sr_levels.get('nearest_support') and sr_levels.get('nearest_resistance'):
            dist_to_support = sr_levels['nearest_support']['distance_pct']
            dist_to_resistance = sr_levels['nearest_resistance']['distance_pct']
            support_strength = sr_levels['nearest_support']['strength']
            resistance_strength = sr_levels['nearest_resistance']['strength']

            # Если цена близко к сильной поддержке → BUY сигнал сильнее
            if dist_to_support < 0.5 and support_strength > 0.5:
                sr_adjustment += 5
                print(f"   📊 Цена близко к поддержке ({dist_to_support:.2f}%, сила {support_strength:.2f})")

            # Если цена близко к сильному сопротивлению → SELL сигнал сильнее
            if dist_to_resistance < 0.5 and resistance_strength > 0.5:
                sr_adjustment += 5
                print(f"   📊 Цена близко к сопротивлению ({dist_to_resistance:.2f}%, сила {resistance_strength:.2f})")

            # Если цена между уровнями - нейтральная зона
            if dist_to_support > 1.0 and dist_to_resistance > 1.0:
                sr_adjustment -= 3
                print(f"   📊 Цена в нейтральной зоне")

    # 5. Если ни ML ни комбинированный анализ не сработали -> индикаторы
    if signal is None:
        rsi = indicators.get('rsi', 50)
        macd = indicators.get('macd_signal_direction', 'neutral')
        trend = indicators.get('trend', 'neutral')

        bullish_votes = 0
        bearish_votes = 0

        if rsi < 45: bullish_votes += 1
        elif rsi > 55: bearish_votes += 1

        if macd == 'bullish': bullish_votes += 1
        elif macd == 'bearish': bearish_votes += 1

        if trend == 'bullish': bullish_votes += 1
        elif trend == 'bearish': bearish_votes += 1

        # Stochastic vote
        stoch = indicators.get('stochastic_k', 50)
        if stoch < 30: bullish_votes += 1
        elif stoch > 70: bearish_votes += 1

        if bullish_votes > bearish_votes:
            signal_type = "call"
            direction = "BUY"
        elif bearish_votes > bullish_votes:
            signal_type = "put"
            direction = "SELL"
        else:
            signal_type = "call" if rsi < 50 else "put"
            direction = "BUY" if rsi < 50 else "SELL"

        # Confidence based on votes and score
        confidence = min(95, 50 + best_score / 2.5)

        # Volatility-based expiry
        volatility = indicators.get('volatility', 1)
        if volatility < 0.5:
            optimal_timeframe = 7
        elif volatility > 2:
            optimal_timeframe = 3
        else:
            optimal_timeframe = 5

        current_price = best_pair.get('current_price', 0)
        # Convert price object to float if needed
        if hasattr(current_price, 'value'):
            current_price = current_price.value
        else:
            current_price = float(current_price)

        signal = {
            "signal_type": signal_type,
            "strength": "strong" if confidence > 75 else "medium",
            "confidence": f"{int(confidence)}%",
            "current_price": current_price,
            "expiry_minutes": optimal_timeframe,
            "pair_name": best_pair.get('name', 'Unknown'),
            "trend": trend,
            "rsi": int(rsi),
            "pattern_detected": f"TV_SCORE_{best_score}",
            "payout": "N/A",
            "db_strategy": "INDICATORS",
            "data_source": "tradingview_indicators",
            "signal_score": best_score
        }

    # 6. Применяем корректировку по уровням поддержки/сопротивления
    if signal and sr_adjustment != 0:
        conf_str = signal.get('confidence', '50%')
        conf = float(conf_str.replace('%', '')) if isinstance(conf_str, str) else float(conf_str)
        conf = max(50, min(95, conf + sr_adjustment))
        signal['confidence'] = f"{conf:.0f}%"
        signal['support_resistance'] = {
            'nearest_support': sr_levels.get('nearest_support', {}).get('price'),
            'nearest_resistance': sr_levels.get('nearest_resistance', {}).get('price'),
            'adjustment': sr_adjustment
        }

    return signal


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
    """Демо сигнал с полным анализом (ML + стратегии + S/R)"""
    import math
    import time

    # Генерируем "фейковые" свечи на основе текущего времени
    # Это делает сигнал детерминированным (не случайным) для конкретного момента
    now_ts = int(time.time())
    base_price = 1.0850

    # Создаем фейковые свечи
    demo_candles = []
    for i in range(150):
        ts = now_ts - (150 - i) * 60
        # Детерминированная "цена" на основе времени
        price_variation = math.sin(i / 10) * 0.005 + math.cos(i / 5) * 0.003
        open_p = base_price + price_variation
        close_p = open_p + (math.sin(i / 3) * 0.002)
        high_p = max(open_p, close_p) + 0.001
        low_p = min(open_p, close_p) - 0.001

        demo_candles.append({
            'time': ts,
            'open': open_p,
            'high': high_p,
            'low': low_p,
            'close': close_p
        })

    signal = None

    # 1. Попробуем ML
    if strategy_type.lower() in ['ml', 'neural_ai', 'neural']:
        try:
            ml_gen = get_ml_generator()
            ml_gen.train(demo_candles)
            ml_result = ml_gen.predict(demo_candles)
            if ml_result and ml_result.get('confidence', 0) > 0.50:
                direction = ml_result.get('direction', 'call')
                confidence_pct = ml_result.get('confidence', 0) * 100
                signal = {
                    "signal_type": direction,
                    "strength": "strong" if confidence_pct > 75 else "medium",
                    "confidence": f"{confidence_pct:.0f}%",
                    "current_price": demo_candles[-1]['close'],
                    "expiry_minutes": 5,
                    "pair_name": "EUR/USD",
                    "trend": ml_result.get('trend', 'neutral'),
                    "rsi": ml_result.get('rsi', 50),
                    "pattern_detected": "ML_DEMO",
                    "payout": "85%",
                    "db_strategy": "MACHINE_LEARNING",
                    "data_source": "demo_ml"
                }
        except Exception as e:
            print(f"⚠️ Демо ML ошибка: {e}")

    # 2. Комбинированный анализ
    combined = combined_strategy_analysis(demo_candles)
    if combined['signal'] and combined['confidence'] > 50:
        combined_conf = combined['confidence']
        current_conf = float(signal.get('confidence', '0').replace('%', '')) if signal else 0
        
        if combined_conf > current_conf:
            signal = {
                "signal_type": combined['signal'],
                "strength": "strong" if combined_conf > 75 else "medium",
                "confidence": f"{combined_conf:.0f}%",
                "current_price": demo_candles[-1]['close'],
                "expiry_minutes": 5,
                "pair_name": "EUR/USD",
                "trend": combined['strategies'].get('trend', {}).get('signal', 'neutral'),
                "rsi": 50,
                "pattern_detected": "COMBINED_STRATEGIES_DEMO",
                "payout": "85%",
                "db_strategy": "INDICATORS",
                "data_source": "demo_combined",
                "strategies_used": list(combined['strategies'].keys())
            }

    # 3. Уровни поддержки/сопротивления
    sr_levels = calculate_support_resistance_levels(demo_candles)
    sr_adjustment = 0
    if signal and sr_levels.get('nearest_support') and sr_levels.get('nearest_resistance'):
        dist_to_support = sr_levels['nearest_support']['distance_pct']
        dist_to_resistance = sr_levels['nearest_resistance']['distance_pct']
        support_strength = sr_levels['nearest_support']['strength']
        resistance_strength = sr_levels['nearest_resistance']['strength']

        if dist_to_support < 0.5 and support_strength > 0.5:
            sr_adjustment += 5
        elif dist_to_resistance < 0.5 and resistance_strength > 0.5:
            sr_adjustment += 5
        elif dist_to_support > 1.0 and dist_to_resistance > 1.0:
            sr_adjustment -= 3

        if sr_adjustment != 0:
            conf_str = signal.get('confidence', '50%')
            conf = float(conf_str.replace('%', '')) if isinstance(conf_str, str) else float(conf_str)
            conf = max(50, min(95, conf + sr_adjustment))
            signal['confidence'] = f"{conf:.0f}%"
            signal['support_resistance'] = {
                'nearest_support': sr_levels.get('nearest_support', {}).get('price'),
                'nearest_resistance': sr_levels.get('nearest_resistance', {}).get('price'),
                'adjustment': sr_adjustment
            }

    # 4. Фоллбэк на индикаторы
    if signal is None:
        from app.po_strategies_advanced import advanced_signal_strategy
        demo_asset = {"name": "EUR/USD", "payout": 85}
        signal = advanced_signal_strategy(demo_candles, demo_asset, "indicators")
        if signal:
            signal['data_source'] = 'demo_indicators'
        else:
            signal = {
                "signal_type": "call",
                "strength": "medium",
                "confidence": "65%",
                "current_price": demo_candles[-1]['close'],
                "expiry_minutes": 5,
                "pair_name": "EUR/USD",
                "payout": "85%",
                "db_strategy": "INDICATORS",
                "data_source": "demo_fallback"
            }

    return {
        "success": True,
        "signal": format_tv_signal_response(signal, current_user.balance),
        "balance": current_user.balance,
        "market_data_summary": {
            "assets_analyzed": 1,
            "data_source": "demo_with_full_analysis",
            "strategies": ["ML", "Combined Strategies", "Support/Resistance", "Indicators"]
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
