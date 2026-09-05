

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, status, Query
from app.dependencies import get_current_user
from app.models import User
from app.signal_learning import resolve_signal_outcome
router = APIRouter(prefix="/api", tags=["Signals"])

# === РУЧНОЙ ЭНДПОИНТ ДЛЯ РАЗРЕШЕНИЯ СИГНАЛА ===
@router.post("/po/signal/resolve/{signal_id}", response_model=dict)
async def manual_resolve_signal(signal_id: int, current_user: User = Depends(get_current_user)):
    """
    Ручной запуск авторазрешения сигнала (win/lose) по signal_id.
    Используйте после истечения экспирации, если автомат не сработал.
    """
    result = await resolve_signal_outcome(signal_id)
    return result
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
from app.po_models import POSignal, SignalDirection, SignalStrength, SignalStatus, SignalResult, StrategyType
from app.config import get_settings
from app.ml_signal_generator import get_ml_generator
from app.advanced_signal_analyzer import AdvancedSignalAnalyzer
from app.entry_point_analyzer import calculate_optimal_entry_and_expiry
from app.unified_signal_engine import get_unified_signal
from app.po_strategies_advanced import advanced_signal_strategy, calculate_support_resistance_levels
from app.po_strategies_enhanced import (
    detect_candlestick_patterns,
    analyze_trend_strength,
    analyze_volume_profile,
    combined_strategy_analysis,
    evaluate_entry_points
)
from app.po_strategies_smart import get_smart_signal
from app.po_strategies_ml_safe import get_safe_ml_signal
from app.signal_limits import get_signal_limits, get_next_limit_balance
from app.signal_learning import queue_signal_resolution, serialize_candles
# Используем BinaryOptionsToolsV2 для получения актуальных цен
try:
    from BinaryOptionsToolsV2 import PocketOptionAsync
    from BinaryOptionsToolsV2.config import Config
    USE_BOT_V2 = True
except ImportError:
    USE_BOT_V2 = False
    try:
        from pocketoptionapi_async.client import AsyncPocketOptionClient
    except ImportError:
        AsyncPocketOptionClient = None
    Config = None

settings = get_settings()

# ============================================================
# CONNECTION POOL + QUEUE для множественных пользователей
# ============================================================
# Один клиент BinaryOptionsToolsV2 обслуживает ВСЕХ пользователей
# Запросы ставятся в очередь и обрабатываются последовательно

# Глобальный клиент (переиспользуется)
_shared_client = None
_shared_client_lock = asyncio.Lock()
_shared_client_request_lock = asyncio.Lock()
_shared_client_last_used = 0
_shared_client_max_idle = 300  # 5 минут бездействия


async def _close_shared_client(client=None):
    """Invalidate and close a shared client after a transport failure."""
    global _shared_client, _shared_client_last_used

    async with _shared_client_lock:
        current_client = _shared_client
        if client is not None and current_client is not client:
            return

        _shared_client = None
        _shared_client_last_used = 0

    if current_client is not None:
        try:
            await current_client.shutdown()
        except Exception as close_error:
            print(f"⚠️ Ошибка закрытия PO-соединения: {close_error}")


async def get_shared_client(force_refresh: bool = False):
    """
    Возвращает общий клиент для всех пользователей.
    Если клиента нет или он устарел (> 5 мин) → пересоздает.
    Встроенный reconnect автоматически работает.
    """
    global _shared_client, _shared_client_last_used

    async with _shared_client_lock:
        now = time.time()

        # Если клиент жив и использовался < 5 мин назад → используем его
        if not force_refresh and _shared_client is not None and (now - _shared_client_last_used) < _shared_client_max_idle:
            _shared_client_last_used = now
            return _shared_client

        # Если клиент старый → закрываем
        if _shared_client is not None:
            try:
                print("♻️ Старое соединение устарело, закрываем...")
                await _shared_client.shutdown()
            except:
                pass
            _shared_client = None

        # Создаем новое с встроенным reconnect
        ssid = settings.POCKETOPTION_SESSION_TOKEN

        if USE_BOT_V2:
            config = Config(
                reconnect_time=5,
                max_allowed_loops=100,
                connection_initialization_timeout_secs=30,
                timeout_secs=30
            )
            _shared_client = PocketOptionAsync(ssid=ssid, config=config)
        else:
            is_demo_mode = '"isDemo":1' in ssid or '"isDemo": 1' in ssid
            _shared_client = AsyncPocketOptionClient(ssid=ssid, is_demo=is_demo_mode, enable_logging=False)

        print("🔌 Создание нового общего соединения с PO...")
        await _shared_client.connect()

        if USE_BOT_V2:
            try:
                print("⏳ Ожидание активов...")
                await asyncio.wait_for(_shared_client.wait_for_assets(timeout=30.0), timeout=35.0)
                print("✅ Активы загружены!")
            except Exception as e:
                print(f"⚠️ Ошибка загрузки активов: {e}")
                await asyncio.sleep(2)

        _shared_client_last_used = time.time()
        print("✅ Новое соединение создано и готово к работе.")

        return _shared_client


