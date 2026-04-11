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
from app.po_strategies_advanced import advanced_signal_strategy, calculate_support_resistance_levels
from app.po_strategies_enhanced import (
    detect_candlestick_patterns,
    analyze_trend_strength,
    analyze_volume_profile,
    combined_strategy_analysis,
    evaluate_entry_points
)
from app.po_strategies_varied import get_varied_strategies_consensus
from app.signal_limits import get_signal_limits, get_next_limit_balance
# Используем BinaryOptionsToolsV2 для получения актуальных цен
try:
    from BinaryOptionsToolsV2 import PocketOptionAsync
    from BinaryOptionsToolsV2.config import Config
    USE_BOT_V2 = True
except ImportError:
    USE_BOT_V2 = False
    try:
        from app.pocketoptionapi_async.client import AsyncPocketOptionClient
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
_shared_client_last_used = 0
_shared_client_max_idle = 300  # 5 минут бездействия


async def get_shared_client():
    """
    Возвращает общий клиент для всех пользователей.
    Если клиента нет или он устарел (> 5 мин) → пересоздает.
    Встроенный reconnect автоматически работает.
    """
    global _shared_client, _shared_client_last_used

    async with _shared_client_lock:
        now = time.time()

        # Если клиент жив и использовался < 5 мин назад → используем его
        if _shared_client is not None and (now - _shared_client_last_used) < _shared_client_max_idle:
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
                timeout_secs=30,
                urls=[
                    "wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket",
                    "wss://api-us-north.po.market/socket.io/?EIO=4&transport=websocket"
                ]
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

        # Список OTC активов для анализа
        currency_pairs = [
            {"id": "EURUSD_otc", "name": "EUR/USD OTC", "payout": 85},
            {"id": "GBPUSD_otc", "name": "GBP/USD OTC", "payout": 85},
            {"id": "AUDUSD_otc", "name": "AUD/USD OTC", "payout": 85},
            {"id": "USDJPY_otc", "name": "USD/JPY OTC", "payout": 85},
            {"id": "USDCAD_otc", "name": "USD/CAD OTC", "payout": 85},
            {"id": "USDCHF_otc", "name": "USD/CHF OTC", "payout": 85},
            {"id": "AUDCAD_otc", "name": "AUD/CAD OTC", "payout": 85},
            {"id": "NZDUSD_otc", "name": "NZD/USD OTC", "payout": 85},
            {"id": "EURGBP_otc", "name": "EUR/GBP OTC", "payout": 85},
            {"id": "EURJPY_otc", "name": "EUR/JPY OTC", "payout": 85},
            {"id": "GBPJPY_otc", "name": "GBP/JPY OTC", "payout": 85},
            {"id": "AUDJPY_otc", "name": "AUD/JPY OTC", "payout": 85},
        ]

        print(f"📊 Начинаем сканирование {len(currency_pairs)} активов...")

        # Получаем общий клиент (переиспользуется между пользователями!)
        client = await get_shared_client()

        try:
            # Анализируем каждый актив
            failed_assets = 0
            max_failed = 5

            for asset in currency_pairs:
                try:
                    print(f"\n📈 Анализ {asset['name']}...")

                    # Получаем свечи (общий клиент, reconnect встроен!)
                    hist_candles = await client.get_candles(asset['id'], 60, 10000)

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

                    # ==========================================================
                    # УЛУЧШЕННАЯ ЛОГИКА АНАЛИЗА (CONSENSUS)
                    # ==========================================================
                    
                    # 1. ML Анализ (Мозг)
                    ml_result = None
                    ml_signal_data = None
                    try:
                        ml_gen = get_ml()
                        if ml_gen.train(clean_candles):
                            ml_res = ml_gen.predict(clean_candles)
                            # Строгий порог для ML (55%)
                            if ml_res and ml_res.get('confidence', 0) > 0.55:
                                ml_result = ml_res
                                ml_signal_data = {
                                    "signal_type": ml_res.get('direction', 'call'),
                                    "confidence": ml_res.get('confidence', 0) * 100,
                                    "source": "ML"
                                }
                                direction_emoji = "📈" if ml_signal_data['signal_type'] == 'call' else "📉"
                                print(f"   {direction_emoji} ML: {ml_signal_data['signal_type'].upper()} ({ml_signal_data['confidence']:.0f}%)")
                    except Exception as ml_err:
                        print(f"   ⚠️ ML ошибка: {ml_err}")

                    # 2. Индикаторы (Проверка здравого смысла)
                    ind_signal_data = None
                    try:
                        ind_res = advanced_signal_strategy(clean_candles, asset, "indicators")
                        if ind_res:
                            conf_str = ind_res.get('confidence', '0%')
                            conf_val = float(conf_str.replace('%', '')) if isinstance(conf_str, str) else 0
                            if conf_val > 55: # Строгий порог
                                ind_signal_data = {
                                    "signal_type": ind_res.get('signal_type', 'call'),
                                    "confidence": conf_val,
                                    "source": "INDICATORS"
                                }
                                print(f"   📊 Индикаторы: {ind_signal_data['signal_type'].upper()} ({ind_signal_data['confidence']:.0f}%)")
                    except Exception as ind_err:
                        print(f"   ⚠️ Индикаторы ошибка: {ind_err}")

                    # 3. Синтез Сигнала (Consensus)
                    signal = None
                    final_confidence = 0

                    if ml_signal_data:
                        # Есть сигнал от ML
                        direction = ml_signal_data['signal_type']
                        final_confidence = ml_signal_data['confidence']
                        
                        # Проверяем совпадение с индикаторами
                        if ind_signal_data:
                            if ind_signal_data['signal_type'] == direction:
                                # СОВПАДЕНИЕ! Усиливаем сигнал
                                final_confidence = (final_confidence + ind_signal_data['confidence']) / 2 + 10 # Бонус за согласие
                                print(f"   🤝 ML и Индикаторы совпали! Уверенность: {final_confidence:.0f}%")
                            else:
                                # КОНФЛИКТ! Понижаем уверенность
                                final_confidence -= 20 # Штраф за конфликт
                                print(f"   ⚠️ Конфликт: ML={direction}, Ind={ind_signal_data['signal_type']}. Скорр: {final_confidence:.0f}%")
                        
                        # Если после штрафов уверенность все еще высокая
                        if final_confidence > 60:
                            signal = {
                                "signal_type": direction,
                                "strength": "strong" if final_confidence > 80 else "medium",
                                "confidence": f"{final_confidence:.0f}%",
                                "current_price": clean_candles[-1]['close'],
                                "expiry_minutes": 5, # Будет пересчитано ниже
                                "pair_name": asset['name'],
                                "trend": ml_result.get('trend', 'neutral') if ml_result else 'neutral',
                                "rsi": ml_result.get('rsi', 50) if ml_result else 50,
                                "pattern_detected": "ML_CONSENSUS" if ind_signal_data else "ML_STRONG",
                                "payout": "85%",
                                "db_strategy": "MACHINE_LEARNING",
                                "ml_accuracy": ml_result.get('ml_accuracy', 0) if ml_result else 0
                            }
                    
                    elif ind_signal_data:
                        # ML не дал сигнала, но индикаторы очень уверены
                        if ind_signal_data['confidence'] > 75:
                            signal = {
                                "signal_type": ind_signal_data['signal_type'],
                                "strength": "medium",
                                "confidence": f"{ind_signal_data['confidence']:.0f}%",
                                "current_price": clean_candles[-1]['close'],
                                "expiry_minutes": 5,
                                "pair_name": asset['name'],
                                "trend": 'neutral',
                                "rsi": 50,
                                "pattern_detected": "INDICATORS_STRONG",
                                "payout": "85%",
                                "db_strategy": "INDICATORS"
                            }
                            print(f"   📊 Сильный сигнал индикаторов принят")

                    # 4. Оценка точки входа и доп. стратегий (Только если есть сигнал)
                    if signal:
                        try:
                            sr_levels = calculate_support_resistance_levels(clean_candles)
                            sig_type = signal.get('signal_type', 'call')
                            entry_eval = evaluate_entry_points(clean_candles, sig_type, sr_levels)
                            
                            # 5. Проверка дополнительными стратегиями (Voting System)
                            strategies_consensus = get_varied_strategies_consensus(clean_candles)
                            consensus_direction = strategies_consensus.get('signal')
                            
                            strategy_bonus = 0
                            strategy_penalty = 0
                            
                            if consensus_direction == sig_type:
                                # Совпадение!
                                votes = strategies_consensus.get('call_votes', 0) + strategies_consensus.get('put_votes', 0)
                                strategy_bonus = 5 * votes # +5, +10 или +15
                                print(f"   🗳️ Доп. стратегии подтверждают ({votes}/3). Бонус +{strategy_bonus}%")
                            elif consensus_direction is not None:
                                # Конфликт направлений
                                strategy_penalty = 15
                                print(f"   ⚠️ Конфликт с доп. стратегиями! ({sig_type} vs {consensus_direction}). Штраф -{strategy_penalty}%")
                            
                            # Жесткий фильтр: если точка входа плохая (<45%) ИЛИ сильный конфликт стратегий
                            if entry_eval.get('percentage', 0) < 45 or strategy_penalty >= 15:
                                if entry_eval.get('percentage', 0) < 45:
                                    print(f"   ❌ Точка входа слабая ({entry_eval.get('percentage', 0):.0f}%) - ОТМЕНА")
                                signal = None
                            else:
                                # Корректируем уверенность на основе точки входа и стратегий
                                entry_bonus = (entry_eval.get('percentage', 50) - 50) / 2 # +/- от 0 до 25%
                                total_adjustment = entry_bonus + strategy_bonus
                                
                                current_conf = float(signal.get('confidence', '60').replace('%', ''))
                                new_conf = max(50, min(98, current_conf + total_adjustment))
                                
                                signal['confidence'] = f"{new_conf:.0f}%"
                                signal['support_resistance'] = {
                                    'nearest_support': sr_levels.get('nearest_support', {}).get('price'),
                                    'nearest_resistance': sr_levels.get('nearest_resistance', {}).get('price'),
                                    'adjustment': total_adjustment
                                }
                                signal['entry_evaluation'] = {
                                    'score': entry_eval.get('percentage', 0),
                                    'reason': entry_eval.get('reason', '')
                                }
                                signal['strategy_consensus'] = strategies_consensus
                                
                                print(f"   🎯 Итоговая уверенность: {new_conf:.0f}% (Вход: {entry_eval.get('percentage', 0):.0f}%, Стратегии: {strategy_bonus:+})")
                        except Exception as eval_err:
                            print(f"   ⚠️ Ошибка оценки входа/стратегий: {eval_err}")

                    # Добавляем в кандидаты
                    if signal:
                        closes = [c['close'] for c in clean_candles[-20:]]
                        volatility_pct = ((max(closes) - min(closes)) / min(closes)) * 100 if min(closes) > 0 else 0

                        analyzed_candidates.append({
                            'asset': asset,
                            'signal': signal,
                            'confidence': conf,
                            'volatility_pct': volatility_pct,
                            'candles_count': len(clean_candles),
                            'sr_levels': sr_levels,
                            'combined_analysis': combined
                        })
                        print(f"   ✅ Кандидат: {conf}% уверенности, волатильность {volatility_pct:.2f}%")

                except Exception as e:
                    failed_assets += 1
                    print(f"   ❌ Ошибка анализа {asset['id']}: {e}")

                    # Используем встроенный reconnect
                    if USE_BOT_V2:
                        print(f"   🔄 Пробуем reconnect...")
                        try:
                            await client.reconnect()
                            await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
                            print(f"   ✅ Reconnect успешен")
                        except Exception as reconnect_err:
                            print(f"   ❌ Reconnect не удался: {reconnect_err}")

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
            raise FastAPIHTTPException(status_code=503, detail="Нет данных для анализа")

        # Сортируем по уверенности
        analyzed_candidates.sort(key=lambda x: x['confidence'], reverse=True)

        best_candidate = analyzed_candidates[0]
        best_asset = best_candidate['asset']
        signal = best_candidate['signal']
        volatility = best_candidate['volatility_pct']

        print(f"\n{'='*60}")
        print(f"🏆 ЛУЧШИЙ АКТИВ: {best_asset['name']}")
        print(f"   Уверенность: {best_candidate['confidence']}%")
        print(f"   Волатильность: {volatility:.2f}%")
        print(f"   Свечей проанализировано: {best_candidate['candles_count']}")
        
        # Показываем уровни поддержки/сопротивления
        if 'sr_levels' in best_candidate:
            sr = best_candidate['sr_levels']
            if sr.get('nearest_support'):
                print(f"   📊 Ближайшая поддержка: {sr['nearest_support']['price']:.5f} (расст. {sr['nearest_support']['distance_pct']:.2f}%)")
            if sr.get('nearest_resistance'):
                print(f"   📊 Ближайшее сопротивление: {sr['nearest_resistance']['price']:.5f} (расст. {sr['nearest_resistance']['distance_pct']:.2f}%)")
        
        print(f"{'='*60}")

        # === ПОЛУЧЕНИЕ REAL-TIME ЦЕНЫ через общий клиент ===
        print(f"\n💰 Получение real-time цены...")
        realtime_price = float(signal.get('current_price', 0))

        try:
            # Подписка на real-time обновления через общий клиент
            print(f"📡 Real-time стрим {best_asset['id']}...")
            prices = []

            async for candle in await client.subscribe_symbol(best_asset['id']):
                price = candle.get('close', candle.get('price', 0))
                try:
                    price = float(price)
                    prices.append(price)
                    print(f"   💰 Цена: {price:.5f}")
                except:
                    pass

                # Ждем 5 секунд для получения real-time цены
                if len(prices) >= 5:
                    break

            if prices:
                realtime_price = prices[-1]
                print(f"   ✅ Real-time цена: {realtime_price:.5f}")
            else:
                print(f"   ⚠️ Стрим не получен, используем историческую цену")

        except Exception as e:
            print(f"   ⚠️ Ошибка real-time: {e}")
            # Пробуем reconnect
            if USE_BOT_V2:
                try:
                    print(f"   🔄 Reconnect...")
                    await client.reconnect()
                    await asyncio.wait_for(client.wait_for_assets(timeout=30.0), timeout=35.0)
                except:
                    pass

        # Обновляем цену в сигнале
        signal['current_price'] = realtime_price

        # === РАСЧЕТ ЭКСПИРАЦИИ ===
        # Используем расширенную логику расчета
        
        entry_score = best_candidate.get('entry_evaluation', {}).get('score', 50)
        trend_match = best_candidate.get('entry_evaluation', {}).get('is_good_entry', False)
        
        # Базовая экспирация от волатильности
        if volatility < 0.15:
            base_expiry = 5  # Низкая волатильность -> дольше ждем движения
        elif volatility < 0.35:
            base_expiry = 3  # Средняя
        elif volatility < 0.60:
            base_expiry = 2  # Высокая -> быстрее забираем прибыль
        else:
            base_expiry = 1  # Очень высокая -> скальпинг

        # Корректировка от качества входа
        entry_adjustment = 0
        if entry_score >= 70:
            # Отличный вход -> можно держать дольше, так как сигнал надежный
            entry_adjustment = 1
        elif entry_score < 40:
            # Плохой вход -> если уж берем, то быстро, чтобы минимизировать риск
            entry_adjustment = -1

        # Корректировка от тренда
        trend_adjustment = 0
        if trend_match:
            # Если тренд совпадает, даем сделке время развиться
            trend_adjustment = 1
        else:
            # Если тренд против, лучше выйти быстрее
            trend_adjustment = -1

        # Итоговая экспирация (от 1 до 10 минут)
        optimal_timeframe = max(1, min(10, base_expiry + entry_adjustment + trend_adjustment))
        
        print(f"   ⏱️ База: {base_expiry} мин, Вход: {entry_adjustment:+}, Тренд: {trend_adjustment:+}")
        print(f"   🎯 Итоговая экспирация: {optimal_timeframe} мин")

        signal['expiry_minutes'] = optimal_timeframe

        print(f"\n🎯 ИТОГОВЫЙ СИГНАЛ:")
        print(f"   Актив: {best_asset['name']}")
        print(f"   Направление: {signal.get('signal_type', '?').upper()}")
        print(f"   Уверенность: {best_candidate['confidence']:.1f}%")
        print(f"   Цена: {realtime_price:.5f}")
        print(f"   Экспирация: {optimal_timeframe} мин")

        # === СОХРАНЕНИЕ В БД ===
        try:
            signal_usage = SignalUsage(
                user_id=current_user.id,
                signal_data=json.dumps(signal),
                used_at=datetime.utcnow()
            )
            db.add(signal_usage)
            await db.commit()
            print(f"✅ Сохранено в БД")
        except Exception as db_err:
            print(f"⚠️ Ошибка БД: {db_err}")
            try:
                await db.rollback()
            except:
                pass

        return {
            "success": True,
            "signal": format_signal_response(signal, user_balance),
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
