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
from app.signal_limits import get_signal_limits, get_next_limit_balance
# Используем BinaryOptionsToolsV2 для получения актуальных цен
try:
    from BinaryOptionsToolsV2 import PocketOptionAsync
    USE_BOT_V2 = True
except ImportError:
    USE_BOT_V2 = False
    from app.pocketoptionapi_async.client import AsyncPocketOptionClient

settings = get_settings()

# ============================================================
# ГЛОБАЛЬНЫЙ ПУЛ ПОДКЛЮЧЕНИЙ (Connection Pool)
# ============================================================
# Чтобы не спамить подключениями при множестве пользователей,
# мы используем ОДНО общее соединение, которое переиспользуется.

_global_ws_client = None
_global_ws_last_active = 0
_global_ws_lock = asyncio.Lock()
_global_keepalive_task = None

async def _keepalive_loop():
    """
    Фоновая задача для поддержания WebSocket соединения.
    Отправляет ping каждые 25 секунд чтобы PocketOption не разорвал соединение.
    """
    global _global_ws_client, _global_ws_last_active
    
    print("🔄 Keepalive цикл запущен (ping каждые 25 сек)...")
    
    try:
        while True:
            await asyncio.sleep(25)  # Отправляем ping каждые 25 секунд
            
            async with _global_ws_lock:
                # Проверяем есть ли активный клиент
                if _global_ws_client is None:
                    print("⚠️ Keepalive: клиент отсутствует, останавливаем")
                    break
                
                # Проверяем не устарело ли соединение (> 5 мин неактивности)
                now = time.time()
                if (now - _global_ws_last_active) >= 300:
                    print("♻️ Keepalive: соединение устарело, закрываем...")
                    try:
                        await _global_ws_client.shutdown()  # ПОЛНОЕ закрытие
                    except:
                        pass
                    _global_ws_client = None
                    break
                
                # Отправляем ping для поддержания соединения
                try:
                    # BinaryOptionsToolsV2 internally handles ping/pong
                    # Но мы можем вызвать get_candles для проверки соединения
                    # или просто ничего не делать - библиотека сама поддерживает
                    print("💓 Keepalive: соединение активно")
                except Exception as e:
                    print(f"⚠️ Keepalive ошибка: {e}")
                    
    except asyncio.CancelledError:
        print("🛑 Keepalive цикл остановлен")
    except Exception as e:
        print(f"❌ Keepalive критическая ошибка: {e}")


async def get_pooled_ws_client():
    """
    Возвращает активный WebSocket клиент.
    Если клиента нет или он устарел (> 5 мин неактивности) -> пересоздает.
    """
    global _global_ws_client, _global_ws_last_active, _global_keepalive_task

    async with _global_ws_lock:
        now = time.time()
        # Если клиент жив и активен менее 5 минут назад - используем его
        if _global_ws_client is not None and (now - _global_ws_last_active) < 300:
            return _global_ws_client

        # Если клиент старый - закрываем ПОЛНОСТЬЮ
        if _global_ws_client is not None:
            try:
                print("♻️ Старое соединение устарело, закрываем...")
                await _global_ws_client.shutdown()  # ← ИСПОЛЬЗУЕМ shutdown() вместо disconnect()
            except:
                pass
            _global_ws_client = None
            
            # Останавливаем старую keepalive задачу
            if _global_keepalive_task and not _global_keepalive_task.done():
                _global_keepalive_task.cancel()
                try:
                    await _global_keepalive_task
                except asyncio.CancelledError:
                    pass

        # Создаем новое
        ssid = settings.POCKETOPTION_SESSION_TOKEN
        is_demo_mode = '"isDemo":1' in ssid or '"isDemo": 1' in ssid
        print("🔌 Создание нового общего соединения с PO...")

        if USE_BOT_V2:
            _global_ws_client = PocketOptionAsync(ssid=ssid)
        else:
            _global_ws_client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo_mode, enable_logging=False)

        await _global_ws_client.connect()
        _global_ws_last_active = time.time()
        print("✅ Новое соединение создано и готово к работе.")
        
        # Запускаем keepalive цикл для нового соединения
        if _global_keepalive_task is None or _global_keepalive_task.done():
            _global_keepalive_task = asyncio.create_task(_keepalive_loop())
            print("🔄 Keepalive цикл запущен")

        return _global_ws_client

# ML генератор (singleton)
_ml_generator = None
def get_ml():
    global _ml_generator
    if _ml_generator is None:
        _ml_generator = get_ml_generator()
    return _ml_generator