# Очередь запросов (чтобы не было race conditions)
_request_queue = asyncio.Queue()
_processing_lock = asyncio.Lock()

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
    print("🔌 Закрытие PO соединений...")
    await _close_shared_client()
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

    # Для Demo используем демо-данные с полным анализом
    if market.lower() == "demo":
        print(f"\n📊 ========== ЗАПРОС СИГНАЛА (DEMO) ==========")
        print(f"Пользователь: {current_user.email} (ID: {current_user.id})")
        timeframe = data.get("timeframe", "1")
        strategy_type = data.get("strategy", data.get("ai_type", data.get("aiType", "indicators")))
        return await get_demo_signal_otc(current_user, db, timeframe, strategy_type)

    # Для OTC используем реальный счет
    try:
        market = data.get("market", "otc")
        timeframe = data.get("timeframe", "1")
        strategy_type = data.get("strategy", data.get("ai_type", data.get("aiType", "indicators")))
        min_payout = data.get("min_payout", 80)

        print(f"\n📊 ========== ЗАПРОС СИГНАЛА (OTC) ==========")
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

        # === ГЕНЕРАЦИЯ СИГНАЛА (Connection Pool для множественных пользователей) ===
        print(f"\n🚀 Начинаем генерацию сигнала...")
        print(f"📡 BinaryOptionsToolsV2 с Connection Pool + встроенным reconnect")

        analyzed_candidates = []
        observed_candidates = []

        # OTC активы для анализа
        otc_pairs = [
            {"id": "EURUSD_otc", "name": "EUR/USD OTC", "payout": 85, "type": "otc"},
            {"id": "GBPUSD_otc", "name": "GBP/USD OTC", "payout": 85, "type": "otc"},
            {"id": "AUDUSD_otc", "name": "AUD/USD OTC", "payout": 85, "type": "otc"},
            {"id": "USDJPY_otc", "name": "USD/JPY OTC", "payout": 85, "type": "otc"},
            {"id": "USDCAD_otc", "name": "USD/CAD OTC", "payout": 85, "type": "otc"},
            {"id": "USDCHF_otc", "name": "USD/CHF OTC", "payout": 85, "type": "otc"},
            {"id": "AUDCAD_otc", "name": "AUD/CAD OTC", "payout": 85, "type": "otc"},
            {"id": "NZDUSD_otc", "name": "NZD/USD OTC", "payout": 85, "type": "otc"},
            {"id": "EURGBP_otc", "name": "EUR/GBP OTC", "payout": 85, "type": "otc"},
            {"id": "EURJPY_otc", "name": "EUR/JPY OTC", "payout": 85, "type": "otc"},
            {"id": "GBPJPY_otc", "name": "GBP/JPY OTC", "payout": 85, "type": "otc"},
            {"id": "AUDJPY_otc", "name": "AUD/JPY OTC", "payout": 85, "type": "otc"},
        ]
        
        # Обычные FORWARD активы
        
        
        # Объединяем оба списка
        currency_pairs = otc_pairs 

        print(f"📊 Начинаем сканирование {len(currency_pairs)} активов ({len(otc_pairs)} OTC FORWARD)...")

        try:
            timeframe_text = str(timeframe).lower().replace('m', '').strip()
            requested_minutes = max(1, int(float(timeframe_text)))
        except (TypeError, ValueError):
            requested_minutes = 1
        candle_period = requested_minutes * 60
        history_offset = max(10000, candle_period * 200)

        # Получаем общий клиент (переиспользуется между пользователями!)
        client = await get_shared_client()

        try:
            # Анализируем каждый актив
            failed_assets = 0
            max_failed = 5

            for asset in currency_pairs:
                try:
                    print(f"\n📈 Анализ {asset['name']}...")

                    # The library uses this argument as the historical offset;
                    # 10000 returns the available OTC history for analysis.
                    async with _shared_client_request_lock:
                        hist_candles = await client.get_candles(asset['id'], candle_period, history_offset)

                    if not hist_candles or len(hist_candles) < 20:
                        print(f"   ⚠️ Недостаточно данных ({len(hist_candles) if hist_candles else 0} свечей)")
                        continue

                    print(f"   ✅ Получено {len(hist_candles)} свечей")

                    # Конвертация в формат для анализа
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

                    if len(clean_candles) < 20:
                        continue

                    observed_candidates.append({
                        'asset': asset,
                        'candles': clean_candles,
                        'unified': get_unified_signal(clean_candles),
                    })

                    # ==========================================================
                    # УНИФИЦИРОВАННЫЙ АНАЛИЗ (все стратегии + entry + expiry)
                    # ==========================================================
                    
                    unified_result = get_unified_signal(clean_candles)
                    
                    direction = unified_result.get('signal')
                    final_confidence = unified_result.get('confidence', 0)
                    optimal_expiry = unified_result.get('expiry', 5)
                    entry_quality = unified_result.get('entry_quality', 50)
                    strategies_used = unified_result.get('strategies_used', [])
                    best_strategy = unified_result.get('best_strategy', 'unknown')
                    fallback = unified_result.get('fallback', False)
                    
                    signal = None
                    
                    if direction and final_confidence > 45:
                        print(f"   🎯 УНИФИЦИРОВАННЫЙ АНАЛИЗ:")
                        print(f"      Сигнал: {direction.upper()}")
                        print(f"      Уверенность: {final_confidence:.0f}%")
                        print(f"      Экспирация: {optimal_expiry}м")
                        print(f"      Качество entrada: {entry_quality:.0f}%")
                        print(f"      Стратегии: {', '.join(strategies_used)}")
                        if fallback:
                            print(f"      ⚠️  Режим FALLBACK (LIMITED MODE)")
                        
                        # Финальная проверка по entry качеству
                        if entry_quality < 60:
                            print(f"   ❌ Точка входа критически плохая ({entry_quality:.0f}%) - ОТМЕНА")
                            direction = None
                            signal = None
                        else:
                            # Корректировка confidence по entry quality
                            if entry_quality >= 80:
                                confidence_adjustment = 5
                            elif entry_quality >= 60:
                                confidence_adjustment = 0
                            else:
                                confidence_adjustment = -5
                            
                            final_confidence = max(40, min(98, final_confidence + confidence_adjustment))
                            
                            signal = {
                                "signal_type": direction,
                                "strength": "strong" if final_confidence > 80 else ("medium" if final_confidence > 65 else "weak"),
                                "confidence": f"{final_confidence:.0f}%",
                                "current_price": clean_candles[-1]['close'],
                                "expiry_minutes": optimal_expiry,
                                "pair_name": asset['name'],
                                "trend": unified_result.get('trend', 'neutral'),
                                "rsi": unified_result.get('rsi', 50),
                                "pattern_detected": best_strategy.upper(),
                                "payout": "85%",
                                "db_strategy": "UNIFIED_ANALYSIS",
                                "entry_quality": f"{entry_quality:.0f}%",
                                "strategies_count": len(strategies_used)
                            }
                    
                    # Добавляем в кандидаты
                    if signal:
                        try:
                            closes = [c['close'] for c in clean_candles[-20:]]
                            volatility_pct = ((max(closes) - min(closes)) / min(closes)) * 100 if min(closes) > 0 else 0

                            # Безопасное получение уверенности из словаря сигнала
                            final_conf_str = signal.get('confidence', '50%')
                            final_conf = float(final_conf_str.replace('%', '')) if isinstance(final_conf_str, str) else 50.0

                            analyzed_candidates.append({
                                'asset': asset,
                                'signal': signal,
                                'confidence': final_conf,
                                'volatility_pct': volatility_pct,
                                'candles_count': len(clean_candles),
                                'candles': clean_candles,
                                'best_strategy': best_strategy,
                                'strategies_used': strategies_used,
                                'entry_quality': entry_quality,
                                'sr_levels': signal.get('support_resistance', {}),
                                'combined_analysis': signal.get('strategy_consensus', {}),
                                'pro_analysis': signal.get('pro_consensus', {})
                            })
                            print(f"   ✅ Кандидат: {final_conf:.0f}% уверенности, волатильность {volatility_pct:.2f}%")
                        except Exception as add_err:
                            print(f"   ❌ Ошибка добавления кандидата: {add_err}")

                except Exception as e:
                    failed_assets += 1
                    print(f"   ❌ Ошибка анализа {asset['id']}: {e}")

                    # A closed channel cannot be repaired reliably by reusing
                    # the same client. Drop it and create a fresh connection.
                    if USE_BOT_V2:
                        print(f"   🔄 Пересоздаём соединение...")
                        try:
                            await _close_shared_client(client)
                            client = await get_shared_client(force_refresh=True)
                            print(f"   ✅ Новое соединение создано")
                        except Exception as reconnect_err:
                            print(f"   ❌ Пересоздание соединения не удалось: {reconnect_err}")

                    if failed_assets >= max_failed:
                        print(f"   ⚠️ Слишком много ошибок ({failed_assets}), останавливаем")
                        break

                    # Пауза перед следующим активом
                    await asyncio.sleep(1)

        except Exception as e:
            print(f"❌ Критическая ошибка анализа: {e}")
            import traceback
            traceback.print_exc()
            raise

        # === Выбираем лучший актив по уверенности ===
        if not analyzed_candidates:
            if not observed_candidates:
                raise FastAPIHTTPException(status_code=503, detail="Нет данных для анализа")

            # Last-resort response: always return an explicit low-confidence
            # signal rather than inventing a strong setup from missing data.
            fallback_candidate = max(
                observed_candidates,
                key=lambda item: item['unified'].get('confidence', 0)
            )
            fallback_candles = fallback_candidate['candles']
            closes = [c['close'] for c in fallback_candles[-3:]]
            fallback_direction = 'call' if closes[-1] >= closes[0] else 'put'
            fallback_price = fallback_candles[-1]['close']
            fallback_signal = {
                'signal_type': fallback_direction,
                'strength': 'weak',
                'confidence': '50%',
                'current_price': fallback_price,
                'expiry_minutes': requested_minutes,
                'pair_name': fallback_candidate['asset']['name'],
                'trend': 'bullish' if fallback_direction == 'call' else 'bearish',
                'rsi': 50,
                'pattern_detected': 'LOW_CONFIDENCE_FALLBACK',
                'payout': '85%',
                'db_strategy': 'LOW_CONFIDENCE_FALLBACK',
                'entry_quality': '0%',
                'warning': 'Нет подтверждённого торгового сетапа; сигнал резервный',
            }
            analyzed_candidates.append({
                'asset': fallback_candidate['asset'],
                'signal': fallback_signal,
                'confidence': 50.0,
                'volatility_pct': 0.0,
                'candles_count': len(fallback_candles),
                'candles': fallback_candles,
                'best_strategy': 'LOW_CONFIDENCE_FALLBACK',
                'strategies_used': [],
                'entry_quality': 0,
            })

        # Сортируем по уверенности
        analyzed_candidates.sort(key=lambda x: x['confidence'], reverse=True)

        best_candidate = analyzed_candidates[0]
        best_asset = best_candidate['asset']
        signal = best_candidate['signal']
        volatility = best_candidate['volatility_pct']
        best_candles = best_candidate.get('candles', [])
        best_strategy = best_candidate.get('best_strategy', 'unknown')
        strategies_used = best_candidate.get('strategies_used', [])
        entry_quality = best_candidate.get('entry_quality', 50)
        signal_strength_value = signal.get('strength', 'weak')

        print(f"\n{'='*60}")
        print(f"🏆 ЛУЧШИЙ АКТИВ: {best_asset['name']}")
        print(f"   Уверенность: {best_candidate['confidence']}%")
        print(f"   Волатильность: {volatility:.2f}%")
        print(f"   Свечей проанализировано: {best_candidate['candles_count']}")
        
        # Показываем уровни поддержки/сопротивления
        if 'sr_levels' in best_candidate:
            sr = best_candidate['sr_levels']
            supp = sr.get('nearest_support')
            res = sr.get('nearest_resistance')
            
            if supp:
                # Handle both dict and float formats
                if isinstance(supp, dict):
                    print(f"   📊 Ближайшая поддержка: {supp.get('price', 0):.5f} (расст. {supp.get('distance_pct', 0):.2f}%)")
                else:
                    print(f"   📊 Ближайшая поддержка: {supp:.5f}")
            
            if res:
                if isinstance(res, dict):
                    print(f"   📊 Ближайшее сопротивление: {res.get('price', 0):.5f} (расст. {res.get('distance_pct', 0):.2f}%)")
                else:
                    print(f"   📊 Ближайшее сопротивление: {res:.5f}")
        
        print(f"{'='*60}")

        # === ПОЛУЧЕНИЕ REAL-TIME ЦЕНЫ через общий клиент ===
        print(f"\n💰 Получение real-time цены...")
        realtime_price = float(signal.get('current_price', 0))

        try:
            # Подписка на real-time обновления через общий клиент
            print(f"📡 Real-time стрим {best_asset['id']}...")
            prices = []

            async with _shared_client_request_lock:
                async for candle in await client.subscribe_symbol(best_asset['id']):
                    price = candle.get('close', candle.get('price', 0))
                    try:
                        price = float(price)
                        prices.append(price)
                        print(f"   💰 Цена: {price:.5f}")
                    except:
                        pass

                    if len(prices) >= 5:
                        break

            if prices:
                realtime_price = prices[-1]
                print(f"   ✅ Real-time цена: {realtime_price:.5f}")
            else:
                print(f"   ⚠️ Стрим не получен, используем историческую цену")

        except Exception as e:
            print(f"   ⚠️ Ошибка real-time: {e}")
            # Do not reuse a client whose channel has already failed.
            if USE_BOT_V2:
                try:
                    print(f"   🔄 Пересоздаём соединение после ошибки realtime...")
                    await _close_shared_client(client)
                    client = await get_shared_client(force_refresh=True)
                except:
                    pass

        historical_price = float(signal.get('current_price', 0))
        if historical_price > 0 and realtime_price > 0:
            price_drift_pct = abs(realtime_price - historical_price) / historical_price * 100
            print(f"   📏 Рассинхронизация истории и realtime: {price_drift_pct:.3f}%")

            # Allow normal movement during a multi-minute scan, but still
            # reject a genuinely stale analysis. The limit follows the
            # observed volatility and is capped to protect the entry.
            drift_limit_pct = max(0.15, min(0.35, volatility * 0.65))
            print(f"   📏 Допустимое расхождение: {drift_limit_pct:.3f}%")
            if price_drift_pct > drift_limit_pct:
                signal['confidence'] = '45%'
                signal['strength'] = 'weak'
                signal['warning'] = (
                    f"Цена изменилась на {price_drift_pct:.2f}% во время анализа; "
                    "уверенность снижена"
                )

        # Обновляем цену в сигнале
        signal['current_price'] = realtime_price

        # === РАСЧЕТ ЭКСПИРАЦИИ ===
        # Используем расширенную логику расчета
        
        # === РАСЧЁТ ОПТИМАЛЬНОЙ ЭКСПИРАЦИИ (1-15 минут) ===
        # На основе волатильности, уверенности сигнала и качества точки входа

        entry_score = best_candidate.get('entry_evaluation', {}).get('score', 50)
        trend_match = best_candidate.get('entry_evaluation', {}).get('is_good_entry', False)
        signal_confidence = float(best_candidate['confidence'])

        # 1. Базовая экспирация от волатильности (расширенный диапазон)
        if volatility < 0.10:
            base_expiry = 12  # Очень низкая -> долго ждем
        elif volatility < 0.20:
            base_expiry = 10  # Низкая волатильность
        elif volatility < 0.35:
            base_expiry = 8   # Средняя-низкая
        elif volatility < 0.50:
            base_expiry = 6   # Средняя
        elif volatility < 0.70:
            base_expiry = 5   # Средняя-высокая
        elif volatility < 1.0:
            base_expiry = 3   # Высокая -> быстрее
        else:
            base_expiry = 1   # Очень высокая -> скальпинг

        # 2. Корректировка от уверенности сигнала
        confidence_adjustment = 0
        if signal_confidence >= 85:
            # Очень высокая уверенность -> можно дольше держать
            confidence_adjustment = 2
        elif signal_confidence >= 75:
            confidence_adjustment = 1
        elif signal_confidence >= 65:
            confidence_adjustment = 0
        elif signal_confidence < 55:
            # Низкая уверенность -> быстро выходим
            confidence_adjustment = -2

        # 3. Корректировка от качества входа
        entry_adjustment = 0
        if entry_score >= 80:
            entry_adjustment = 2  # Отличный вход
        elif entry_score >= 65:
            entry_adjustment = 1
        elif entry_score >= 50:
            entry_adjustment = 0
        elif entry_score < 40:
            entry_adjustment = -2  # Плохой вход

        # 4. Корректировка от тренда
        trend_adjustment = 0
        if trend_match:
            trend_adjustment = 2  # Тренд совпадает -> даем время
        else:
            trend_adjustment = -1  # Тренд против -> быстрее выходим

        # Итоговая экспирация (от 1 до 15 минут)
        optimal_timeframe = max(1, min(15, base_expiry + confidence_adjustment + entry_adjustment + trend_adjustment))

        # Рассчитываем уверенность успешности сигнала
        # На основе совпадения всех факторов
        success_confidence = 50  # базовая

        # Вклад волатильности (оптимальная волатильность 0.3-0.7)
        if 0.3 <= volatility <= 0.7:
            success_confidence += 15
        elif 0.2 <= volatility < 0.3 or 0.7 < volatility <= 1.0:
            success_confidence += 10
        else:
            success_confidence += 5

        # Вклад уверенности сигнала
        success_confidence += (signal_confidence - 50) * 0.4

        # Вклад качества входа
        success_confidence += (entry_score - 50) * 0.2

        # Вклад тренда
        if trend_match:
            success_confidence += 10
        else:
            success_confidence -= 5

        success_confidence = max(50, min(99, success_confidence))

        print(f"   ⏱️ База: {base_expiry} мин, Уверенность: {confidence_adjustment:+}, Вход: {entry_adjustment:+}, Тренд: {trend_adjustment:+}")
        print(f"   🎯 Оптимальная экспирация: {optimal_timeframe} мин")
        print(f"   📊 Уверенность успешности: {success_confidence:.1f}%")

        signal['expiry_minutes'] = optimal_timeframe
        signal['success_confidence'] = round(success_confidence, 1)

        print(f"\n🎯 ИТОГОВЫЙ СИГНАЛ:")
        print(f"   Актив: {best_asset['name']}")
        print(f"   Направление: {signal.get('signal_type', '?').upper()}")
        print(f"   Уверенность: {best_candidate['confidence']:.1f}%")
        print(f"   Цена: {realtime_price:.5f}")
        print(f"   Экспирация: {optimal_timeframe} мин")

        expires_at = datetime.utcnow() + timedelta(minutes=optimal_timeframe)

        strategy_type_enum = StrategyType.MACHINE_LEARNING if (
            strategy_type.lower() == 'ml' or 'ml' in best_strategy.lower()
        ) else StrategyType.INDICATORS

        po_signal = POSignal(
            signal_type=SignalDirection.CALL if signal.get('signal_type') == 'call' else SignalDirection.PUT,
            strength=SignalStrength.STRONG if signal_strength_value == 'strong' else SignalStrength.MEDIUM if signal_strength_value == 'moderate' else SignalStrength.WEAK,
            confidence=float(best_candidate['confidence']),
            asset_name=best_asset['name'],
            amount=1.0,
            timeframe=optimal_timeframe * 60,
            entry_price=float(realtime_price),
            current_price=float(realtime_price),
            strategy_type=strategy_type_enum,
            strategy_data={
                **signal,
                "market": market,
                "requested_strategy": strategy_type,
                "best_strategy": best_strategy,
                "strategies_used": strategies_used,
                "entry_quality": entry_quality,
            },
            status=SignalStatus.ACTIVE,
            activated_at=datetime.utcnow(),
            expires_at=expires_at,
            user_id=current_user.id,
            price_history=serialize_candles(best_candles),
            indicators_snapshot={
                "rsi": signal.get("rsi", 50),
                "trend": signal.get("trend", "neutral"),
                "volatility": signal.get("volatility", 0),
                "success_confidence": signal.get("success_confidence"),
            },
            rsi=signal.get("rsi", 50),
            notes=f"Generated by signal_po.py using {best_strategy}",
        )

        db.add(po_signal)

        # === СОХРАНЕНИЕ В БД ===
        try:
            signal_usage = SignalUsage(
                user_id=current_user.id,
                signal_data=json.dumps(signal),
                used_at=datetime.utcnow()
            )
            db.add(signal_usage)
            await db.commit()
            await db.refresh(po_signal)
            print(f"[DEBUG] queue_signal_resolution called for signal_id={po_signal.id}, expires_at={po_signal.expires_at}")
            import logging
            logging.getLogger("signal_po").info(f"[DEBUG] queue_signal_resolution called for signal_id={po_signal.id}, expires_at={po_signal.expires_at}")
            queue_signal_resolution(po_signal.id, po_signal.expires_at)
            print(f"✅ Сохранено в БД")
        except Exception as db_err:
            print(f"⚠️ Ошибка БД: {db_err}")
            try:
                await db.rollback()
            except:
                pass

        return {
            "success": True,
            "signal": format_signal_response(signal, user_balance, po_signal.id, po_signal.expires_at),
            "balance": float(user_balance),
            "market_data_summary": {
                "assets_analyzed": len(currency_pairs),
                "assets_with_signals": len(analyzed_candidates),
                "timeframe": timeframe,
                "market": market,
                "strategy": strategy_type,
                "min_payout": min_payout,
                "timestamp": datetime.utcnow().isoformat(),
                "data_source": "BinaryOptionsToolsV2 Real-time"
            }
        }

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


