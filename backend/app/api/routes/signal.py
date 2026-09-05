from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, SignalUsage, PocketOptionUser
from app.balance_utils import get_user_balance
from app.tradingview_collector import TradingViewCollector
from app.otc_analyzer import OTCSignalAnalyzer
from app.po_client_v2 import PocketOptionClient
from app.config import get_settings
from app.po_models import POSignal, SignalDirection, SignalStrength, SignalStatus, StrategyType
from app.signal_learning import queue_signal_resolution, serialize_candles
from datetime import datetime, timedelta
import json
from sqlalchemy import func, select as sa_select
import asyncio

settings = get_settings()

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


@router.post("/signal", response_model=dict)
async def get_signal(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение торгового сигнала
    - OTC: через PO WebSocket
    - Demo: через PO WebSocket  
    - Market: через TradingView
    """
    try:
        market = data.get("market", "otc")  # otc, demo, market
        timeframe = data.get("timeframe", "1")
        ai_type = data.get("ai_type", "ml")

        print(f"\n📊 ========== ЗАПРОС СИГНАЛА ==========")
        print(f"Пользователь: {current_user.email} (ID: {current_user.id})")
        print(f"Рынок: {market}, Таймфрейм: {timeframe}m, AI: {ai_type}")

        # Получаем баланс (для flaun.feed@mail.ru - с демо-счёта через WebSocket)
        user_balance = await get_user_balance(current_user, db)
        print(f"Баланс: ${user_balance}")

        # 🔴 ПРОВЕРКА ЛИМИТОВ СИГНАЛОВ
        today = datetime.utcnow().date()

        # Получаем использование сигналов сегодня
        result = await db.execute(
            sa_select(func.count(SignalUsage.id))
            .where(SignalUsage.user_id == current_user.id)
            .where(func.date(SignalUsage.used_at) == today)
        )
        used_today = result.scalar() or 0

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

        # 1. Получаем данные в зависимости от рынка
        analyzer = OTCSignalAnalyzer()
        best_signal = None
        signal_candles = []
        
        if market in ['otc', 'demo']:
            # Получаем данные через PO WebSocket
            print(f"📡 Получение данных через PO WebSocket ({market})...")

            client = PocketOptionClient(
                session_token=(
                    settings.POCKETOPTION_SESSION_TOKEN_DEMO
                    if market == 'demo' and settings.POCKETOPTION_SESSION_TOKEN_DEMO
                    else settings.POCKETOPTION_SESSION_TOKEN
                ),
                uid=settings.POCKETOPTION_UID,
                is_demo=(market == 'demo')
            )

            connected = await client.connect()
            if not connected:
                print("⚠️ Не удалось подключиться к PO WebSocket (сессия истекла)")
                print("💡 Для обновления сессии:")
                print("   1. Откройте https://po-ru4.click в браузере")
                print("   2. Откройте DevTools → Network → WS")
                print("   3. Найдите сообщение auth и скопируйте session")
                print("   4. Обновите POCKETOPTION_SESSION_TOKEN в .env")
                print("🔄 Используем fallback сигнал...")
                best_signal = generate_fallback_signal(market)
            else:
                await asyncio.sleep(2)  # Ждём авторизации

                # Определяем активы для анализа
                assets = ['EURUSD_otc', 'GBPUSD_otc', 'USDJPY_otc', 'AUDUSD_otc', 'USDCAD_otc']
                got_signal = False

                for asset in assets:
                    try:
                        candles = await client.get_candles(asset, int(timeframe) * 60, 100)

                        if candles and len(candles) >= 50:
                            signal_candles = candles
                            prices = [c['close'] for c in candles]
                            signal = analyzer.generate_signal(prices, asset)

                            if signal and signal.get('confidence', 0) > (best_signal.get('confidence', 0) if best_signal else 0):
                                best_signal = signal
                                got_signal = True
                                print(f"🎯 Сигнал для {asset}: {signal['signal_type']} ({signal['confidence']}%)")

                    except Exception as e:
                        print(f"⚠️ Ошибка получения данных для {asset}: {e}")
                        continue

                await client.disconnect()

                # Если сигнал не получен, используем fallback
                if not got_signal:
                    print("🔄 Сигнал не получен, используем fallback...")
                    best_signal = generate_fallback_signal(market)
            
        elif market == 'market':
            # Получаем данные из TradingView
            print(f"📈 Получение данных из TradingView...")
            
            collector = TradingViewCollector()
            market_data = await collector.get_current_data(market, timeframe)
            
            if not market_data or len(market_data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Не удалось получить данные TradingView"
                )
            
            print(f"✅ Получено {len(market_data)} валютных пар")
            
            # Анализируем каждую пару
            for pair in market_data:
                if not pair.candles or len(pair.candles) < 50:
                    continue
                
                signal_candles = pair.candles
                prices = [c.close for c in pair.candles]
                signal = analyzer.generate_signal(prices, pair.symbol)
                
                if signal and signal.get('confidence', 0) > (best_signal.get('confidence', 0) if best_signal else 0):
                    best_signal = signal
                    print(f"🎯 Сигнал для {pair.symbol}: {signal['signal_type']} ({signal['confidence']}%)")
        
        # Если сигнал не найден, генерируем fallback
        if not best_signal:
            best_signal = generate_fallback_signal(market)
            print("⚠️ Используем fallback сигнал")

        signal_type = SignalDirection.CALL if best_signal.get("signal_type", "call") == "call" else SignalDirection.PUT
        confidence = float(best_signal.get("confidence", 50.0))
        strength = SignalStrength.STRONG if confidence >= 80 else SignalStrength.MEDIUM if confidence >= 65 else SignalStrength.WEAK
        expiry_minutes = int(best_signal.get("expiry_minutes", int(timeframe)))
        expires_at = datetime.utcnow() + timedelta(minutes=expiry_minutes)
        strategy_type = StrategyType.MACHINE_LEARNING if ai_type in {"ml", "neural_ai"} else StrategyType.INDICATORS

        stored_signal_data = {
            **best_signal,
            "market": market,
            "ai_type": ai_type,
        }

        po_signal = POSignal(
            signal_type=signal_type,
            strength=strength,
            confidence=confidence,
            asset_name=best_signal.get("symbol", best_signal.get("pair", "EUR/USD")),
            amount=1.0,
            timeframe=expiry_minutes * 60,
            entry_price=best_signal.get("current_price"),
            current_price=best_signal.get("current_price"),
            strategy_type=strategy_type,
            strategy_data=stored_signal_data,
            status=SignalStatus.ACTIVE,
            activated_at=datetime.utcnow(),
            user_id=current_user.id,
            expires_at=expires_at,
            indicators_snapshot=best_signal.get("indicators", {}),
            price_history=serialize_candles(signal_candles),
            notes=f"Generated via /api/signal using {ai_type}",
            rsi=best_signal.get("indicators", {}).get("rsi"),
            macd_line=best_signal.get("indicators", {}).get("macd"),
            macd_signal=best_signal.get("indicators", {}).get("macd_signal"),
            macd_histogram=best_signal.get("indicators", {}).get("macd_histogram"),
            bollinger_upper=best_signal.get("indicators", {}).get("bollinger_upper"),
            bollinger_middle=best_signal.get("indicators", {}).get("bollinger_middle"),
            bollinger_lower=best_signal.get("indicators", {}).get("bollinger_lower"),
        )
        db.add(po_signal)
        await db.flush()

        # 2. Сохраняем использование сигнала
        signal_usage = SignalUsage(
            user_id=current_user.id,
            signal_data=json.dumps(best_signal)
        )
        db.add(signal_usage)
        await db.commit()
        await db.refresh(po_signal)

        queue_signal_resolution(po_signal.id, po_signal.expires_at)

        # 3. Форматируем ответ
        formatted_signal = format_signal_response(best_signal, market, user_balance, po_signal.id, po_signal.expires_at)

        print(f"\n✅ СИГНАЛ ГОТОВ:")
        print(f"   Пара: {formatted_signal['pair']}")
        print(f"   Направление: {formatted_signal['direction']}")
        print(f"   Экспирация: {formatted_signal['expiration']}")
        print(f"   Уверенность: {formatted_signal['confidence']}")

        return {
            "success": True,
            "signal": formatted_signal,
            "balance": user_balance,
            "market_data_summary": {
                "pairs_analyzed": len(assets) if market in ['otc', 'demo'] else len(market_data) if market == 'market' else 0,
                "timeframe": timeframe,
                "market": market,
                "timestamp": datetime.utcnow().isoformat()
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка получения сигнала: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации сигнала: {str(e)}"
        )


def generate_fallback_signal(market: str) -> dict:
    """Генерация fallback сигнала"""
    now = datetime.utcnow()
    
    return {
        "signal_type": "call",
        "strength": "weak",
        "confidence": 55,
        "current_price": 1.0850,
        "expiry_minutes": 3,
        "pair": "EUR/USD",
        "market": market,
        "timestamp": now.isoformat(),
    }


def format_signal_response(
    signal: dict,
    market: str,
    balance: float,
    db_signal_id: int | None = None,
    expires_at: datetime | None = None
) -> dict:
    """Форматирование сигнала для frontend"""
    try:
        # Определяем направление
        signal_type = signal.get("signal_type", "call")
        direction = "BUY" if signal_type == "call" else "SELL"
        
        # Получаем цену
        current_price = signal.get("current_price", 1.0850)
        
        # Получаем уверенность
        confidence = signal.get("confidence", 50)
        
        # Время экспирации
        expiry_minutes = signal.get("expiry_minutes", 5)
        expiry_time = expires_at or (datetime.utcnow() + timedelta(minutes=expiry_minutes))
        valid_until = datetime.utcnow() + timedelta(seconds=60)
        
        # Сила сигнала
        signal_strength = "strong" if confidence >= 75 else "medium" if confidence >= 65 else "weak"
        
        # Рассчитываем TP/SL (2% и 1% от цены)
        tp_price = current_price * 1.002 if direction == "BUY" else current_price * 0.998
        sl_price = current_price * 0.999 if direction == "BUY" else current_price * 1.001
        
        # Формируем обоснование
        pair_name = signal.get("symbol", signal.get("pair", "EUR/USD"))
        reasoning = f"{pair_name}: {direction} с уверенностью {confidence}%"
        
        if signal.get("indicators"):
            ind = signal["indicators"]
            if ind.get("rsi"):
                reasoning += f". RSI: {ind['rsi']:.1f}"
        
        return {
            "pair": pair_name,
            "direction": direction,
            "expiration": f"{expiry_minutes} минут",
            "expiry_minutes": expiry_minutes,
            "expiry_time": expiry_time.strftime("%H:%M"),
            "valid_until": valid_until.strftime("%H:%M:%S"),
            "confidence": f"{int(confidence)}%",
            "entry_price": f"{current_price:.5f}",
            "take_profit": f"{tp_price:.5f}",
            "stop_loss": f"{sl_price:.5f}",
            "signal_strength": signal_strength,
            "provider": f"AI {market.upper()}",
            "signal_id": f"sig_{int(datetime.utcnow().timestamp())}_{market}",
            "db_signal_id": db_signal_id,
            "generated_at": datetime.utcnow().isoformat(),
            "expiry_timestamp": expiry_time.isoformat(),
            "reasoning": reasoning,
            "market": market,
            "market_data": {
                "current_price": f"{current_price:.5f}",
                "trend": signal.get("trend", {}).get("direction", "neutral") if isinstance(signal.get("trend"), dict) else "neutral",
                "rsi": signal.get("indicators", {}).get("rsi", 50) if signal.get("indicators") else 50,
            }
        }
    except Exception as e:
        print(f"❌ Ошибка форматирования сигнала: {e}")
        import traceback
        traceback.print_exc()
        
        # Возвращаем дефолтный сигнал
        now = datetime.utcnow()
        return {
            "pair": "EUR/USD",
            "direction": "BUY",
            "expiration": "5 минут",
            "expiry_minutes": 5,
            "expiry_time": (now + timedelta(minutes=5)).strftime("%H:%M"),
            "valid_until": (now + timedelta(seconds=60)).strftime("%H:%M:%S"),
            "confidence": "50%",
            "entry_price": "1.08500",
            "take_profit": "1.08700",
            "stop_loss": "1.08400",
            "signal_strength": "weak",
            "provider": "Default",
            "signal_id": f"sig_{int(now.timestamp())}",
            "generated_at": now.isoformat(),
            "reasoning": "Базовый сигнал",
            "market": market,
            "market_data": {
                "current_price": "1.08500",
                "trend": "neutral",
                "rsi": 50,
            }
        }