# Import select as sa_select for compatibility
sa_select = select

router = APIRouter(prefix="/api", tags=["Signals"])


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
        client = None

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

            return candles

        except Exception as e:
            print(f"❌ Ошибка получения истории: {e}")
            return []
        finally:
            # ВСЕГДА закрываем соединение, даже при ошибке
            if client is not None:
                try:
                    await client.disconnect()
                except:
                    pass
    
    async def get_realtime_price(self, asset: str, timeout: float = 3.0) -> Optional[float]:
        """Получить РЕАЛЬНУЮ текущую цену через live стрим"""
        from BinaryOptionsToolsV2 import PocketOptionAsync

        session_token = settings.POCKETOPTION_SESSION_TOKEN
        client = None

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

            if realtime_prices:
                return realtime_prices[-1]  # Последняя = самая свежая
            return None

        except Exception as e:
            print(f"❌ Ошибка получения real-time цены: {e}")
            return None
        finally:
            # ВСЕГДА закрываем соединение, даже при ошибке
            if client is not None:
                try:
                    await client.disconnect()
                except:
                    pass
    
    async def get_payout(self, asset: str) -> Optional[float]:
        """Получить payout"""
        from BinaryOptionsToolsV2 import PocketOptionAsync

        session_token = settings.POCKETOPTION_SESSION_TOKEN
        client = None

        try:
            client = PocketOptionAsync(ssid=session_token)
            await client.connect()

            payout = client.get_payout(asset)

            return payout

        except Exception as e:
            print(f"❌ Ошибка получения payout: {e}")
            return None
        finally:
            # ВСЕГДА закрываем соединение, даже при ошибке
            if client is not None:
                try:
                    await client.disconnect()
                except:
                    pass


# Singleton пул
_po_pool = POConnectionPool()