async def get_demo_signal_otc(current_user: User, db: AsyncSession, timeframe: str, strategy_type: str):
    """
    Демо сигнал для OTC с полным анализом (ML + стратегии + S/R)
    Не требует подключения к PocketOption
    """
    import math
    import time

    print(f"\n🎮 Генерация демо-сигнала (OTC)...")

    # Генерируем демо-свечи на основе текущего времени
    now_ts = int(time.time())
    base_price = 1.0850  # EUR/USD

    demo_candles = []
    for i in range(150):
        ts = now_ts - (150 - i) * 60
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

    # 1. ML анализ
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
                    "pair_name": "EUR/USD OTC",
                    "trend": ml_result.get('trend', 'neutral'),
                    "rsi": ml_result.get('rsi', 50),
                    "pattern_detected": "ML_DEMO",
                    "payout": "85%",
                    "db_strategy": "MACHINE_LEARNING",
                    "data_source": "demo_ml"
                }
                print(f"   🤖 ML сигнал: {direction.upper()} ({confidence_pct:.0f}%)")
        except Exception as e:
            print(f"⚠️ Демо ML ошибка: {e}")

    # 2. Комбинированный анализ стратегий
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
                "pair_name": "EUR/USD OTC",
                "trend": combined['strategies'].get('trend', {}).get('signal', 'neutral'),
                "rsi": 50,
                "pattern_detected": "COMBINED_STRATEGIES_DEMO",
                "payout": "85%",
                "db_strategy": "INDICATORS",
                "data_source": "demo_combined",
                "strategies_used": list(combined['strategies'].keys())
            }
            print(f"   🎯 Комбинированный анализ: {combined['signal'].upper()} ({combined_conf:.0f}%)")

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
        demo_asset = {"name": "EUR/USD OTC", "payout": 85}
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
                "pair_name": "EUR/USD OTC",
                "payout": "85%",
                "db_strategy": "INDICATORS",
                "data_source": "demo_fallback"
            }

    # Расчет экспирации
    volatility = 1.0
    if volatility < 0.5:
        optimal_timeframe = 7
    elif volatility > 2:
        optimal_timeframe = 3
    else:
        optimal_timeframe = 5

    signal['expiry_minutes'] = optimal_timeframe

    print(f"\n✅ ДЕМО СИГНАЛ СГЕНЕРИРОВАН:")
    print(f"   Пара: {signal['pair_name']}")
    print(f"   Направление: {signal['signal_type'].upper()}")
    print(f"   Уверенность: {signal['confidence']}")
    print(f"   Экспирация: {optimal_timeframe} мин")

    user_balance = current_user.balance if current_user.balance else 1000.0

    # Форматируем ответ
    return {
        "success": True,
        "signal": format_signal_response(signal, user_balance),
        "balance": user_balance,
        "market_data_summary": {
            "assets_analyzed": 1,
            "timeframe": timeframe,
            "market": "demo",
            "strategy": strategy_type,
            "data_source": "demo_with_full_analysis",
            "strategies": ["ML", "Combined Strategies", "Support/Resistance", "Indicators"],
            "timestamp": datetime.utcnow().isoformat()
        }
    }


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
        "payout": f"{asset['payout']}%",
        "db_strategy": "INDICATORS"
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


