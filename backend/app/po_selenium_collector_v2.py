# Pocket Option Selenium Collector v2
# На основе https://github.com/VitalySvyatyuk/pocket_option_trading_bot

import asyncio
import json
import base64
import time
from typing import List, Dict, Optional
from datetime import datetime
import logging

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import undetected_chromedriver as uc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PocketOptionSeleniumCollectorV2:
    """
    Коллектор данных Pocket Option через Selenium
    Перехватывает WebSocket сообщения через Performance API
    """

    URL = "https://po.trade/en/cabinet/demo-quick-high-low/"

    def __init__(self, chrome_profile_path: Optional[str] = None):
        """
        Инициализация
        
        Args:
            chrome_profile_path: Путь к профилю Chrome где вы залогинены
        """
        self.driver: Optional[webdriver.Chrome] = None
        self.chrome_profile_path = chrome_profile_path
        self.candles_data: Dict = {}
        self.assets_data: Dict = {}
        self.running = False
        
        # Путь к профилю по умолчанию
        if not chrome_profile_path:
            import getpass
            import platform
            username = getpass.getuser()
            os_platform = platform.platform().lower()
            
            if 'macos' in os_platform:
                self.chrome_profile_path = f'/Users/{username}/Library/Application Support/Google/Chrome/Trading Bot'
            elif 'windows' in os_platform:
                self.chrome_profile_path = f'C:\\Users\\{username}\\AppData\\Local\\Google\\Chrome\\User Data\\Trading Bot'
            else:
                self.chrome_profile_path = f'/home/{username}/.config/google-chrome/Trading Bot'

    def _create_driver(self) -> webdriver.Chrome:
        """Создание WebDriver"""
        options = Options()
        
        # Путь к Chrome
        options.binary_location = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        
        # Используем профиль
        options.add_argument(f'--user-data-dir={self.chrome_profile_path}')
        
        # Отключаем защиту
        options.add_argument('--disable-blink-features=AutomationControlled')
        
        # Игнорирование SSL
        options.add_argument('--ignore-ssl-errors')
        options.add_argument('--ignore-certificate-errors')
        
        # User Agent
        options.add_argument('user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        # Включаем performance логи
        options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
        
        driver = uc.Chrome(options=options)
        
        # Скрываем автоматизацию
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                })
            '''
        })
        
        return driver

    def start(self):
        """Запуск"""
        try:
            logger.info("🚀 Запуск Pocket Option Selenium Collector V2...")
            logger.info(f"📂 Профиль: {self.chrome_profile_path}")
            
            self.driver = self._create_driver()
            self.driver.set_page_load_timeout(30)
            
            logger.info(f"📖 Открытие {self.URL}")
            self.driver.get(self.URL)
            
            # Ждём загрузки
            logger.info("⏳ Ожидание загрузки (60 сек)...")
            for i in range(60, 0, -1):
                time.sleep(1)
                if i % 10 == 0:
                    logger.info(f"   ⏳ {i} сек...")
                    # Проверяем загрузку страницы
                    try:
                        title = self.driver.title
                        logger.info(f"   📄 Заголовок: {title}")
                    except:
                        pass
            
            self.running = True
            logger.info("✅ Collector запущен")
            
        except Exception as e:
            logger.error(f"❌ Ошибка запуска: {e}")
            raise

    def get_websocket_messages(self) -> List[Dict]:
        """Получение WebSocket сообщений через Performance API"""
        messages = []
        
        try:
            logs = self.driver.get_log('performance')
            
            for log_entry in logs:
                try:
                    message = json.loads(log_entry['message'])['message']
                    
                    # Ищем WebSocket frames
                    if 'Network' in message and 'webSocketFrameReceived' in message.get('method', ''):
                        params = message.get('params', {})
                        response = params.get('response', {})
                        
                        # opcode 2 = binary data
                        opcode = response.get('opcode', 0)
                        if opcode == 2:
                            payload_data = response.get('payloadData', '')
                            
                            if payload_data:
                                try:
                                    # Декодируем base64
                                    decoded = base64.b64decode(payload_data).decode('utf-8')
                                    data = json.loads(decoded)
                                    
                                    messages.append({
                                        'timestamp': log_entry.get('timestamp', 0),
                                        'data': data,
                                        'opcode': 2
                                    })
                                    
                                except Exception as decode_error:
                                    # Пробуем без base64
                                    try:
                                        data = json.loads(payload_data)
                                        messages.append({
                                            'timestamp': log_entry.get('timestamp', 0),
                                            'data': data,
                                            'opcode': 2
                                        })
                                    except:
                                        logger.debug(f"⚠️ Ошибка декодирования: {decode_error}")
                                        pass
                        else:
                            logger.debug(f"📦 Получен opcode {opcode} (ожидался 2)")
                                        
                except Exception as e:
                    continue
                    
        except Exception as e:
            logger.debug(f"⚠️ Ошибка получения логов: {e}")
            
        return messages

    def parse_history_message(self, data: Dict) -> Optional[Dict]:
        """Парсинг сообщения с историей свечей"""
        if 'asset' not in data or 'candles' not in data:
            return None
            
        asset = data.get('asset', 'UNKNOWN')
        period = data.get('period', 60)
        candles = data.get('candles', [])
        history = data.get('history', [])
        
        # Преобразуем свечи
        result = []
        for candle in candles:
            if isinstance(candle, list) and len(candle) >= 5:
                result.append({
                    'time': int(candle[0]),
                    'open': candle[1],
                    'close': candle[2],
                    'high': candle[3],
                    'low': candle[4]
                })
        
        # Обновляем последнюю свечу из history
        if result and history:
            for tstamp, value in history:
                result[-1]['close'] = value
                result[-1]['time'] = int(float(tstamp))
        
        return {
            'asset': asset,
            'period': period,
            'candles': result,
            'updated_at': datetime.utcnow().isoformat()
        }

    def get_current_data(self, timeout: int = 30) -> List[Dict]:
        """Получение текущих данных"""
        if not self.running or not self.driver:
            logger.error("❌ Collector не запущен")
            return []
            
        start_time = time.time()
        all_data = []
        
        logger.info("📡 Получение WebSocket сообщений...")
        
        while time.time() - start_time < timeout:
            messages = self.get_websocket_messages()
            
            if messages:
                logger.info(f"📨 Получено {len(messages)} сообщений")
            
            for msg in messages:
                data = msg.get('data', {})
                
                if isinstance(data, dict) and 'history' in data:
                    parsed = self.parse_history_message(data)
                    if parsed:
                        # Проверяем что ещё не добавили
                        if not any(d['asset'] == parsed['asset'] for d in all_data):
                            all_data.append(parsed)
                            logger.info(f"✅ Получено: {parsed['asset']} ({len(parsed['candles'])} свечей)")
                            
            # Если получили несколько активов, выходим
            if len(all_data) >= 3:
                break
                
            time.sleep(2)
            
        return all_data

    def stop(self):
        """Остановка"""
        self.running = False
        if self.driver:
            self.driver.quit()
            logger.info("🛑 Collector остановлен")


# Singleton
_collector_v2: Optional[PocketOptionSeleniumCollectorV2] = None


def get_collector_v2(profile_path: Optional[str] = None) -> PocketOptionSeleniumCollectorV2:
    """Получение экземпляра"""
    global _collector_v2
    if _collector_v2 is None:
        _collector_v2 = PocketOptionSeleniumCollectorV2(profile_path)
    return _collector_v2


async def main():
    """Тест"""
    print("=" * 70)
    print("🧪 Pocket Option Selenium Collector V2 - Тест")
    print("=" * 70)
    
    collector = get_collector_v2()
    
    try:
        # Запуск
        collector.start()
        
        # Получение данных
        print("\n📊 Получение данных...")
        data = collector.get_current_data(timeout=15)
        
        if data:
            print(f"\n✅ Получено {len(data)} активов:")
            for asset_data in data[:5]:
                print(f"\n  📈 {asset_data['asset']}")
                print(f"     Период: {asset_data['period']} сек")
                print(f"     Свечей: {len(asset_data['candles'])}")
                if asset_data['candles']:
                    last = asset_data['candles'][-1]
                    print(f"     Цена: {last['close']:.5f}")
        else:
            print("\n⚠️ Данные не получены")
            print("💡 Убедитесь что:")
            print("   - Вы залогинены в профиле Chrome")
            print("   - Страница загружена")
            print("   - Видны свечи на графике")
            
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        collector.stop()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
