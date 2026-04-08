from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime, timedelta
import json
import os
import asyncio
import random
import time

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, SignalUsage, PocketOptionUser
from app.balance_utils import get_user_balance
from app.po_models import POSignal
from app.config import get_settings
from app.ml_signal_generator import get_ml_generator
from app.po_strategies_advanced import advanced_signal_strategy
from app.po_strategies_enhanced import (
    calculate_stochastic,
    calculate_cci,
    detect_candlestick_pattern,
    calculate_support_resistance
)

settings = get_settings()

# Import select as sa_select for compatibility
sa_select = select

router = APIRouter(prefix="/api", tags=["Signals"])


def get_next_limit_balance(current_balance: float) -> float:
    """Возвращает необходимый баланс для следующего лимита сигналов"""
    if current_balance >= 200:
        return 200
    elif current_balance >= 100:
        return 200
    elif current_balance >= 50:
        return 100
    elif current_balance >= 25:
        return 50
    else:
        return 25


# ============================================================
# BinaryOptionsToolsV2 Pool — реальные цены + история
# ============================================================

class POConnectionPool:
    """
    Пул соединений через BinaryOptionsToolsV2
    Получает РЕАЛЬНЫЕ цены через subscribe_symbol + историю через get_candles
    """
    
    def __init__(self):
        self._lock = asyncio.Lock()
    
    async def get_historical_candles(self, asset: str, timeframe: int = 60, count: int = 100) -> list:
        """Получить исторические свечи для анализа"""
        from BinaryOptionsToolsV2 import PocketOptionAsync
        
        session_token = settings.POCKETOPTION_SESSION_TOKEN
        
        try:
            client = PocketOptionAsync(ssid=session_token)
            await client.connect()
            
            # Получаем историю
            history = await client.get_candles(asset, timeframe, count)
            
            # Конвертируем в формат candles
            candles = []
            if history:
                for c in history:
                    candles.append({
                        'time': c.get('time', 0),
                        'open': float(c.get('open', 0)),
                        'high': float(c.get('high', 0)),
                        'low': float(c.get('low', 0)),
                        'close': float(c.get('close', 0)),
                    })
            
            await client.disconnect()
            return candles
            
        except Exception as e:
            print(f"❌ Ошибка получения истории: {e}")
            return []
    
    async def get_realtime_price(self, asset: str, timeout: float = 3.0) -> Optional[float]:
        """Получить РЕАЛЬНУЮ текущую цену через live стрим"""
        from BinaryOptionsToolsV2 import PocketOptionAsync
        
        session_token = settings.POCKETOPTION_SESSION_TOKEN
        
        try:
            client = PocketOptionAsync(ssid=session_token)
            await client.connect()
            
            realtime_prices = []
            start_time = time.time()
            
            async for candle in await client.subscribe_symbol(asset):
                price_raw = candle.get('close', candle.get('price', 0))
                try:
                    price = float(price_raw)
                    realtime_prices.append(price)
                except:
                    pass
                
                # Ждём timeout секунд
                if time.time() - start_time >= timeout:
                    break
            
            await client.disconnect()
            
            if realtime_prices:
                return realtime_prices[-1]  # Последняя = самая свежая
            return None
            
        except Exception as e:
            print(f"❌ Ошибка получения real-time цены: {e}")
            return None
    
    async def get_payout(self, asset: str) -> Optional[float]:
        """Получить payout"""
        from BinaryOptionsToolsV2 import PocketOptionAsync
        
        session_token = settings.POCKETOPTION_SESSION_TOKEN
        
        try:
            client = PocketOptionAsync(ssid=session_token)
            await client.connect()
            
            payout = client.get_payout(asset)
            
            await client.disconnect()
            return payout
            
        except:
            return None


# Singleton пул
_po_pool = POConnectionPool()


async def close_all_po_connections():
    """Закрыть все соединения (при shutdown)"""
    # BinaryOptionsToolsV2 не держит постоянных соединений
    # Каждое соединение закрывается после использования
    print("🔌 PO connections cleanup (no persistent connections)")


async def get_payout_for_assets(asset_ids: list) -> dict:
    """Получить payout для списка активов"""
    results = {}
    for asset_id in asset_ids:
        payout = await _po_pool.get_payout(asset_id)
        results[asset_id] = payout
    return results