def format_signal_response(
    signal: dict,
    balance: float,
    db_signal_id: int | None = None,
    expires_at: datetime | None = None
) -> dict:
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
                expiry_time = expires_at or (datetime.utcnow() + timedelta(minutes=signal.get("expiry_minutes", 3)))
        except:
            expiry_time = expires_at or (datetime.utcnow() + timedelta(minutes=signal.get("expiry_minutes", 3)))

        try:
            if isinstance(valid_until_timestamp, str):
                valid_until = datetime.fromisoformat(valid_until_timestamp.replace('Z', '+00:00'))
            else:
                valid_until = datetime.utcnow() + timedelta(seconds=30)
        except:
            valid_until = datetime.utcnow() + timedelta(seconds=30)

        signal_strength = "strong" if confidence > 75 else "moderate" if confidence > 65 else "weak"

        # Получаем уверенность успешности сигнала
        success_conf = signal.get("success_confidence", confidence)

        return {
            "pair": signal.get("pair_name", "EUR/USD"),
            "direction": direction,
            "expiration": f"{signal.get('expiry_minutes', 3)} минут",
            "expiry_minutes": signal.get("expiry_minutes", 3),
            "expiry_time": expiry_time.strftime("%H:%M"),
            "valid_until": valid_until.strftime("%H:%M:%S"),
            "confidence": f"{int(confidence)}%",
            "success_confidence": round(float(success_conf), 1),
            "entry_price": f"{float(current_price):.5f}",
            "take_profit": f"{float(current_price) * tp_multiplier:.5f}",
            "stop_loss": f"{float(current_price) * sl_multiplier:.5f}",
            "signal_strength": signal_strength,
            "provider": "Pocket Option API",
            "payout": signal.get("payout", "80%"),
            "signal_id": f"po_{int(datetime.utcnow().timestamp())}",
            "db_signal_id": db_signal_id,
            "generated_at": datetime.utcnow().isoformat(),
            "expiry_timestamp": expiry_time.isoformat(),
            "reasoning": f"{signal.get('pair_name', 'EUR/USD')}: {direction} ({confidence}%). "
                        f"Экспирация: {signal.get('expiry_minutes', 3)} мин. "
                        f"Payout: {signal.get('payout', '80%')}",
            "volatility": signal.get("volatility", 0),
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


@router.get("/po/signal/{signal_id}", response_model=dict)
async def get_signal_status(
    signal_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return signal status and resolve it automatically after expiration."""
    result = await db.execute(
        select(POSignal).where(
            POSignal.id == signal_id,
            POSignal.user_id == current_user.id,
        )
    )
    signal = result.scalar_one_or_none()
    if signal is None:
        raise FastAPIHTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сигнал не найден")

    if signal.status != SignalStatus.COMPLETED and signal.expires_at:
        expires_at = signal.expires_at.replace(tzinfo=None) if signal.expires_at.tzinfo else signal.expires_at
        if datetime.utcnow() >= expires_at:
            await resolve_signal_outcome(signal_id)
            await db.refresh(signal)

    return {
        "success": True,
        "signal": {
            "id": signal.id,
            "signal_type": signal.signal_type.value,
            "asset_name": signal.asset_name,
            "status": signal.status.value,
            "result": signal.result.value if signal.result else SignalResult.PENDING.value,
            "profit_loss": signal.profit_loss,
            "entry_price": signal.entry_price,
            "current_price": signal.current_price,
            "expires_at": signal.expires_at.isoformat() if signal.expires_at else None,
            "completed_at": signal.completed_at.isoformat() if signal.completed_at else None,
        },
    }


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