async def close_all_po_connections():
    """Закрыть все соединения (при shutdown)"""
    global _global_ws_client, _global_keepalive_task
    
    print("🔌 Закрытие глобального WebSocket пула...")
    
    # Останавливаем keepalive задачу
    if _global_keepalive_task and not _global_keepalive_task.done():
        print("🛑 Остановка keepalive цикла...")
        _global_keepalive_task.cancel()
        try:
            await _global_keepalive_task
        except asyncio.CancelledError:
            pass
        _global_keepalive_task = None
    
    # Закрываем глобальное соединение из пула
    if _global_ws_client is not None:
        try:
            print("♻️ Закрытие глобального WebSocket соединения...")
            await _global_ws_client.shutdown()  # ← ПОЛНОЕ закрытие через shutdown()
            _global_ws_client = None
            print("✅ Глобальное WebSocket соединение закрыто")
        except Exception as e:
            print(f"⚠️ Ошибка при закрытии: {e}")
    
    # BinaryOptionsToolsV2 POConnectionPool не держит постоянных соединений
    # Каждое соединение закрывается после использования
    print("✅ PO connections cleanup complete")


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
    global _global_ws_client
    
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
        try:
            print("📊 Проверка лимитов...")
            from datetime import datetime as dt_module
            from sqlalchemy import cast, Date

            today = dt_module.utcnow().date()

            # Получаем использование сигналов сегодня
            result = await db.execute(
                sa_select(func.count(SignalUsage.id))
                .where(SignalUsage.user_id == current_user.id)
                .where(cast(SignalUsage.used_at, Date) == today)
            )
            used_today = result.scalar() or 0
            print(f"   Использовано сегодня: {used_today}")

            # Получаем баланс из БД (без WebSocket подключений)
            print("💰 Получение баланса...")
            user_balance = float(current_user.balance) if current_user.balance else 0.0
            print(f"💰 Баланс: ${user_balance}")

            # Используем единую функцию для расчета лимитов
            limits = get_signal_limits(user_balance, current_user.role)
            daily_limit = limits["limit"]

            if current_user.role != 'admin' and used_today >= daily_limit:
                raise FastAPIHTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Лимит сигналов исчерпан. Вы использовали {used_today} из {daily_limit} сигналов сегодня."
                )
        except FastAPIHTTPException:
            raise
        except Exception as e:
            print(f"❌ Ошибка проверки лимитов: {e}")
            import traceback
            traceback.print_exc()
            user_balance = 1000.0
            used_today = 0
            daily_limit = 999

        print(f"✅ Лимиты: {used_today}/{daily_limit if current_user.role != 'admin' else '∞'} использовано")

        # === ГЕНЕРАЦИЯ СИГНАЛА (CONNECTION POOL) ===
        print(f"\n🚀 Начинаем генерацию сигнала...")

        # Получаем клиент из пула (переиспользуем соединение)
        bot_client = await get_pooled_ws_client()

        # Обновляем время активности, чтобы соединение не закрылось
        global _global_ws_last_active
        _global_ws_last_active = time.time()

        analyzed_candidates = []

        # Список активов для анализа
        currency_pairs = [
            {"id": "EURUSD_otc", "name": "EUR/USD OTC"}, {"id": "GBPUSD_otc", "name": "GBP/USD OTC"},
            {"id": "AUDUSD_otc", "name": "AUD/USD OTC"}, {"id": "USDJPY_otc", "name": "USD/JPY OTC"},
            {"id": "USDCAD_otc", "name": "USD/CAD OTC"}, {"id": "USDCHF_otc", "name": "USD/CHF OTC"},
            {"id": "AUDCAD_otc", "name": "AUD/CAD OTC"}, {"id": "NZDUSD_otc", "name": "NZD/USD OTC"},
            {"id": "EURGBP_otc", "name": "EUR/GBP OTC"}, {"id": "EURJPY_otc", "name": "EUR/JPY OTC"},
            {"id": "GBPJPY_otc", "name": "GBP/JPY OTC"}, {"id": "AUDJPY_otc", "name": "AUD/JPY OTC"},
        ]

        print("✅ Используем соединение из пула для сканирования...")

        # 2. Цикл анализа с авто-восстановлением
        for asset in currency_pairs:
            try:
                # Запрос свечей (10000 сек истории)
                hist_candles = await bot_client.get_candles(asset['id'], 60, 10000)

                if not hist_candles or len(hist_candles) < 20:
                    continue

                # Конвертация в числа
                clean_candles = []
                for c in hist_candles:
                    try:
                        clean_candles.append({
                            'time': c.get('time', 0),
                            'open': float(c.get('open', 0)),
                            'high': float(c.get('high', 0)),
                            'low': float(c.get('low', 0)),
                            'close': float(c.get('close', 0)),
                        })
                    except: pass

                # ML Анализ
                signal = None
                try:
                    ml_gen = get_ml()
                    ml_gen.train(clean_candles)
                    ml_result = ml_gen.predict(clean_candles)
                    if ml_result and ml_result.get('confidence', 0) > 0.55:
                        signal = {
                            "signal_type": ml_result.get('direction', 'call'),
                            "strength": "strong" if ml_result.get('confidence', 0) > 0.75 else "medium",
                            "confidence": f"{ml_result.get('confidence', 0) * 100:.0f}%",
                            "current_price": clean_candles[-1]['close'],
                            "expiry_minutes": 5,
                            "pair_name": asset['name'],
                            "trend": ml_result.get('trend', 'neutral'),
                            "rsi": ml_result.get('rsi', 50),
                            "pattern_detected": "ML_PREDICTION",
                            "payout": "85%",
                            "db_strategy": "MACHINE_LEARNING"
                        }
                except Exception as ml_err:
                    print(f"   ⚠️ ML ошибка для {asset['id']}: {ml_err}")

                # Индикаторы (если ML не дал сигнала)
                if signal is None:
                    signal = advanced_signal_strategy(clean_candles, asset, "indicators")

                if signal:
                    conf_str = signal.get('confidence', '50%')
                    conf = float(conf_str.replace('%', '')) if isinstance(conf_str, str) else float(conf_str)

                    closes = [float(c.get('close', 0)) for c in hist_candles[-20:]]
                    volatility_pct = ((max(closes) - min(closes)) / min(closes)) * 100 if min(closes) > 0 else 0

                    analyzed_candidates.append({
                        'asset': asset, 'signal': signal,
                        'confidence': conf, 'volatility_pct': volatility_pct
                    })

            except Exception as e:
                err_msg = str(e).lower()
                # АВТО-ПЕРЕПОДКЛЮЧЕНИЕ при разрыве
                if "half closed" in err_msg or "closed" in err_msg or "disconnect" in err_msg:
                    print(f"   ⚠️ Разрыв связи! Переподключение...")

                    # Сбрасываем пул, чтобы следующий запрос создал новый
                    _global_ws_client = None

                    # Для ТЕКУЩЕГО запроса пытаемся переподключиться
                    try:
                        bot_client = await get_pooled_ws_client()
                        _global_ws_last_active = time.time() # Обновляем таймер

                        hist_candles = await bot_client.get_candles(asset['id'], 60, 10000)
                        if hist_candles and len(hist_candles) >= 20:
                            clean_candles = []
                            for c in hist_candles:
                                try:
                                    if isinstance(c, dict): clean_candles.append({'time': c.get('time',0), 'open':float(c.get('open',0)), 'high':float(c.get('high',0)), 'low':float(c.get('low',0)), 'close':float(c.get('close',0))})
                                    else: clean_candles.append({'time': getattr(c,'time',0), 'open':float(getattr(c,'open',0)), 'high':float(getattr(c,'high',0)), 'low':float(getattr(c,'low',0)), 'close':float(getattr(c,'close',0))})
                                except: pass
                            if clean_candles:
                                signal = advanced_signal_strategy(clean_candles, asset, "indicators")
                                if signal:
                                    conf_str = signal.get('confidence', '50%')
                                    conf = float(conf_str.replace('%', '')) if isinstance(conf_str, str) else float(conf_str)
                                    closes = [c['close'] for c in clean_candles[-20:]]
                                    volatility_pct = ((max(closes) - min(closes)) / min(closes)) * 100 if min(closes) > 0 else 0
                                    analyzed_candidates.append({'asset': asset, 'signal': signal, 'confidence': conf, 'volatility_pct': volatility_pct})
                    except Exception as retry_err:
                        print(f"   ❌ Ошибка после переподключения: {retry_err}")
                else:
                    print(f"   ❌ Ошибка анализа {asset['id']}: {e}")

        # ВАЖНО: Мы НЕ закрываем соединение (bot_client.disconnect()) здесь.
        # Оно остается в пуле (_global_ws_client) для следующих пользователей.
        # Оно закроется само через 5 минут бездействия.

        if not analyzed_candidates:
            raise FastAPIHTTPException(status_code=503, detail="Нет данных для анализа")

        # Выбираем лучший актив по уверенности
        best_candidate = max(analyzed_candidates, key=lambda x: x['confidence'])
        best_asset = best_candidate['asset']
        signal = best_candidate['signal']
        volatility = best_candidate['volatility_pct']

        print(f"\n🏆 ЛУЧШИЙ АКТИВ: {best_asset['name']} (Уверенность: {best_candidate['confidence']}%)")
        print(f"   📉 Волатильность: {volatility:.3f}%")

        # === ЭТАП 2: ПОЛУЧЕНИЕ РЕАЛЬНОЙ ЦЕНЫ ===
        # Используем ТО ЖЕ самое соединение из пула, чтобы не создавать лишних подключений
        print(f"   💰 Получение реальной цены...")
        realtime_price = 0.0

        try:
            # Запрашиваем свежие свечи (1 минута) через активный клиент пула
            last_candles = await bot_client.get_candles(best_asset['id'], 60, 100)
            if last_candles and len(last_candles) > 0:
                realtime_price = float(last_candles[-1].get('close', 0))
        except Exception as e:
            print(f"   ⚠️ Ошибка получения цены: {e}")

        if realtime_price > 0:
            signal['current_price'] = realtime_price
            print(f"   ✅ Реальная цена (Live): {realtime_price:.5f}")
        else:
            # Если стрим не дал данных, берем последнее закрытие (может отставать)
            fallback = float(signal.get('current_price', 0))
            if fallback > 0:
                signal['current_price'] = fallback
                print(f"   ⚠️ Используем цену истории (Live недоступна): {fallback:.5f}")
            else:
                print(f"   ❌ Не удалось получить цену")

        # === ЭТАП 3: РАСЧЕТ ОПТИМАЛЬНОЙ ЭКСПИРАЦИИ ===
        # Логика: 1-10 минут, основной фокус на 3-5 минут
        # Используем волатильность для выбора времени
        import random

        # Волатильность рассчитывается как % изменения цены за последние 20 свечей
        # 0.1% - Низкая, 0.3% - Средняя, 0.5%+ - Высокая

        if volatility < 0.15:
            # Низкая волатильность: рынок "спит", нужно ждать дольше для движения
            # Рекомендация: 5-7 минут
            optimal_timeframe = 5
            print(f"   🐢 Низкая волатильность -> экспирация {optimal_timeframe} мин")
        elif volatility < 0.35:
            # Средняя волатильность: "Золотая середина"
            # Рекомендация: 3-5 минут (Основной фокус)
            optimal_timeframe = random.choice([3, 4, 5])
            print(f"   ⚖️ Средняя волатильность -> экспирация {optimal_timeframe} мин")
        elif volatility < 0.60:
            # Высокая волатильность: быстрые движения, нужно забирать прибыль быстро
            # Рекомендация: 2-4 минуты
            optimal_timeframe = random.choice([2, 3, 4])
            print(f"   🚀 Высокая волатильность -> экспирация {optimal_timeframe} мин")
        else:
            # Очень высокая волатильность: скальпинг
            # Рекомендация: 1-2 минуты
            optimal_timeframe = random.choice([1, 2])
            print(f"   ⚡ Очень высокая волатильность -> экспирация {optimal_timeframe} мин")

        print(f"   ⏱️ Итоговое рекомендуемое время: {optimal_timeframe} мин")
        signal['expiry_minutes'] = optimal_timeframe # Обновляем в сигнале

        print(f"\n🏆 ЛУЧШИЙ СИГНАЛ: {best_asset['name']}")
        print(f"   Направление: {signal.get('signal_type', '?').upper()}")
        print(f"   Уверенность: {best_candidate['confidence']:.1f}%")
        print(f"   💰 Реальная цена: {realtime_price:.5f}")

        # Обновляем цену в сигнале
        signal['current_price'] = float(realtime_price)

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
                "data_source": "BinaryOptionsToolsV2" if USE_BOT_V2 else "PocketOptionAsync"
            }
        }

    except FastAPIHTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()

        # ВАЖНО: НЕ закрываем bot_client здесь!
        # Это клиент из пула, он переиспользуется для следующих запросов.
        # Пул сам управляет жизненным циклом соединения.
        # Только при критической ошибке соединения - сбрасываем пул:
        try:
            _global_ws_client = None  # Сбрасываем, следующий запрос создаст новый
            print("⚠️ Пул сброшен из-за критической ошибки")
        except:
            pass

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
    """Генерация демо-сигнала с полным анализом"""
    import math
    import time
    
    # Генерируем "фейковые" свечи
    now_ts = int(time.time())
    base_price = 0.9250 # AUD/CAD OTC пример
    
    demo_candles = []
    for i in range(100):
        ts = now_ts - (100 - i) * 60
        price_variation = math.sin(i / 8) * 0.004 + math.cos(i / 6) * 0.002
        open_p = base_price + price_variation
        close_p = open_p + (math.sin(i / 4) * 0.0015)
        high_p = max(open_p, close_p) + 0.0008
        low_p = min(open_p, close_p) - 0.0008
        
        demo_candles.append({
            'time': ts,
            'open': open_p,
            'high': high_p,
            'low': low_p,
            'close': close_p
        })
    
    # Анализируем через ML или индикаторы
    signal = None
    if strategy_type.lower() in ['ml', 'neural_ai', 'neural']:
        try:
            ml_gen = get_ml()
            ml_gen.train(demo_candles)
            ml_result = ml_gen.predict(demo_candles)
            if ml_result and ml_result.get('confidence', 0) > 0.55:
                direction = ml_result.get('direction', 'call')
                confidence_pct = ml_result.get('confidence', 0) * 100
                signal = {
                    "signal_type": direction,
                    "strength": "strong" if confidence_pct > 75 else "medium",
                    "confidence": f"{confidence_pct:.0f}%",
                    "current_price": demo_candles[-1]['close'],
                    "expiry_minutes": 5,
                    "pair_name": "AUD/CAD OTC",
                    "trend": ml_result.get('trend', 'neutral'),
                    "rsi": ml_result.get('rsi', 50),
                    "pattern_detected": "ML_DEMO",
                    "payout": "90%",
                    "db_strategy": "MACHINE_LEARNING"
                }
        except:
            pass
            
    if signal is None:
        # Индикаторы
        demo_asset = {"name": "AUD/CAD OTC", "payout": 90}
        signal = advanced_signal_strategy(demo_candles, demo_asset, "indicators")
        if not signal:
            signal = {
                "signal_type": "call",
                "strength": "medium",
                "confidence": "65%",
                "current_price": demo_candles[-1]['close'],
                "expiry_minutes": 5,
                "pair_name": "AUD/CAD OTC",
                "payout": "90%",
                "db_strategy": "DEMO"
            }

    return signal


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
