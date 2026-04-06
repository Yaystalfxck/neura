from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime, timedelta
import json
import os
import asyncio
import random

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, SignalUsage, PocketOptionUser
from app.balance_utils import get_user_balance
from app.po_models import POSignal
from app.config import get_settings
from app.ml_signal_generator import get_ml_generator
from pocketoptionapi_async.client import AsyncPocketOptionClient
from app.po_strategies_advanced import advanced_signal_strategy

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
# Connection Pool — как в PocketOptionAPI
# ============================================================

class POConnectionPool:
    """
    Пул соединений с PocketOption — как в библиотеке ChipaDevTeam/PocketOptionAPI
    
    Один пул на всё приложение, переиспользуется всеми запросами.
    Автоматический reconnect + keepalive.
    """
    
    def __init__(self):
        self._client: Optional[AsyncPocketOptionClient] = None
        self._client_demo: Optional[AsyncPocketOptionClient] = None
        self._is_demo = False
        self._lock = asyncio.Lock()
    
    async def get_client(self, is_demo: bool = False) -> Optional[AsyncPocketOptionClient]:
        """
        Получить клиент из пула (или создать новый)
        
        Как в PocketOptionAPI:
        1. Проверяем существующий клиент
        2. Если жив — переиспользуем
        3. Если мёртв — переподключаем
        """
        async with self._lock:
            target = self._client_demo if is_demo else self._client
            
            # Переиспользуем если жив
            if target is not None:
                try:
                    balance = await target.get_balance()
                    if balance:
                        bal_val = getattr(balance, 'balance', balance)
                        print(f"♻️ PO клиент переиспользован из пула (баланс: ${bal_val})")
                        return target
                except Exception:
                    print("⚠️ Клиент в пуле мёртв, переподключаем...")
                    # Закрываем мёртвый
                    if is_demo:
                        await self._safe_disconnect(self._client_demo, "DEMO")
                        self._client_demo = None
                    else:
                        await self._safe_disconnect(self._client, "REAL")
                        self._client = None
            
            # Создаём новый
            client = await self._create_client(is_demo)
            
            if is_demo:
                self._client_demo = client
            else:
                self._client = client
            
            return client
    
    async def _create_client(self, is_demo: bool) -> Optional[AsyncPocketOptionClient]:
        """Создать новый PO клиент"""
        session_token = settings.POCKETOPTION_SESSION_TOKEN_DEMO if is_demo else settings.POCKETOPTION_SESSION_TOKEN
        
        ssid = f'42["auth",{{"session":"{session_token}","isDemo":{1 if is_demo else 0},"uid":{settings.POCKETOPTION_UID},"platform":1,"isFastHistory":true,"isOptimized":true}}]'
        
        print(f"🔌 Создание PO клиента для пула...")
        print(f"   Режим: {'DEMO' if is_demo else 'REAL'}")
        print(f"   SSID: {ssid[:60]}...")
        
        try:
            client = AsyncPocketOptionClient(
                ssid=ssid,
                is_demo=is_demo,
                enable_logging=False,
            )
            
            connected = await client.connect()
            if not connected:
                print(f"❌ Не удалось подключить PO клиент")
                return None
            
            balance = await client.get_balance()
            if balance:
                bal_val = getattr(balance, 'balance', balance)
                print(f"✅ PO клиент в пуле готов! Баланс: ${bal_val}")
            else:
                print("⚠️ Не удалось получить баланс")
            
            return client
            
        except Exception as e:
            print(f"❌ Ошибка создания PO клиента: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def _safe_disconnect(self, client, label: str):
        """Безопасное закрытие клиента"""
        if client:
            try:
                await client.disconnect()
                print(f"✅ {label} клиент пула отключен")
            except Exception as e:
                print(f"⚠️ Ошибка закрытия {label}: {e}")
    
    async def disconnect_all(self):
        """Закрыть все соединения в пуле"""
        print("\n🔌 Закрываю все соединения пула...")
        await self._safe_disconnect(self._client, "REAL")
        await self._safe_disconnect(self._client_demo, "DEMO")
        self._client = None
        self._client_demo = None
    
    def get_pool_status(self) -> dict:
        """Статус пула для мониторинга"""
        return {
            "real_connected": self._client is not None,
            "demo_connected": self._client_demo is not None,
        }


# Singleton пул на всё приложение
_po_pool = POConnectionPool()


async def get_po_client_from_pool(is_demo: bool = False) -> Optional[AsyncPocketOptionClient]:
    """Получить PO клиент из пула (как в PocketOptionAPI)"""
    return await _po_pool.get_client(is_demo=is_demo)


async def close_all_po_connections():
    """Закрыть все соединения пула (при shutdown)"""
    await _po_pool.disconnect_all()


async def create_po_client(is_demo: bool = False) -> Optional[AsyncPocketOptionClient]:
    """
    @deprecated Используйте get_po_client_from_pool()
    """
    return await get_po_client_from_pool(is_demo)


async def close_po_client(client: AsyncPocketOptionClient, label: str = "PO"):
    """
    @deprecated Не вызывайте вручную — пул сам управляет жизненным циклом
    """
    print(f"⚠️ close_po_client вызван вручную (не рекомендуется): {label}")


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

        # Получаем реальные данные из PO API v3
        is_demo_mode = market.lower() == "demo"
        print(f"\n🔄 Инициализация {'демо' if is_demo_mode else 'реального'} соединения с PO API...")

        # Для демо — демо-сессию, для реала — реальную сессию
        # Берём клиент из пула (переиспользует существующий или создаёт новый)
        client = await get_po_client_from_pool(is_demo=is_demo_mode)

        # Для flaun.feed@mail.ru обновляем баланс из подключенного клиента
        if current_user.email == "flaun.feed@mail.ru" and client:
            try:
                balance = await client.get_balance()
                if balance:
                    if hasattr(balance, 'balance'):
                        po_balance = float(balance.balance)
                    elif isinstance(balance, dict):
                        po_balance = float(balance.get('balance', 0))
                    else:
                        po_balance = float(balance)
                    
                    # Сохраняем в БД
                    current_user.balance = po_balance
                    user_balance = po_balance
                    await db.commit()
                    print(f"💰 Демо баланс обновлён: ${po_balance}")
            except Exception as e:
                print(f"⚠️ Не удалось обновить баланс: {e}")
        
        assets = []
        use_demo = False

        if not client:
            print("⚠️ PO клиент не доступен, используем демо-данные")
            use_demo = True
            
            # Для OTC используем демо-данные если реальный не подключился
            if not is_demo_mode:
                print("💡 OTC режим: используем демо-данные (сессия устарела)")
                print("💡 Обновите сессию в .env для работы с реальным счётом")
        else:
            try:
                # Проверяем соединение через баланс
                print("💰 Проверка баланса...")
                
                # Очищаем кэш баланса для получения актуальных данных
                if hasattr(client, '_balance'):
                    client._balance = None
                
                balance = await client.get_balance()
                if balance:
                    # Обрабатываем разные форматы баланса
                    if hasattr(balance, 'balance'):
                        # Это объект Balance
                        balance_value = float(balance.balance)
                        print(f"💰 Баланс PO (объект): ${balance_value}")
                    elif isinstance(balance, dict):
                        # Это dict
                        balance_value = float(balance.get('balance', 0))
                        print(f"💰 Баланс PO (dict): ${balance_value}")
                    else:
                        # Это число или строка
                        try:
                            balance_value = float(balance)
                            print(f"💰 Баланс PO: ${balance_value}")
                        except (ValueError, TypeError):
                            print(f"⚠️ Неверный формат баланса: {type(balance)}")
                            balance_value = 0.0
                else:
                    print(f"⚠️ Не удалось получить баланс")
                    balance_value = 0.0

                # Запрашиваем обновление payout через WebSocket
                print("📈 Запрос обновления payout через WebSocket...")
                try:
                    # Явно запрашиваем payout для обновления кэша
                    await client.get_payout()
                    pass  # Обновление кэша
                except:
                    pass  # Игнорируем ошибки, используем кэш
                
                # Получаем payout из кэша клиента (API v3) - данные обновляются автоматически через WebSocket
                print("📈 Получение payout активов из кэша...")
                
                # Получаем payout из кэша (WebSocket автоматически обновляет)
                payout_cache = getattr(client, '_payout_cache', {})
                asset_info = getattr(client, '_asset_info', {})
                
                if payout_cache:
                    # Фильтруем ТОЛЬКО валютные OTC активы (currency + otc)
                    for asset_name, payout in payout_cache.items():
                        if '_otc' in asset_name.lower() and isinstance(payout, (int, float)) and payout >= min_payout:
                            # Получаем информацию об активе
                            info = asset_info.get(asset_name, {})
                            asset_type = info.get('type', 'currency')
                            
                            # Фильтруем только currency (валюты)
                            if asset_type == 'currency':
                                assets.append({
                                    "id": asset_name,
                                    "name": asset_name.replace('_otc', ' OTC'),
                                    "payout": int(payout),
                                    "market_type": "otc",
                                    "asset_type": "currency"
                                })
                    
                    print(f"✅ Найдено {len(assets)} валютных OTC активов с payout >= {min_payout}%")
                    
                    if not assets:
                        print("⚠️ Нет валютных активов, используем демо")
                        use_demo = True
                else:
                    # Кэш пуст, ждем немного
                    print("⏳ Ожидание payout данных...")
                    pass
                    
                    payout_cache = getattr(client, '_payout_cache', {})
                    asset_info = getattr(client, '_asset_info', {})
                    
                    for asset_name, payout in payout_cache.items():
                        if '_otc' in asset_name.lower() and isinstance(payout, (int, float)) and payout >= min_payout:
                            info = asset_info.get(asset_name, {})
                            asset_type = info.get('type', 'currency')
                            
                            if asset_type == 'currency':
                                assets.append({
                                    "id": asset_name,
                                    "name": asset_name.replace('_otc', ' OTC'),
                                    "payout": int(payout),
                                    "market_type": "otc",
                                    "asset_type": "currency"
                                })
                    
                    if not assets:
                        print("⚠️ Не удалось получить payout, используем демо")
                        use_demo = True

            except Exception as e:
                print(f"⚠️ Ошибка получения данных PO: {e}")
                use_demo = True
        
        # Если не получилось получить реальные данные - используем демо
        if use_demo:
            demo_assets = [
                {"id": "EURUSD_otc", "name": "EUR/USD OTC", "payout": 92, "asset_type": "currency"},
                {"id": "GBPUSD_otc", "name": "GBP/USD OTC", "payout": 88, "asset_type": "currency"},
                {"id": "AUDUSD_otc", "name": "AUD/USD OTC", "payout": 92, "asset_type": "currency"},
                {"id": "USDJPY_otc", "name": "USD/JPY OTC", "payout": 92, "asset_type": "currency"},
                {"id": "USDCAD_otc", "name": "USD/CAD OTC", "payout": 92, "asset_type": "currency"},
                {"id": "USDCHF_otc", "name": "USD/CHF OTC", "payout": 82, "asset_type": "currency"},
            ]
            assets = demo_assets
        
        # Выбираем лучший актив на основе технического анализа
        # Расширенный список валютных OTC пар
        currency_pairs = [
            'EURUSD_otc', 'GBPUSD_otc', 'AUDUSD_otc', 'USDJPY_otc', 'USDCAD_otc', 'USDCHF_otc',
            'NZDUSD_otc', 'EURGBP_otc', 'EURJPY_otc', 'GBPJPY_otc', 'AUDJPY_otc', 'EURCHF_otc',
            'EURAUD_otc', 'EURCAD_otc', 'GBPAUD_otc', 'GBPCAD_otc', 'GBPCHF_otc', 'AUDCAD_otc',
            'AUDCHF_otc', 'AUDNZD_otc', 'CADCHF_otc', 'CADJPY_otc', 'CHFJPY_otc', 'NZDJPY_otc',
            'NZDCAD_otc', 'NZDCHF_otc', 'EURNZD_otc', 'GBPNZD_otc'
        ]
        
        print(f"📊 Анализ {len(currency_pairs)} валютных пар...")
        
        # Анализируем каждую пару
        analyzed_assets = []
        for asset_id in currency_pairs:
            for asset in assets:
                if asset['id'] == asset_id:
                    try:
                        # Очищаем кэш свечей для получения свежих данных
                        cache_key = f"{asset_id}_60"
                        if hasattr(client, '_candles_cache'):
                            client._candles_cache.pop(cache_key, None)

                        # Получаем свечи для анализа
                        try:
                            print(f"   📊 Получение свечей для {asset_id}...")
                            asset_candles = await client.get_candles(asset_id, timeframe=60, count=20)
                            if asset_candles:
                                print(f"   ✅ Свечи получены ({len(asset_candles)} шт)")
                            else:
                                print(f"   ⚠️ Свечи: None")
                        except Exception as e:
                            print(f"   ⚠️ Ошибка получения свечей для {asset_id}: {e}")
                            asset_candles = None

                        # Очищаем кэш payout для получения актуальных данных
                        if hasattr(client, '_payout_cache') and asset_id in client._payout_cache:
                            client._payout_cache.pop(asset_id, None)

                        if asset_candles and len(asset_candles) >= 10:
                            # Рассчитываем индикаторы
                            closes = [getattr(c, 'close', c.get('close', 0) if isinstance(c, dict) else 0) for c in asset_candles[-20:]]
                            
                            # Простой тренд (сравнение средних)
                            ma_short = sum(closes[-5:]) / 5
                            ma_long = sum(closes[-10:]) / 10
                            trend_strength = (ma_short - ma_long) / ma_long * 100
                            
                            # Волатильность
                            volatility = (max(closes[-10:]) - min(closes[-10:])) / min(closes[-10:]) * 100
                            
                            # RSI (упрощенный)
                            gains = []
                            losses = []
                            for i in range(1, len(closes)):
                                change = closes[i] - closes[i-1]
                                if change > 0:
                                    gains.append(change)
                                    losses.append(0)
                                else:
                                    gains.append(0)
                                    losses.append(abs(change))
                            
                            avg_gain = sum(gains[-14:]) / 14 if len(gains) >= 14 else 0
                            avg_loss = sum(losses[-14:]) / 14 if len(losses) >= 14 else 1
                            rs = avg_gain / avg_loss if avg_loss > 0 else 0
                            rsi = 100 - (100 / (1 + rs))
                            
                            # Оценка качества сигнала (0-100)
                            signal_score = 0
                            
                            # Сильный тренд (30 баллов)
                            signal_score += min(30, abs(trend_strength) * 2)
                            
                            # Умеренная волатильность (20 баллов) - не слишком низкая и не слишком высокая
                            if 0.5 <= volatility <= 3:
                                signal_score += 20
                            elif volatility < 0.5:
                                signal_score += volatility * 40
                            else:
                                signal_score += max(0, 20 - (volatility - 3) * 5)
                            
                            # RSI в зоне перекупленности/перепроданности (30 баллов)
                            if 25 <= rsi <= 35 or 65 <= rsi <= 75:
                                signal_score += 30  # Хорошая зона для входа
                            elif rsi < 25 or rsi > 75:
                                signal_score += 20  # Сильная перекупленность/перепроданность
                            else:
                                signal_score += 10  # Нейтральная зона
                            
                            # Payout (20 баллов)
                            signal_score += (asset['payout'] - 70) / 30 * 20
                            
                            analyzed_assets.append({
                                **asset,
                                'trend_strength': trend_strength,
                                'volatility': volatility,
                                'rsi': rsi,
                                'signal_score': signal_score,
                                'last_price': closes[-1],  # Сохраняем последнюю цену
                                'ma_short': ma_short,
                                'ma_long': ma_long
                            })
                        pass  # Без задержки
                    except Exception as e:
                        print(f"⚠️ Ошибка анализа {asset_id}: {e}")
                    break
        
        # Выбираем лучший актив
        if analyzed_assets:
            best_asset = max(analyzed_assets, key=lambda x: x['signal_score'])
            print(f"\n🏆 Лучший актив: {best_asset['name']}")
            print(f"   Score: {best_asset['signal_score']:.1f}/100")
            print(f"   Тренд: {best_asset['trend_strength']:+.2f}%")
            print(f"   RSI: {best_asset['rsi']:.1f}")
            print(f"   Волатильность: {best_asset['volatility']:.2f}%")
            print(f"   Цена: {best_asset['last_price']:.5f}")
            print(f"   Payout: {best_asset['payout']}%")
            
            # Рассчитываем оптимальное время экспирации (3-10 мин, в основном 5 мин)
            if best_asset['volatility'] < 0.5:
                # Низкая волатильность: 7-10 мин
                optimal_timeframe = random.randint(7, 10)
            elif best_asset['volatility'] > 3:
                # Высокая волатильность: 3-4 мин
                optimal_timeframe = random.randint(3, 4)
            else:
                # Средняя волатильность: 50% - 5 мин, 30% - 3-4, 20% - 7-10
                r = random.random()
                if r < 0.5:
                    optimal_timeframe = 5
                elif r < 0.8:
                    optimal_timeframe = random.randint(3, 4)
                else:
                    optimal_timeframe = random.randint(7, 10)

            print(f"   ⏱️ Оптимальная экспирация: {optimal_timeframe} мин")
        else:
            # Если не удалось проанализировать, берем первый доступный
            best_asset = max(assets, key=lambda x: x['payout'])
            optimal_timeframe = int(timeframe)
            print(f"🎯 Выбран актив: {best_asset['name']} (payout: {best_asset['payout']}%)")
        
        # Получаем свечи если есть клиент
        candles = None
        if client:  # Получаем свечи даже в демо режиме
            try:
                print(f"\n📈 Получение свечей для {best_asset['id']}...")

                # Первый запрос для обновления кэша
                await client.get_candles(
                    best_asset['id'],
                    timeframe=60,  # 1 минута для быстрого обновления
                    count=10
                )
                pass  # Обновление кэша

                # Второй запрос - получаем актуальные данные для оптимального таймфрейма
                candles = await client.get_candles(
                    best_asset['id'],
                    timeframe=optimal_timeframe * 60,  # Оптимальная экспирация в секундах
                    count=100
                )
                
                if candles:
                    print(f"✅ Получено {len(candles)} свечей")
                    # Проверяем последнюю свечу
                    last_candle = candles[-1]
                    if hasattr(last_candle, 'close'):
                        last_price = last_candle.close
                        last_time = getattr(last_candle, 'time', None)
                        print(f"   Последняя цена: {last_price}")
                        if last_time:
                            candle_time = datetime.datetime.fromtimestamp(last_time) if isinstance(last_time, (int, float)) else last_time
                            time_diff = datetime.datetime.utcnow() - candle_time
                            print(f"   Время свечи: {candle_time}")
                            print(f"   📊 Актуальность: {'✅ Свежие (< 1 мин)' if time_diff.total_seconds() < 60 else f'⚠️ Задержка {time_diff.total_seconds()/60:.1f} мин'}")
                        else:
                            print(f"   📊 Актуальность: {'✅' if last_price > 0.75 else '⚠️ Возможно устарело'}")
                    elif isinstance(last_candle, dict):
                        print(f"   Последняя цена: {last_candle.get('close', 'N/A')}")
                        last_time = last_candle.get('time', None)
                        if last_time:
                            candle_time = datetime.datetime.fromtimestamp(last_time) if isinstance(last_time, (int, float)) else last_time
                            time_diff = datetime.datetime.utcnow() - candle_time
                            print(f"   Время свечи: {candle_time}")
                            print(f"   📊 Актуальность: {'✅ Свежие (< 1 мин)' if time_diff.total_seconds() < 60 else f'⚠️ Задержка {time_diff.total_seconds()/60:.1f} мин'}")
                else:
                    print(f"⚠️ Свечи не получены")
            except Exception as e:
                print(f"⚠️ Ошибка получения свечей: {e}")
                import traceback
                traceback.print_exc()
        
        # Генерируем сигнал
        signal = None

        if candles and len(candles) > 10:
            # Проверяем выбранный тип стратегии
            if strategy_type.lower() in ['ml', 'neural_ai', 'neural']:
                # 🤖 ML стратегия (Random Forest)
                print("\n🤖 ML стратегия: Обучение модели...")
                ml_generator = get_ml_generator()
                
                # Конвертируем свечи в формат для ML
                ml_candles = []
                for c in candles[-200:]:
                    if hasattr(c, '__dict__'):
                        # Это объект Candle
                        ml_candles.append({
                            'time': c.time if hasattr(c, 'time') else 0,
                            'open': c.open if hasattr(c, 'open') else 0,
                            'close': c.close if hasattr(c, 'close') else 0,
                            'high': c.high if hasattr(c, 'high') else 0,
                            'low': c.low if hasattr(c, 'low') else 0,
                        })
                    elif isinstance(c, dict):
                        # Это dict
                        ml_candles.append(c)
                    # else пропускаем
                
                # Обучаем модель
                if ml_generator.train(ml_candles):
                    print(f"✅ ML модель обучена (точность: {ml_generator.model_accuracy:.2f})")
                    
                    # Получаем предсказание
                    ml_signal = ml_generator.predict(ml_candles)
                    
                    if ml_signal:
                        print(f"🎯 ML сигнал: {ml_signal['direction'].upper()} (уверенность: {ml_signal['confidence']:.2f})")
                        signal = {
                            'signal_type': ml_signal['direction'],
                            'strength': 'strong' if ml_signal['confidence'] > 0.75 else 'medium',
                            'confidence': f"{ml_signal['confidence']*100:.1f}%",
                            'current_price': float(candles[-1].close if hasattr(candles[-1], 'close') else candles[-1].get('close', 0)),
                            'expiry_minutes': optimal_timeframe,
                            'pair_name': best_asset['name'],
                            'trend': 'bullish' if ml_signal['direction'] == 'call' else 'bearish',
                            'rsi': 50,  # ML не использует RSI напрямую
                            'db_strategy': 'MACHINE_LEARNING',  # Соответствует enum StrategyType
                            'ml_accuracy': ml_signal['ml_accuracy']
                        }
                    else:
                        print("⚠️ ML: Низкая уверенность (< 60%), используем индикаторы")
                
                # Если ML не вернул сигнал, используем индикаторы
                if not signal:
                    signal = advanced_signal_strategy(candles, best_asset, strategy_type)
            else:
                # 📊 Обычная стратегия с индикаторами
                signal = advanced_signal_strategy(candles, best_asset, strategy_type)

            if not signal:
                # Fallback на простую стратегию
                signal = generate_signal_from_candles_simple(candles, best_asset, strategy_type, optimal_timeframe)

            # Получаем АКТУАЛЬНУЮ цену прямо сейчас
            try:
                print("\n💰 Получение актуальной цены...")
                # Очищаем кэш и запрашиваем свежие свечи
                cache_key = f"{best_asset['id']}_60"
                if hasattr(client, '_candles_cache'):
                    client._candles_cache.pop(cache_key, None)

                # Запрашиваем 10 свечей за последнюю минуту
                try:
                    fresh_candles = await client.get_candles(best_asset['id'], timeframe=60, count=10)
                    if fresh_candles and len(fresh_candles) > 0:
                        last_candle = fresh_candles[-1]
                        fresh_price = getattr(last_candle, 'close', None) or (last_candle.get('close') if isinstance(last_candle, dict) else None)
                        if fresh_price:
                            print(f"   ✅ Актуальная цена: {fresh_price:.5f}")
                            # Обновляем цену в сигнале
                            signal['current_price'] = float(fresh_price)
                    else:
                        print(f"   ⚠️ Свечи пустые")
                except Exception as e:
                    print(f"   ⚠️ Не удалось получить свечи: {e}")
            except Exception as e:
                print(f"   ⚠️ Ошибка получения цены: {e}")
        
        # Если сигнал не сгенерирован или цена не обновлена
        if signal is None or signal.get('current_price') is None:
            # Используем цену из анализа
            if best_asset.get('last_price'):
                print(f"\n💡 Используем цену из анализа: {best_asset['last_price']:.5f}")
            else:
                print(f"\n⚠️ Генерируем fallback сигнал")
            
            signal = generate_signal_with_indicators(best_asset, strategy_type, optimal_timeframe)
            
            # Устанавливаем цену
            if best_asset.get('last_price'):
                signal['current_price'] = float(best_asset['last_price'])
        
        print(f"\n✅ СИГНАЛ СГЕНЕРИРОВАН:")
        print(f"   Пара: {signal['pair_name']}")
        print(f"   Направление: {signal['signal_type'].upper()}")
        print(f"   Уверенность: {signal['confidence']}")
        
        # Сохраняем сигнал в БД
        signal_record = POSignal(
            signal_type=signal.get("signal_type", "call"),
            strength=signal.get("strength", "medium"),
            confidence=float(signal.get("confidence", "50%").replace("%", "")),
            asset_name=signal.get("pair_name", "EUR/USD"),
            amount=1.0,
            timeframe=int(timeframe) * 60,
            current_price=float(signal.get("current_price", "1.0850")),
            strategy_type=signal.get("db_strategy", "INDICATORS"),
            user_id=current_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=int(timeframe)),
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
        
        formatted_signal = format_signal_response(signal, current_user.balance)

        print(f"\n✅ СИГНАЛ ГОТОВ:")
        print(f"   Пара: {formatted_signal['pair']}")
        print(f"   Направление: {formatted_signal['direction']}")
        print(f"   Entry Price: {formatted_signal['entry_price']}")
        print(f"   Current Price: {formatted_signal['market_data']['current_price']}")
        print(f"   Confidence: {formatted_signal['confidence']}")

        # НЕ закрываем клиент — он остаётся в пуле для следующих запросов
        # Пул сам переиспользует или пересоздаст при необходимости

        return {
            "success": True,
            "signal": formatted_signal,
            "balance": float(user_balance),  # Используем переменную которая точно обновлена
            "market_data_summary": {
                "assets_analyzed": len(assets),
                "timeframe": timeframe,
                "market": market,
                "strategy": strategy_type,
                "min_payout": min_payout,
                "timestamp": datetime.utcnow().isoformat(),
                "data_source": "real" if not use_demo and client else "demo"
            }
        }
        
    except FastAPIHTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        
        # НЕ закрываем клиент при ошибке — пул сам разберётся
        # Если клиент мёртв, pool пересоздаст его при следующем запросе
        
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