@router.post("/signal", response_model=dict)
async def get_signal(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Универсальный endpoint для получения сигналов
    Автоматически выбирает источник данных:
    - OTC → Pocket Option WebSocket (реальный счет)
    - Demo → Pocket Option WebSocket (демо счет)
    - Market/Bиржа → TradingView (frontend)
    """
    market = data.get("market", "otc")
    
    # Маршрутизация в зависимости от рынка
    if market.lower() in ["market", "биржа", "exchange"]:
        # Используем TradingView для Market/Bиржа
        from app.api.routes.signal_tv import get_signal_tradingview
        print(f"\n📊 Перенаправление на TradingView (market={market})")
        return await get_signal_tradingview(data, current_user, db)
    
    # Для OTC и Demo используем Pocket Option
    # Demo будет использовать демо-счет (isDemo: 1)
    try:
        market = data.get("market", "otc")
        timeframe = data.get("timeframe", "1")
        strategy_type = data.get("strategy", data.get("ai_type", data.get("aiType", "indicators")))
        min_payout = data.get("min_payout", 80)

        print(f"\n📊 ========== ЗАПРОС СИГНАЛА ({'DEMO' if market.lower() == 'demo' else 'OTC'}) ==========")
        print(f"Пользователь: {current_user.email} (ID: {current_user.id})")
        print(f"Параметры: market={market}, timeframe={timeframe}m, strategy={strategy_type}, min_payout={min_payout}%")

        # 🔴 ПРОВЕРКА ЛИМИТОВ СИГНАЛОВ
        from datetime import datetime as dt_module
        from sqlalchemy import cast, Date
        
        today = dt_module.utcnow().date()

        # Получаем использование сигналов сегодня (PostgreSQL совместимо)
        result = await db.execute(
            sa_select(func.count(SignalUsage.id))
            .where(SignalUsage.user_id == current_user.id)
            .where(cast(SignalUsage.used_at, Date) == today)
        )
        used_today = result.scalar() or 0

        # Получаем баланс
        # Для flaun.feed@mail.ru - получаем с демо-счёта PO WebSocket
        if current_user.email == "flaun.feed@mail.ru":
            print(f"🎯 Получение баланса с демо-счёта для {current_user.email}")
            # Баланс будет получен при подключении клиента ниже
            # Используем fallback на $1000 пока не получим реальный
            po_balance = 1000.0
            user_balance = po_balance
            print(f"💰 Демо баланс (будет обновлён): ${po_balance}")
        else:
            # Для остальных - из БД
            po_result = await db.execute(
                sa_select(PocketOptionUser.current_balance)
                .where(PocketOptionUser.pocket_option_id == current_user.pocket_option_id)
            )
            po_row = po_result.scalar_one_or_none()
            # Обновляем баланс пользователя
            if po_row:
                user_balance = float(po_row)
                current_user.balance = user_balance
            else:
                user_balance = float(current_user.balance) if current_user.balance else 0.0
            print(f"💰 Баланс из БД: ${user_balance}")

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
                raise FastAPIHTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Лимит сигналов исчерпан. Вы использовали {used_today} из {daily_limit} сигналов сегодня. "
                           f"Для получения {daily_limit + 1} сигналов необходим баланс от ${get_next_limit_balance(user_balance)}."
                )

        print(f"✅ Лимиты: {used_today}/{daily_limit if current_user.role != 'admin' else '∞'} использовано")

        # ИСПОЛЬЗУЕМ ТОЛЬКО BinaryOptionsToolsV2 с TaskGroup (как Mastaaa1987)
        # Одно соединение для ВСЕГО — анализ + реальные цены
        print(f"\n🔌 Подключение через BinaryOptionsToolsV2...")

        from BinaryOptionsToolsV2 import PocketOptionAsync

        bot_client = PocketOptionAsync(ssid=settings.POCKETOPTION_SESSION_TOKEN)
        await bot_client.connect()

        # Ждём чтобы соединение установилось (как в Mastaaa1987)
        await asyncio.sleep(2)

        print("✅ BinaryOptionsToolsV2 подключено!")

        try:
            # Анализируем ВСЕ валютные пары через BinaryOptionsToolsV2
            # Используем history() с TaskGroup — как Mastaaa1987
            currency_pairs = [
                {"id": "EURUSD_otc", "name": "EUR/USD OTC", "payout": 90},
                {"id": "GBPUSD_otc", "name": "GBP/USD OTC", "payout": 88},
                {"id": "AUDUSD_otc", "name": "AUD/USD OTC", "payout": 90},
                {"id": "USDJPY_otc", "name": "USD/JPY OTC", "payout": 90},
                {"id": "USDCAD_otc", "name": "USD/CAD OTC", "payout": 90},
                {"id": "USDCHF_otc", "name": "USD/CHF OTC", "payout": 85},
                {"id": "AUDCAD_otc", "name": "AUD/CAD OTC", "payout": 90},
                {"id": "NZDUSD_otc", "name": "NZD/USD OTC", "payout": 88},
                {"id": "EURGBP_otc", "name": "EUR/GBP OTC", "payout": 85},
                {"id": "EURJPY_otc", "name": "EUR/JPY OTC", "payout": 88},
                {"id": "GBPJPY_otc", "name": "GBP/JPY OTC", "payout": 88},
                {"id": "AUDJPY_otc", "name": "AUD/JPY OTC", "payout": 88},
            ]

            print(f"\n🔍 Анализ {len(currency_pairs)} активов через TaskGroup...")

            # Mastaaa1987 pattern: TaskGroup для ПАРАЛЛЕЛЬНОГО получения данных
            history_tasks = {}
            async with asyncio.TaskGroup() as tg:
                for asset in currency_pairs:
                    task = tg.create_task(bot_client.history(asset['id'], 60))
                    history_tasks[asset['id']] = {'task': task, 'asset': asset}

            # Ждём чтобы все задачи завершились
            await asyncio.sleep(5)

            # Собираем результаты
            analyzed_signals = []

            for asset_id, data in history_tasks.items():
                asset = data['asset']
                try:
                    candles_data = data['task'].result()

                    if not candles_data or len(candles_data) < 20:
                        print(f"   ⚠️ {asset['name']}: недостаточно данных ({len(candles_data) if candles_data else 0})")
                        continue

                    # Конвертируем в формат для анализа
                    history = []
                    for c in candles_data:
                        history.append({
                            'time': c.get('time', 0),
                            'open': float(c.get('open', 0)),
                            'high': float(c.get('high', 0)),
                            'low': float(c.get('low', 0)),
                            'close': float(c.get('close', 0)),
                        })

                    # Генерируем сигнал
                    signal = advanced_signal_strategy(history, asset, strategy_type)
                    if not signal:
                        signal = generate_signal_from_candles_simple(history, asset, strategy_type, 5)

                    if signal:
                        # === УЛУЧШЕННЫЙ АНАЛИЗ ===
                        stoch = calculate_stochastic(
                            [c['close'] for c in history],
                            [c['high'] for c in history],
                            [c['low'] for c in history],
                            14
                        )

                        cci = calculate_cci(
                            [c['high'] for c in history],
                            [c['low'] for c in history],
                            [c['close'] for c in history],
                            20
                        )

                        pattern = detect_candlestick_pattern(
                            [c['open'] for c in history],
                            [c['high'] for c in history],
                            [c['low'] for c in history],
                            [c['close'] for c in history]
                        )

                        support, resistance = calculate_support_resistance(
                            [c['close'] for c in history], 20
                        )

                        # Корректируем уверенность
                        original_conf = float(signal.get('confidence', '50%').replace('%', ''))

                        if signal['signal_type'] == 'call' and stoch < 30:
                            original_conf += 5
                        elif signal['signal_type'] == 'put' and stoch > 70:
                            original_conf += 5
                        elif signal['signal_type'] == 'call' and stoch > 70:
                            original_conf -= 5
                        elif signal['signal_type'] == 'put' and stoch < 30:
                            original_conf -= 5

                        if signal['signal_type'] == 'call' and cci < -100:
                            original_conf += 5
                        elif signal['signal_type'] == 'put' and cci > 100:
                            original_conf += 5

                        if pattern['type'] == signal['signal_type']:
                            original_conf += pattern['strength'] * 10

                        current_price = history[-1]['close']
                        dist_to_support = abs(current_price - support) / current_price if current_price > 0 else 1
                        dist_to_resistance = abs(current_price - resistance) / current_price if current_price > 0 else 1

                        if signal['signal_type'] == 'call' and dist_to_support < 0.002:
                            original_conf += 5
                        elif signal['signal_type'] == 'put' and dist_to_resistance < 0.002:
                            original_conf += 5

                        original_conf = max(50, min(95, original_conf))
                        confidence = original_conf

                        if confidence > 80:
                            signal['strength'] = 'strong'
                        elif confidence > 65:
                            signal['strength'] = 'medium'
                        else:
                            signal['strength'] = 'weak'

                        signal['confidence'] = f"{int(confidence)}%"
                        signal['enhanced_indicators'] = {
                            'stochastic_k': round(stoch, 2),
                            'cci': round(cci, 2),
                            'candle_pattern': pattern['name'],
                            'support': round(support, 5),
                            'resistance': round(resistance, 5),
                            'dist_to_support_pct': f"{dist_to_support*100:.3f}%",
                            'dist_to_resistance_pct': f"{dist_to_resistance*100:.3f}%"
                        }

                        # РЕАЛЬНАЯ цена из BinaryOptionsToolsV2 (последняя свеча)
                        realtime_price = history[-1]['close']
                        signal['current_price'] = float(realtime_price)

                        analyzed_signals.append({
                            'asset': asset,
                            'signal': signal,
                            'history': history,
                            'confidence': confidence,
                            'realtime_price': realtime_price
                        })

                        print(f"   📊 {asset['name']}: {signal.get('signal_type', '?').upper()} ({confidence:.1f}%) | price:{realtime_price:.5f} [stoch:{stoch:.1f} cci:{cci:.1f}]")

                except Exception as e:
                    print(f"   ❌ {asset['name']}: {e}")

            if not analyzed_signals:
                print("❌ Не удалось проанализировать ни один актив")
                await bot_client.disconnect()
                raise FastAPIHTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Не удалось сгенерировать сигнал"
                )

            # 🏆 Выбираем с МАКСИМАЛЬНОЙ уверенностью
            best = max(analyzed_signals, key=lambda x: x['confidence'])
            best_asset = best['asset']
            signal = best['signal']
            history = best['history']
            realtime_price = best['realtime_price']

            print(f"\n🏆 ЛУЧШИЙ СИГНАЛ: {best_asset['name']}")
            print(f"   Направление: {signal.get('signal_type', '?').upper()}")
            print(f"   Уверенность: {best['confidence']:.1f}%")
            print(f"   💰 Реальная цена: {realtime_price:.5f}")

            # Обновляем цену в сигнале
            signal['current_price'] = float(realtime_price)

            # Закрываем соединение
            print(f"\n🔌 Отключение...")
            await bot_client.disconnect()
            print("✅ Отключено!")

            # Форматируем и возвращаем
            return {
                "success": True,
                "signal": format_signal_response(signal, user_balance),
                "balance": float(user_balance),
                "market_data_summary": {
                    "assets_analyzed": len(currency_pairs),
                    "timeframe": timeframe,
                    "market": market,
                    "strategy": strategy_type,
                    "min_payout": min_payout,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data_source": "BinaryOptionsToolsV2"
                }
            }

        except FastAPIHTTPException:
            raise
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            import traceback
            traceback.print_exc()
            await bot_client.disconnect()
            raise FastAPIHTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при генерации сигнала: {str(e)}"
            )

    except FastAPIHTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()

        raise FastAPIHTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при генерации сигнала: {str(e)}"
        )


def generate_fallback_signal(assets) -> dict:
    """Генерация fallback сигнала"""
    now = datetime.utcnow()

    # Выбираем актив с максимальным payout
    best_asset = max(assets, key=lambda x: x.get('payout', 0)) if assets else None
    pair_name = best_asset.get('name', 'EUR/USD') if best_asset else 'EUR/USD'
    payout = best_asset.get('payout', 80) if best_asset else 80

    return {
        "signal_type": "call",
        "strength": "medium",
        "confidence": "65%",
        "current_price": 1.0850,
        "expiry_minutes": 3,
        "expiry_timestamp": (now + timedelta(minutes=3)).isoformat(),
        "valid_until": (now + timedelta(seconds=30)).isoformat(),
        "pair_name": pair_name,
        "trend": "neutral",
        "rsi": 50,
        "pattern_detected": "default",
        "payout": f"{payout}%"
    }


def generate_demo_signal(strategy_type: str, min_payout: int) -> dict:
    """Генерация демо-сигнала когда PO API недоступен"""
    now = datetime.utcnow()
    
    # Демо-активы
    demo_assets = [
        {"id": "EURUSD_otc", "name": "EUR/USD OTC", "payout": 92},
        {"id": "GBPUSD_otc", "name": "GBP/USD OTC", "payout": 88},
        {"id": "AUDUSD_otc", "name": "AUD/USD OTC", "payout": 92},
    ]
    
    best_asset = max(demo_assets, key=lambda x: x['payout'])
    
    # Генерируем случайный сигнал на основе стратегии
    import random
    signal_type = random.choice(["call", "put"])
    confidence = random.randint(65, 85)
    
    return {
        "signal_type": signal_type,
        "strength": "strong" if confidence > 75 else "medium",
        "confidence": f"{confidence}%",
        "current_price": 1.0850 + random.uniform(-0.01, 0.01),
        "expiry_minutes": 3,
        "expiry_timestamp": (now + timedelta(minutes=3)).isoformat(),
        "valid_until": (now + timedelta(seconds=30)).isoformat(),
        "pair_name": best_asset['name'],
        "trend": "bullish" if signal_type == "call" else "bearish",
        "rsi": random.randint(30, 70),
        "pattern_detected": strategy_type,
        "payout": f"{best_asset['payout']}%"
    }


def generate_signal_from_candles(
    candles: list,
    asset: dict,
    strategy_type: str,
    timeframe: int
) -> dict:
    """Генерация сигнала на основе свечей"""
    now = datetime.utcnow()
    
    if not candles or len(candles) < 10:
        return generate_demo_signal(strategy_type, 80)
    
    # Получаем последние свечи
    last_candle = candles[-1]
    prev_candle = candles[-2]
    
    # Определяем тренд по последним свечам
    recent_candles = candles[-10:]
    bullish_count = sum(1 for c in recent_candles if c['close'] > c['open'])
    bearish_count = len(recent_candles) - bullish_count
    
    # Простая логика определения направления
    if bullish_count > bearish_count + 2:
        signal_type = "call"
        trend = "bullish"
    elif bearish_count > bullish_count + 2:
        signal_type = "put"
        trend = "bearish"
    else:
        signal_type = "call" if last_candle['close'] > last_candle['open'] else "put"
        trend = "neutral"
    
    # Рассчитываем уверенность
    confidence = min(95, 50 + abs(bullish_count - bearish_count) * 5)
    
    # RSI имитация
    rsi = 50 + (bullish_count - bearish_count) * 5
    rsi = max(0, min(100, rsi))
    
    return {
        "signal_type": signal_type,
        "strength": "strong" if confidence > 75 else "medium" if confidence > 60 else "weak",
        "confidence": f"{int(confidence)}%",
        "current_price": float(last_candle['close']),
        "expiry_minutes": timeframe // 60,
        "expiry_timestamp": (now + timedelta(minutes=timeframe // 60)).isoformat(),
        "valid_until": (now + timedelta(seconds=30)).isoformat(),
        "pair_name": asset['name'],
        "trend": trend,
        "rsi": int(rsi),
        "pattern_detected": strategy_type,
        "payout": f"{asset['payout']}%"
    }


def get_payout_assets(min_payout: int = 80, market: str = "otc") -> list:
    """Получение активов с payout (для совместимости)"""
    demo_assets = [
        {"id": "EURUSD_otc", "name": "EUR/USD OTC", "payout": 92, "market_type": "otc"},
        {"id": "GBPUSD_otc", "name": "GBP/USD OTC", "payout": 88, "market_type": "otc"},
        {"id": "AUDUSD_otc", "name": "AUD/USD OTC", "payout": 92, "market_type": "otc"},
    ]
    return [a for a in demo_assets if a['payout'] >= min_payout]


def generate_signal_from_candles(candles: list, asset: dict, strategy_type: str, timeframe: int) -> dict:
    """Генерация сигнала на основе реальных свечей"""
    if not candles or len(candles) < 10:
        return generate_signal_with_indicators(asset, strategy_type, timeframe)
    
    # Получаем последние свечи (Candle objects или dict)
    last_candle = candles[-1]
    recent_candles = candles[-20:]
    
    # Конвертируем Candle objects в dict если нужно
    def get_candle_attr(candle, attr, default=0):
        if isinstance(candle, dict):
            return candle.get(attr, default)
        else:
            return getattr(candle, attr, getattr(candle, 'close', default))
    
    # Определяем тренд
    bullish = 0
    for c in recent_candles:
        close = get_candle_attr(c, 'close')
        open_price = get_candle_attr(c, 'open')
        if close > open_price:
            bullish += 1
    
    bearish = len(recent_candles) - bullish
    
    last_close = get_candle_attr(last_candle, 'close')
    last_open = get_candle_attr(last_candle, 'open')
    
    if bullish > bearish + 5:
        signal_type = "call"
        trend = "bullish"
    elif bearish > bullish + 5:
        signal_type = "put"
        trend = "bearish"
    else:
        signal_type = "call" if last_close > last_open else "put"
        trend = "neutral"
    
    confidence = min(95, 50 + abs(bullish - bearish) * 3)
    rsi = 50 + (bullish - bearish) * 3
    
    return {
        "signal_type": signal_type,
        "strength": "strong" if confidence > 75 else "medium",
        "confidence": f"{int(confidence)}%",
        "current_price": float(last_close),
        "expiry_minutes": timeframe,
        "expiry_timestamp": (datetime.utcnow() + timedelta(minutes=timeframe)).isoformat(),
        "valid_until": (datetime.utcnow() + timedelta(seconds=30)).isoformat(),
        "pair_name": asset['name'],
        "trend": trend,
        "rsi": int(max(0, min(100, rsi))),
        "pattern_detected": strategy_type,
        "payout": f"{asset['payout']}%",
        "db_strategy": "INDICATORS"
    }


def generate_signal_with_indicators(asset: dict, strategy_type: str, timeframe: int) -> dict:
    """Генерация сигнала с индикаторами (демо-режим)"""
    signal_type = random.choice(["call", "put"])
    confidence = random.randint(70, 90)

    # В основном 5 минут, иногда 3
    expiry_minutes = 5 if random.random() > 0.3 else 3

    return {
        "signal_type": signal_type,
        "strength": "strong" if confidence > 80 else "medium",
        "confidence": f"{confidence}%",
        "current_price": random.uniform(1.08, 1.12),
        "expiry_minutes": expiry_minutes,
        "expiry_timestamp": (datetime.utcnow() + timedelta(minutes=expiry_minutes)).isoformat(),
        "valid_until": (datetime.utcnow() + timedelta(seconds=30)).isoformat(),
        "pair_name": asset['name'],
        "trend": "bullish" if signal_type == "call" else "bearish",
        "rsi": random.randint(30, 70),
        "pattern_detected": strategy_type,
        "payout": f"{asset['payout']}%",
        "db_strategy": "INDICATORS"
    }


def format_signal_response(signal: dict, balance: float) -> dict:
    """Форматирование сигнала для frontend"""
    try:
        direction = "BUY" if signal.get("signal_type") == "call" else "SELL"
        current_price = signal.get("current_price", 1.0850)
        
        # Преобразуем current_price в float
        if isinstance(current_price, str):
            try:
                current_price = float(current_price)
            except:
                current_price = 1.0850
        
        confidence_str = signal.get("confidence", "50%")
        confidence = float(confidence_str.replace("%", "")) if isinstance(confidence_str, str) else confidence_str

        # Рассчитываем TP/SL
        volatility = signal.get("volatility", 0.01)
        # Преобразуем volatility в float
        if isinstance(volatility, str):
            try:
                volatility = float(volatility)
            except:
                volatility = 0.01
        
        tp_multiplier = 1 + (volatility * 0.4) if direction == "BUY" else 1 - (volatility * 0.4)
        sl_multiplier = 1 - (volatility * 0.2) if direction == "BUY" else 1 + (volatility * 0.2)

        # Обрабатываем время
        expiry_timestamp = signal.get("expiry_timestamp")
        valid_until_timestamp = signal.get("valid_until")

        try:
            if isinstance(expiry_timestamp, str):
                expiry_time = datetime.fromisoformat(expiry_timestamp.replace('Z', '+00:00'))
            else:
                expiry_time = datetime.utcnow() + timedelta(minutes=signal.get("expiry_minutes", 3))
        except:
            expiry_time = datetime.utcnow() + timedelta(minutes=signal.get("expiry_minutes", 3))

        try:
            if isinstance(valid_until_timestamp, str):
                valid_until = datetime.fromisoformat(valid_until_timestamp.replace('Z', '+00:00'))
            else:
                valid_until = datetime.utcnow() + timedelta(seconds=30)
        except:
            valid_until = datetime.utcnow() + timedelta(seconds=30)

        signal_strength = "strong" if confidence > 75 else "moderate" if confidence > 65 else "weak"

        return {
            "pair": signal.get("pair_name", "EUR/USD"),
            "direction": direction,
            "expiration": f"{signal.get('expiry_minutes', 3)} минут",
            "expiry_minutes": signal.get("expiry_minutes", 3),
            "expiry_time": expiry_time.strftime("%H:%M"),
            "valid_until": valid_until.strftime("%H:%M:%S"),
            "confidence": f"{int(confidence)}%",
            "entry_price": f"{float(current_price):.5f}",
            "take_profit": f"{float(current_price) * tp_multiplier:.5f}",
            "stop_loss": f"{float(current_price) * sl_multiplier:.5f}",
            "signal_strength": signal_strength,
            "provider": "Pocket Option API",
            "payout": signal.get("payout", "80%"),
            "signal_id": f"po_{int(datetime.utcnow().timestamp())}",
            "generated_at": datetime.utcnow().isoformat(),
            "reasoning": f"{signal.get('pair_name', 'EUR/USD')}: {direction} ({confidence}%). "
                        f"Экспирация: {signal.get('expiry_minutes', 3)} мин. "
                        f"Payout: {signal.get('payout', '80%')}",
            "market_data": {
                "current_price": f"{float(current_price):.5f}",
                "trend": signal.get("trend", "neutral"),
                "support": f"{float(current_price) * 0.995:.5f}",
                "resistance": f"{float(current_price) * 1.005:.5f}",
                "signal_strength": signal_strength,
                "confidence": f"{int(confidence)}%",
                "rsi": signal.get("rsi", 50),
                "macd": signal.get("macd_direction", "neutral"),
                "payout": signal.get("payout", "80%")
            }
        }
        
    except Exception as e:
        print(f"❌ Ошибка форматирования сигнала: {e}")
        # Возвращаем дефолтный сигнал
        now = datetime.utcnow()
        return {
            "pair": "EUR/USD",
            "direction": "BUY",
            "expiration": "3 минут",
            "expiry_minutes": 3,
            "expiry_time": (now + timedelta(minutes=3)).strftime("%H:%M"),
            "valid_until": (now + timedelta(seconds=30)).strftime("%H:%M:%S"),
            "confidence": "60%",
            "entry_price": "1.08500",
            "take_profit": "1.08800",
            "stop_loss": "1.08300",
            "signal_strength": "weak",
            "provider": "Pocket Option API (Fallback)",
            "payout": "80%",
            "signal_id": f"po_{int(now.timestamp())}",
            "generated_at": now.isoformat(),
            "reasoning": "Базовый сигнал PO",
            "market_data": {
                "current_price": "1.08500",
                "trend": "neutral",
                "support": "1.08300",
                "resistance": "1.08800",
                "signal_strength": "weak",
                "confidence": "60%",
                "rsi": 50,
                "macd": "neutral",
                "payout": "80%"
            }
        }


@router.get("/signals/history", response_model=dict)
async def get_signals_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение истории сигналов пользователя"""
    try:
        result = await db.execute(
            select(POSignal)
            .where(POSignal.user_id == current_user.id)
            .order_by(POSignal.created_at.desc())
            .limit(limit)
        )
        signals = result.scalars().all()
        
        return {
            "success": True,
            "signals": [
                {
                    "id": s.id,
                    "asset": s.asset_name,
                    "signal_type": s.signal_type,
                    "strength": s.strength,
                    "confidence": f"{s.confidence}%",
                    "status": "completed",
                    "created_at": s.created_at.isoformat()
                }
                for s in signals
            ],
            "total": len(signals)
        }
        
    except Exception as e:
        print(f"❌ Ошибка получения истории: {e}")
        raise FastAPIHTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения истории: {str(e)}"
        )


@router.get("/assets", response_model=dict)
async def get_available_assets(
    min_payout: int = 80,
    market: str = "otc"
):
    """Получение списка доступных активов"""
    try:
        assets = await get_payout_assets(min_payout=min_payout, market=market)
        
        return {
            "success": True,
            "assets": assets,
            "total": len(assets),
            "filters": {
                "min_payout": min_payout,
                "market": market
            }
        }
        
    except Exception as e:
        print(f"❌ Ошибка получения активов: {e}")
        raise FastAPIHTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения активов: {str(e)}"
        )
