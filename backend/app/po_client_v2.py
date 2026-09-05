# Pocket Option WebSocket Client v2
# На основе PocketOptionAPI (github.com/ChipaDevTeam/PocketOptionAPI)
# Socket.IO v4 формат: 42["auth",{...}]

import asyncio
import json
import ssl
import certifi
from typing import Optional, Dict, Any, List
import websockets
from websockets.client import WebSocketClientProtocol
import logging
import base64
from app.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


class PocketOptionClient:
    """
    Pocket Option WebSocket Client
    Прямое подключение через WebSocket с использованием ssid
    Формат Socket.IO v4: 42["auth",{"session":"...","isDemo":0,"uid":...,"platform":1}]
    """

    def __init__(self, session_token: str, uid: str, ws_url: Optional[str] = None, is_demo: bool = False):
        """
        Инициализация клиента

        Args:
            session_token: Session токен из .env (без обёртки Socket.IO)
            uid: User ID из .env
            ws_url: WebSocket URL из .env (опционально)
            is_demo: Демо или реальный счет
        """
        self.session_token = session_token
        self.uid = uid
        self.ws_url = ws_url or settings.POCKETOPTION_WS_URL
        self.is_demo = is_demo
        
        # Формируем SSID в формате Socket.IO v4
        self.ssid = f'42["auth",{{"session":"{session_token}","isDemo":{1 if is_demo else 0},"uid":{uid},"platform":1}}]'
        
        self.websocket: Optional[WebSocketClientProtocol] = None
        self.connected = False
        self.messages_queue: asyncio.Queue = asyncio.Queue()
        self.authenticated = False
        self.balance: Optional[float] = None
        self._payout_cache: Dict[str, float] = {}
        self._asset_info: Dict[str, Dict] = {}
        self._candles_cache: Dict[str, List] = {}

    async def connect(self) -> bool:
        """Подключение к WebSocket"""
        try:
            logger.info(f"🔌 Подключение к {self.ws_url[:50]}...")
            
            ssl_context = ssl.create_default_context(cafile=certifi.where())
            
            self.websocket = await websockets.connect(
                self.ws_url,
                ssl=ssl_context,
                ping_interval=25,
                ping_timeout=10,
                close_timeout=10,
            )
            
            self.connected = True
            logger.info("✅ Подключено!")
            
            # Запускаем обработчик сообщений
            asyncio.create_task(self._message_handler())
            
            # Авторизуемся
            await self._authorize()
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка подключения: {e}")
            return False

    async def _authorize(self) -> bool:
        """Авторизация с использованием ssid"""
        try:
            if not self.websocket:
                return False

            # Отправляем ssid напрямую (формат Socket.IO)
            # Формат: 42["auth",{"session":"...","isDemo":...,"uid":...,"platform":2}]
            logger.info(f"🔑 Отправка авторизации: {self.ssid[:50]}...")
            await self.websocket.send(self.ssid)

            # Ждём подтверждения (до 10 секунд)
            for _ in range(20):  # 20 попыток по 0.5 сек = 10 сек
                await asyncio.sleep(0.5)
                if self.authenticated:
                    return True
            
            logger.warning("⚠️ Таймаут авторизации")
            return False

        except Exception as e:
            logger.error(f"❌ Ошибка авторизации: {e}")
            return False

    async def _message_handler(self):
        """Обработчик входящих сообщений"""
        try:
            async for message in self.websocket:
                parsed = self._parse_message(message)
                if parsed:
                    await self.messages_queue.put(parsed)

                    # Проверяем авторизацию - улучшенная проверка
                    msg_type = parsed.get('type')
                    if msg_type == 'auth' and parsed.get('success'):
                        self.authenticated = True
                        logger.info("✅ Авторизация успешна!")
                    
                    # Также проверяем на успешный ответ авторизации
                    elif msg_type == 'event' and parsed.get('event') == 'auth':
                        data = parsed.get('data', {})
                        if 'error' not in data:
                            self.authenticated = True
                            logger.info("✅ Авторизация успешна! (event)")

        except websockets.exceptions.ConnectionClosed:
            logger.warning("⚠️ Соединение закрыто")
            self.connected = False
        except Exception as e:
            logger.error(f"❌ Ошибка обработчика: {e}")
            self.connected = False

    def _parse_message(self, message: str) -> Optional[Dict]:
        """Парсинг сообщения"""
        try:
            if message == "2":
                # Ping - отправляем Pong
                asyncio.create_task(self._send_pong())
                return {"type": "ping"}
            
            if message.startswith("40"):
                return {"type": "connected", "data": message[2:]}
            
            if message.startswith("42"):
                # Event с данными
                json_str = message[2:]
                data = json.loads(json_str)
                
                event_name = data[0] if len(data) > 0 else "unknown"
                event_data = data[1] if len(data) > 1 else {}
                
                # Проверяем авторизацию
                if event_name == "auth" and isinstance(event_data, dict):
                    return {
                        "type": "auth",
                        "success": "error" not in event_data,
                        "data": event_data
                    }
                
                return {
                    "type": "event",
                    "event": event_name,
                    "data": event_data
                }
            
            if message.startswith("4"):
                # Данные (возможно base64)
                return {"type": "data", "data": message}
            
            return {"type": "raw", "data": message}
            
        except Exception as e:
            logger.debug(f"⚠️ Ошибка парсинга: {e}")
            return None

    async def _send_pong(self):
        """Отправка Pong"""
        if self.websocket and self.connected:
            try:
                await self.websocket.send("3")
            except:
                pass

    async def get_balance(self) -> Optional[float]:
        """Получение баланса"""
        try:
            if not self.connected:
                return None

            # Запрос баланса
            message = '42["balance",{}]'
            await self.websocket.send(message)
            logger.info("💰 Запрошен баланс...")

            # Ждём ответ (несколько сообщений пока не получим баланс)
            max_attempts = 10
            for _ in range(max_attempts):
                try:
                    response = await asyncio.wait_for(
                        self.messages_queue.get(),
                        timeout=5.0
                    )

                    # Проверяем несколько типов событий
                    event_type = response.get('event', '')
                    event_name = response.get('type', '')
                    
                    # Баланс может прийти в разных форматах
                    if event_name == 'event' and event_type == 'balance':
                        data = response.get('data', {})
                        balance = data.get('balance')
                        if balance is not None:
                            logger.info(f"✅ Получен баланс: ${balance}")
                            return float(balance)
                    elif event_name == 'event' and event_type == 'balance_update':
                        balance = response.get('balance')
                        if balance is not None:
                            logger.info(f"✅ Получен баланс (update): ${balance}")
                            return float(balance)
                    # Иногда баланс приходит в профиле
                    elif event_name == 'event' and event_type == 'profile':
                        data = response.get('data', {})
                        balance = data.get('balance')
                        if balance is not None:
                            logger.info(f"✅ Получен баланс (profile): ${balance}")
                            return float(balance)

                except asyncio.TimeoutError:
                    break

            logger.warning("⚠️ Таймаут получения баланса")
            return None

        except Exception as e:
            logger.error(f"❌ Ошибка получения баланса: {e}")
            return None

    async def get_candles(self, asset: str, timeframe: int, count: int = 100) -> Optional[List[Dict]]:
        """
        Получение свечей
        
        Args:
            asset: Название актива (EURUSD_otc, EURUSD, и т.д.)
            timeframe: Таймфрейм в секундах (60, 300, и т.д.)
            count: Количество свечей
            
        Returns:
            List[Dict]: Список свечей или None
        """
        try:
            if not self.connected:
                return None
            
            # Запрос истории
            message = f'42["history",{{"asset":"{asset}","period":{timeframe},"count":{count}}}]'
            await self.websocket.send(message)
            logger.info(f"📈 Запрошены свечи: {asset}, {timeframe}s, {count} шт.")
            
            # Ждём ответ
            try:
                response = await asyncio.wait_for(
                    self.messages_queue.get(),
                    timeout=10.0
                )
                
                if response.get('type') == 'event' and response.get('event') == 'history':
                    data = response.get('data', {})
                    candles = data.get('candles', [])
                    
                    # Преобразуем в удобный формат
                    result = []
                    for candle in candles:
                        if isinstance(candle, list) and len(candle) >= 5:
                            result.append({
                                'time': candle[0],
                                'open': candle[1],
                                'close': candle[2],
                                'high': candle[3],
                                'low': candle[4]
                            })
                    
                    logger.info(f"✅ Получено {len(result)} свечей")
                    return result
                    
            except asyncio.TimeoutError:
                logger.warning("⚠️ Таймаут получения свечей")
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Ошибка получения свечей: {e}")
            return None

    async def get_payout(self) -> Optional[Dict[str, float]]:
        """Получение payout процентов"""
        try:
            if not self.connected:
                return None
            
            message = '42["payout",{}]'
            await self.websocket.send(message)
            
            await asyncio.sleep(2)
            
            # Собираем несколько сообщений
            payouts = {}
            for _ in range(10):
                try:
                    response = await asyncio.wait_for(
                        self.messages_queue.get(),
                        timeout=2.0
                    )
                    
                    if response.get('type') == 'event' and response.get('event') == 'payout':
                        data = response.get('data', {})
                        for asset, percent in data.items():
                            payouts[asset] = float(percent)
                            
                except asyncio.TimeoutError:
                    break
            
            return payouts if payouts else None
            
        except Exception as e:
            logger.error(f"❌ Ошибка получения payout: {e}")
            return None

    async def disconnect(self):
        """Отключение"""
        self.connected = False
        if self.websocket:
            await self.websocket.close()
            logger.info("🔌 Отключено")


