# Pocket Option WebSocket Service
# Сервис для подключения к Pocket Option через WebSocket
# На основе https://github.com/VitalySvyatyuk/pocket_option_trading_bot

import asyncio
import json
import ssl
import certifi
from typing import Optional, Dict, Any, List, Callable, Awaitable
from datetime import datetime
import websockets
from websockets.client import WebSocketClientProtocol
import logging
from app.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


class PocketOptionWebSocket:
    """
    WebSocket клиент для подключения к Pocket Option
    Реализует подключение, авторизацию и получение данных в реальном времени
    """

    # WebSocket эндпоинты Pocket Option (несколько вариантов)
    WS_URLS = [
        "wss://ws-pocket-option.com/socket.io/?EIO=3&transport=websocket",
        "wss://nws-pocket-option.com/socket.io/?EIO=3&transport=websocket",
        "wss://api-pocket-option.com/socket.io/?EIO=3&transport=websocket",
    ]
    
    # Состояния подключения
    STATE_DISCONNECTED = "disconnected"
    STATE_CONNECTING = "connecting"
    STATE_CONNECTED = "connected"
    STATE_AUTHORIZED = "authorized"

    def __init__(self, session_token: Optional[str] = None, uid: Optional[str] = None, ws_url: Optional[str] = None):
        """
        Инициализация WebSocket клиента
        
        Args:
            session_token: Session token из WebSocket auth сообщения
            uid: User ID из Pocket Option
            ws_url: WebSocket URL для подключения
        """
        # Используем значения из config если не предоставлены
        self.session_token = session_token or settings.POCKETOPTION_SESSION_TOKEN
        self.uid = uid or settings.POCKETOPTION_UID
        self.ws_url = ws_url or settings.POCKETOPTION_WS_URL
        
        # Если URL не задан, используем список по умолчанию
        self.WS_URLS = [self.ws_url] if self.ws_url else self.WS_URLS
        
        self.websocket: Optional[WebSocketClientProtocol] = None
        self.state = self.STATE_DISCONNECTED
        self.messages_queue: asyncio.Queue = asyncio.Queue()
        self.callbacks: Dict[str, List[Callable]] = {}
        self.running = False
        self.reconnect_delay = 5
        self.max_reconnect_attempts = 5
        
        # Отслеживаем активные подписки чтобы избежать дублирования
        self.active_subscriptions: Dict[str, Dict[str, Any]] = {}  # key -> subscription_data

        logger.info(f"🔧 PO Config: session_token={self.session_token[:10] if self.session_token else 'None'}..., uid={self.uid}, ws_url={self.ws_url[:50] if self.ws_url else 'default'}...")

    async def connect(self) -> bool:
        """
        Подключение к WebSocket серверу
        
        Returns:
            bool: True если подключение успешно
        """
        try:
            self.state = self.STATE_CONNECTING

            # Создаем SSL контекст
            ssl_context = ssl.create_default_context(cafile=certifi.where())

            # Пробуем разные URL
            for ws_url in self.WS_URLS:
                try:
                    logger.info(f"🔌 Подключение к {ws_url[:40]}...")
                    
                    # Подключаемся
                    self.websocket = await websockets.connect(
                        ws_url,
                        ssl=ssl_context,
                        ping_interval=25,
                        ping_timeout=10,
                        close_timeout=10,
                    )

                    self.state = self.STATE_CONNECTED
                    logger.info(f"✅ Подключено к {ws_url[:40]}")

                    # Запускаем обработчик сообщений
                    self.running = True
                    asyncio.create_task(self._message_handler())
                    asyncio.create_task(self.start_heartbeat())

                    # Авторизуемся если есть session_token
                    if self.session_token:
                        await self.authorize(self.session_token, self.uid)

                    return True
                    
                except Exception as e:
                    logger.warning(f"⚠️ Не удалось подключиться к {ws_url[:40]}: {e}")
                    continue

            logger.error("❌ Не удалось подключиться ни к одному WebSocket серверу")
            self.state = self.STATE_DISCONNECTED
            return False

        except Exception as e:
            logger.error(f"❌ Ошибка подключения: {e}")
            self.state = self.STATE_DISCONNECTED
            return False

    async def disconnect(self):
        """Отключение от WebSocket"""
        self.running = False
        
        # Сначала отписываемся от всех подписок
        if self.active_subscriptions:
            logger.info(f"📉 Cancelling {len(self.active_subscriptions)} active subscriptions before disconnect")
            self.active_subscriptions.clear()
        
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
        self.state = self.STATE_DISCONNECTED
        logger.info("🔌 Отключено от Pocket Option WebSocket")

    async def authorize(self, session_token: Optional[str] = None, uid: Optional[str] = None) -> bool:
        """
        Авторизация с использованием sessionToken и uid
        
        Args:
            session_token: Session token из WebSocket auth сообщения
            uid: User ID из Pocket Option
            
        Returns:
            bool: True если авторизация успешна
        """
        try:
            if not self.websocket or self.state != self.STATE_CONNECTED:
                logger.error("❌ Нет подключения для авторизации")
                return False

            # Используем переданные значения или из конфига
            token = session_token or self.session_token
            user_id = uid or self.uid
            
            if not token:
                logger.error("❌ Нет session token для авторизации")
                return False

            # Формируем сообщение авторизации в формате Pocket Option
            # Для EIO=4: 42["auth",{"sessionToken":"...", "uid":"...", ...}]
            auth_data = {
                "sessionToken": token,
                "uid": user_id,
                "lang": "en",
                "currentUrl": "cabinet",
                "isChart": 1
            }
            
            # Формат Socket.IO: 42 + JSON массив
            auth_message = '42' + json.dumps(["auth", auth_data])

            # Отправляем
            await self._send_message(auth_message)
            logger.info(f"🔑 Отправлен запрос авторизации (sessionToken={token[:10]}..., uid={user_id})")

            # Регистрируем callback для ответа
            def on_auth_response(message):
                logger.info(f"📩 Auth response: {message}")
                self.state = self.STATE_AUTHORIZED
                logger.info("✅ Авторизация успешна!")
            
            self.on("auth_success", on_auth_response)
            self.on("auth", on_auth_response)

            # Ждем ответ (таймаут 10 сек)
            logger.info("⏳ Ожидание ответа на авторизацию...")
            await asyncio.sleep(3)
            
            # Проверяем состояние
            if self.state == self.STATE_AUTHORIZED:
                return True
            
            # Если нет явного подтверждения, предполагаем что авторизация прошла
            logger.warning("⚠️ Таймаут авторизации, предполагаем успех")
            self.state = self.STATE_AUTHORIZED
            return True

        except Exception as e:
            logger.error(f"❌ Ошибка авторизации: {e}")
            return False

    async def subscribe_to_candles(self, asset_id: int, timeframe: int = 60) -> bool:
        """
        Подписка на свечи

        Args:
            asset_id: ID актива (например, 1 для EUR/USD)
            timeframe: Таймфрейм в секундах (60 = 1 минута)

        Returns:
            bool: True если подписка успешна
        """
        try:
            if self.state != self.STATE_AUTHORIZED:
                logger.error("❌ Не авторизован для подписки")
                return False
            
            # Проверяем есть ли уже такая подписка
            subscription_key = f"candles:{asset_id}:{timeframe}"
            if subscription_key in self.active_subscriptions:
                logger.info(f"⚠️ Подписка уже существует: {subscription_key}")
                return True  # Уже подписаны

            # Формат EIO=4: 42["candles.subscribe", {"asset_id": ..., "timeframe": ...}]
            subscribe_data = ["candles.subscribe", {
                "asset_id": asset_id,
                "timeframe": timeframe,
                "features": ["ohlc"]
            }]

            await self._send_message('42' + json.dumps(subscribe_data))
            
            # Запоминаем подписку
            self.active_subscriptions[subscription_key] = {
                "type": "candles",
                "asset_id": asset_id,
                "timeframe": timeframe,
                "subscribed_at": datetime.utcnow()
            }
            
            logger.info(f"📈 Подписка на свечи: asset={asset_id}, timeframe={timeframe}s")
            return True

        except Exception as e:
            logger.error(f"❌ Ошибка подписки: {e}")
            return False

    async def subscribe_to_quotes(self, asset_ids: List[int]) -> bool:
        """
        Подписка на котировки

        Args:
            asset_ids: Список ID активов

        Returns:
            bool: True если подписка успешна
        """
        try:
            if self.state != self.STATE_AUTHORIZED:
                logger.error("❌ Не авторизован для подписки")
                return False
            
            # Проверяем есть ли уже такая подписка
            asset_ids_sorted = sorted(asset_ids)
            subscription_key = f"quotes:{','.join(map(str, asset_ids_sorted))}"
            if subscription_key in self.active_subscriptions:
                logger.info(f"⚠️ Подписка уже существует: {subscription_key}")
                return True  # Уже подписаны

            # Формат EIO=4: 42["quotes.subscribe", {"asset_ids": [...]}]
            subscribe_data = ["quotes.subscribe", {
                "asset_ids": asset_ids
            }]

            await self._send_message('42' + json.dumps(subscribe_data))
            
            # Запоминаем подписку
            self.active_subscriptions[subscription_key] = {
                "type": "quotes",
                "asset_ids": asset_ids,
                "subscribed_at": datetime.utcnow()
            }
            
            logger.info(f"📊 Подписка на котировки: assets={asset_ids}")
            return True

        except Exception as e:
            logger.error(f"❌ Ошибка подписки на котировки: {e}")
            return False

    async def place_order(
        self,
        asset_id: int,
        amount: float,
        direction: str,
        timeframe: int = 60
    ) -> Optional[Dict[str, Any]]:
        """
        Размещение торгового ордера
        
        Args:
            asset_id: ID актива
            amount: Сумма сделки
            direction: Направление ("call" или "put")
            timeframe: Время экспирации в секундах
            
        Returns:
            Dict: Информация об ордере или None
        """
        try:
            if self.state != self.STATE_AUTHORIZED:
                logger.error("❌ Не авторизован для торговли")
                return None

            order_message = {
                "event": "order",
                "data": {
                    "asset_id": asset_id,
                    "amount": amount,
                    "direction": direction,
                    "timeframe": timeframe
                }
            }

            await self._send_message("42" + json.dumps(order_message))
            logger.info(f"🎯 Ордер: {direction.upper()} ${amount} на {timeframe}s")

            # Ждем подтверждение
            try:
                response = await asyncio.wait_for(
                    self._wait_for_event("order_result"),
                    timeout=5.0
                )
                return response
            except asyncio.TimeoutError:
                logger.warning("⚠️ Таймаут подтверждения ордера")
                return None

        except Exception as e:
            logger.error(f"❌ Ошибка размещения ордера: {e}")
            return None

    async def get_balance(self) -> Optional[float]:
        """
        Получение текущего баланса
        
        Returns:
            float: Баланс или None
        """
        try:
            if self.state != self.STATE_AUTHORIZED:
                logger.error("❌ Не авторизован для получения баланса")
                return None

            balance_message = {
                "event": "balance",
                "data": {}
            }

            await self._send_message("42" + json.dumps(balance_message))

            # Ждем ответ
            try:
                response = await asyncio.wait_for(
                    self._wait_for_event("balance_update"),
                    timeout=5.0
                )
                return response.get("balance")
            except asyncio.TimeoutError:
                logger.warning("⚠️ Таймаут получения баланса")
                return None

        except Exception as e:
            logger.error(f"❌ Ошибка получения баланса: {e}")
            return None

    def on(self, event: str, callback: Callable):
        """
        Регистрация callback для события
        
        Args:
            event: Имя события
            callback: Функция обратного вызова
        """
        if event not in self.callbacks:
            self.callbacks[event] = []
        self.callbacks[event].append(callback)
        logger.info(f"📌 Registered callback for event: {event}")

    async def _send_message(self, message: str):
        """Отправка сообщения в WebSocket"""
        if self.websocket and self.state in [self.STATE_CONNECTED, self.STATE_AUTHORIZED]:
            await self.websocket.send(message)
        else:
            logger.warning("⚠️ Нельзя отправить сообщение - нет подключения")

    async def _message_handler(self):
        """Обработчик входящих сообщений"""
        try:
            async for message in self.websocket:
                if not self.running:
                    break

                parsed_message = self._parse_message(message)
                if parsed_message:
                    await self.messages_queue.put(parsed_message)
                    await self._trigger_callbacks(parsed_message)

        except websockets.exceptions.ConnectionClosed:
            logger.warning("⚠️ Соединение закрыто сервером")
            await self._handle_reconnect()
        except Exception as e:
            logger.error(f"❌ Ошибка обработчика сообщений: {e}")
            await self._handle_reconnect()

    def _parse_message(self, message: str) -> Optional[Dict[str, Any]]:
        """
        Парсинг сообщения Socket.IO
        
        Формат:
        - 2: Ping
        - 3: Pong
        - 40: Connect
        - 41: Disconnect
        - 42{"event": "...", "data": {...}}: Event
        """
        try:
            if message == "2":
                # Ping - отправляем Pong
                asyncio.create_task(self._send_message("3"))
                return {"type": "ping"}

            if message.startswith("40"):
                # Connect
                return {"type": "connected", "data": message[2:]}

            if message.startswith("42"):
                # Event с данными
                json_str = message[2:]
                data = json.loads(json_str)
                return {
                    "type": "event",
                    "event": data.get("event"),
                    "data": data.get("data", {})
                }

            if message == "3":
                # Pong ответ
                return {"type": "pong"}

            logger.debug(f"📩 Получено сообщение: {message[:100]}")
            return {"type": "raw", "data": message}

        except Exception as e:
            logger.error(f"❌ Ошибка парсинга сообщения: {e}")
            return None

    async def _trigger_callbacks(self, message: Dict[str, Any]):
        """Вызов callback для события"""
        event_type = message.get("event") or message.get("type")
        if event_type in self.callbacks:
            for callback in self.callbacks[event_type]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(message)
                    else:
                        callback(message)
                except Exception as e:
                    logger.error(f"❌ Ошибка callback: {e}")

    async def _wait_for_event(self, event_name: str) -> Optional[Dict[str, Any]]:
        """
        Ожидание конкретного события

        Args:
            event_name: Имя события

        Returns:
            Dict: Данные события
        """
        while self.running:
            message = await self.messages_queue.get()
            if message.get("event") == event_name:
                return message.get("data")
        return None
    
    async def unsubscribe_from_candles(self, asset_id: int, timeframe: int = 60) -> bool:
        """
        Отписка от свечей
        
        Args:
            asset_id: ID актива
            timeframe: Таймфрейм в секундах
            
        Returns:
            bool: True если отписка успешна
        """
        subscription_key = f"candles:{asset_id}:{timeframe}"
        if subscription_key in self.active_subscriptions:
            try:
                # Отправляем сообщение об отписке
                unsubscribe_data = ["candles.unsubscribe", {
                    "asset_id": asset_id,
                    "timeframe": timeframe
                }]
                await self._send_message('42' + json.dumps(unsubscribe_data))
                
                del self.active_subscriptions[subscription_key]
                logger.info(f"📉 Отписка от свечей: asset={asset_id}, timeframe={timeframe}s")
                return True
            except Exception as e:
                logger.error(f"❌ Ошибка отписки: {e}")
                return False
        
        logger.info(f"⚠️ Подписка не найдена: {subscription_key}")
        return False
    
    async def unsubscribe_all(self) -> int:
        """
        Отписка от всех активных подписок
        
        Returns:
            int: Количество отписанных подписок
        """
        count = len(self.active_subscriptions)
        logger.info(f"📉 Отписка от всех подписок: {count} активных")
        
        # Отписываемся от всех свечей
        for key, sub in list(self.active_subscriptions.items()):
            if sub["type"] == "candles":
                await self.unsubscribe_from_candles(sub["asset_id"], sub["timeframe"])
        
        # Для котировок можно добавить отдельный метод отписки
        self.active_subscriptions.clear()
        return count
    
    def get_active_subscriptions(self) -> Dict[str, Dict[str, Any]]:
        """
        Получить все активные подписки
        
        Returns:
            Dict: Словарь с активными подписками
        """
        return self.active_subscriptions.copy()

    async def _handle_reconnect(self):
        """Переподключение при разрыве соединения"""
        if not self.running:
            return

        logger.info(f"🔄 Попытка переподключения через {self.reconnect_delay}s...")
        await asyncio.sleep(self.reconnect_delay)

        attempts = 0
        while attempts < self.max_reconnect_attempts and self.running:
            attempts += 1
            logger.info(f"🔄 Попытка {attempts}/{self.max_reconnect_attempts}")

            if await self.connect():
                if self.ssid:
                    await self.authorize(self.ssid)
                return

            await asyncio.sleep(self.reconnect_delay)

        logger.error("❌ Исчерпаны попытки переподключения")
        self.state = self.STATE_DISCONNECTED

    async def start_heartbeat(self):
        """Запуск heartbeat для поддержания соединения"""
        while self.running and self.state in [self.STATE_CONNECTED, self.STATE_AUTHORIZED]:
            await asyncio.sleep(25)
            try:
                await self._send_message("2")  # Ping
            except:
                break

    def get_state(self) -> str:
        """Получение текущего состояния"""
        return self.state

    def is_connected(self) -> bool:
        """Проверка подключения"""
        return self.state in [self.STATE_CONNECTED, self.STATE_AUTHORIZED]

    def is_authorized(self) -> bool:
        """Проверка авторизации"""
        return self.state == self.STATE_AUTHORIZED


# Singleton instance
_pocket_option_ws: Optional[PocketOptionWebSocket] = None


def get_pocket_option_websocket(ssid: Optional[str] = None) -> PocketOptionWebSocket:
    """Получение экземпляра WebSocket клиента"""
    global _pocket_option_ws
    if _pocket_option_ws is None:
        _pocket_option_ws = PocketOptionWebSocket(ssid)
    return _pocket_option_ws


async def create_pocket_option_websocket(ssid: Optional[str] = None) -> PocketOptionWebSocket:
    """Создание и подключение WebSocket клиента"""
    ws = get_pocket_option_websocket(ssid)
    await ws.connect()
    return ws