async def main():
    """Тест клиента"""
    print("=" * 70)
    print("🧪 Pocket Option Client v2 - Тест")
    print("=" * 70)
    
    # Правильный формат session из примера
    session = "abcdefghijklm12nopqrstuvwx"  # Замените на реальную сессию
    uid = 12345678  # Замените на реальный UID
    is_demo = True
    
    client = PocketOptionClient(session, uid, is_demo)
    
    try:
        # Подключение
        connected = await client.connect()
        
        if not connected:
            print("❌ Не удалось подключиться")
            return
        
        # Ждём авторизации
        print("\n⏳ Ожидание авторизации...")
        await asyncio.sleep(5)
        
        if not client.authenticated:
            print("⚠️ Авторизация не подтверждена")
        
        # Баланс
        print("\n📌 Баланс...")
        balance = await client.get_balance()
        if balance:
            print(f"   💰 Баланс: ${balance}")
        else:
            print("   ⚠️ Не удалось получить баланс")
        
        # Свечи
        print("\n📌 Свечи EURUSD_otc...")
        candles = await client.get_candles("EURUSD_otc", 60, 50)
        if candles:
            print(f"   📈 Получено {len(candles)} свечей")
            if candles:
                last = candles[-1]
                print(f"   🕯️ Последняя: O:{last['open']} H:{last['high']} L:{last['low']} C:{last['close']}")
        else:
            print("   ⚠️ Не удалось получить свечи")
        
        print("\n" + "=" * 70)
        print("✅ Тест завершен")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
