# Pocket Option Selenium Data Collector
# Получение реальных данных из Pocket Option через Selenium
# На основе https://github.com/VitalySvyatyuk/pocket_option_trading_bot

import asyncio
import json
import base64
import time
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
import undetected_chromedriver as uc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PocketOptionSeleniumCollector:
    """
    Коллектор данных Pocket Option через Selenium
    Перехватывает WebSocket сообщения из браузера
    """

    BASE_URL = "https://pocketoption.com"
    TRADING_URL = "https://pocketoption.com/en/cabinet/demo-quick-high-low/"
    LOGIN_URL = "https://pocketoption.com/en/login"

    def __init__(self, chrome_profile_path: Optional[str] = None, email: Optional[str] = None, password: Optional[str] = None):
        """
        Инициализация коллектора
        
        Args:
            chrome_profile_path: Путь к профилю Chrome (для использования существующей сессии)
            email: Email для входа в Pocket Option (если нет сессии)
            password: Пароль для входа в Pocket Option (если нет сессии)
        """
        self.driver: Optional[webdriver.Chrome] = None
        self.chrome_profile_path = chrome_profile_path
        self.email = email or "flaun.feed@mail.ru"
        self.password = password or "astgyvf19UG"
        self.candles_data: Dict[str, List] = {}
        self.quotes_data: Dict[str, List] = {}
        self.running = False
        self.ws_messages: List[Dict] = []  # Буфер для сообщений
        
        # Путь к профилю Chrome по умолчанию (macOS) - ИСПОЛЬЗУЕМ СУЩЕСТВУЮЩИЙ ПРОФИЛЬ
        if not chrome_profile_path:
            import getpass
            import platform
            username = getpass.getuser()
            os_platform = platform.platform().lower()
            
            if 'macos' in os_platform:
                self.chrome_profile_path = f'/Users/{username}/Library/Application Support/Google/Chrome'
            elif 'windows' in os_platform:
                self.chrome_profile_path = f'C:/Users/{username}/AppData/Local/Google/Chrome/User Data'
            else:
                self.chrome_profile_path = f'/home/{username}/.config/google-chrome'

    def _create_driver(self) -> webdriver.Chrome:
        """Создание WebDriver с настройками"""
        
        # Путь к Chrome на macOS
        browser_executable_path = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        
        # Создаем driver без профиля для избежания конфликтов
        driver = uc.Chrome(
            browser_executable_path=browser_executable_path,
            headless=False,
            use_subprocess=True
        )
        
        # Скрываем признаки автоматизации
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                })
            '''
        })
        
        return driver

    def start(self):
        """Запуск браузера и открытие Pocket Option"""
        try:
            logger.info("🚀 Запуск Pocket Option Selenium Collector...")
            
            self.driver = self._create_driver()
            self.driver.set_page_load_timeout(30)
            
            # Открываем Pocket Option
            logger.info(f"📖 Открытие {self.BASE_URL}")
            self.driver.get(self.BASE_URL)
            
            # Даём время на ручной вход
            logger.info("\n" + "="*60)
            logger.info("🔑 РУЧНОЙ ВХОД")
            logger.info("="*60)
            logger.info("1. Войдите в аккаунт Pocket Option")
            logger.info("   Email: flaun.feed@mail.ru")
            logger.info("   Пароль: astgyvf19UG")
            logger.info("\n2. Перейдите на торговую страницу:")
            logger.info("   https://pocketoption.com/en/cabinet/demo-quick-high-low/")
            logger.info("\n3. Убедитесь что видите график и котировки")
            logger.info("="*60)
            logger.info("\n⏳ Ожидание 30 секунд на вход...\n")
            
            # Ждём пока пользователь войдёт
            for i in range(30, 0, -1):
                time.sleep(1)
                if i % 5 == 0:
                    logger.info(f"   ⏳ {i} сек...")
            
            self.running = True
            logger.info("✅ Pocket Option Collector запущен")
            
        except Exception as e:
            logger.error(f"❌ Ошибка запуска: {e}")
            raise

    def _check_auth(self) -> bool:
        """Проверка авторизации"""
        try:
            # Ищем баланс или аватар пользователя
            from selenium.webdriver.common.by import By
            
            try:
                self.driver.find_element(By.CSS_SELECTOR, '[class*="balance"], [data-test*="balance"], .user-avatar')
                logger.info("✅ Сессия активна!")
                return True
            except:
                return False
        except:
            return False

    def _login(self):
        """Вход в аккаунт Pocket Option"""
        try:
            logger.info(f"🔑 Вход в аккаунт: {self.email}")
            
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            from selenium.webdriver.common.keys import Keys
            
            wait = WebDriverWait(self.driver, 10)
            
            # Проверяем, уже ли залогинены
            try:
                balance_element = self.driver.find_element(By.CSS_SELECTOR, '[class*="balance"]')
                logger.info("✅ Уже авторизован!")
                return
            except:
                pass
            
            # Пытаемся войти
            try:
                # Email поле - используем более простые селекторы
                email_input = None
                for selector in ['input[type="email"]', 'input[name="email"]', '#email']:
                    try:
                        email_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
                        break
                    except:
                        continue
                
                if email_input:
                    email_input.clear()
                    email_input.send_keys(self.email)
                    logger.info("   ✏️ Email введён")
                    time.sleep(1)
                else:
                    logger.warning("⚠️ Не найдено поле Email")
                    return
                
                # Password поле
                password_input = None
                for selector in ['input[type="password"]', 'input[name="password"]', '#password']:
                    try:
                        password_input = self.driver.find_element(By.CSS_SELECTOR, selector)
                        break
                    except:
                        continue
                
                if password_input:
                    password_input.clear()
                    password_input.send_keys(self.password)
                    logger.info("   ✏️ Пароль введён")
                    time.sleep(1)
                    
                    # Отправляем Enter вместо поиска кнопки
                    password_input.send_keys(Keys.RETURN)
                    logger.info("   ✏️ Enter нажат")
                    time.sleep(3)
                else:
                    logger.warning("⚠️ Не найдено поле Password")
                    return
                
                # Ждём загрузки
                time.sleep(5)
                
                # Проверяем вход
                try:
                    self.driver.find_element(By.CSS_SELECTOR, '[class*="balance"]')
                    logger.info("✅ Вход успешен!")
                except:
                    logger.warning("⚠️ Вход не подтверждён")
                
            except Exception as e:
                logger.warning(f"⚠️ Ошибка входа: {e}")
            
            # Переход на торговую страницу
            logger.info(f"📖 Переход на {self.TRADING_URL}")
            self.driver.get(self.TRADING_URL)
            time.sleep(5)
            
        except Exception as e:
            logger.error(f"❌ Ошибка входа: {e}")
            try:
                self.driver.get(self.TRADING_URL)
                time.sleep(3)
            except:
                pass

    def stop(self):
        """Остановка и закрытие браузера"""
        self.running = False
        if self.driver:
            self.driver.quit()
            logger.info("🛑 Pocket Option Collector остановлен")

    def get_websocket_messages(self) -> List[Dict]:
        """
        Получение WebSocket сообщений через CDP (Chrome DevTools Protocol)
        
        Returns:
            List[Dict]: Список сообщений
        """
        messages = []
        
        try:
            # Включаем Network логи через CDP
            self.driver.execute_cdp_cmd('Network.enable', {})
            
            # Получаем логи
            logs = self.driver.get_log('browser')
            
            for log_entry in logs:
                try:
                    message = log_entry.get('message', {})
                    text = message.get('text', '')
                    
                    # Ищем WebSocket сообщения
                    if 'WebSocket' in text or 'websocket' in text:
                        try:
                            # Пытаемся извлечь JSON
                            if '{' in text and '}' in text:
                                start = text.find('{')
                                end = text.rfind('}') + 1
                                json_str = text[start:end]
                                data = json.loads(json_str)
                                
                                messages.append({
                                    'timestamp': log_entry.get('timestamp', 0),
                                    'data': data,
                                    'text': text
                                })
                        except:
                            pass
                            
                except Exception as e:
                    continue
                    
        except Exception as e:
            # Альтернативный метод - через performance
            try:
                logs = self.driver.get_log('performance')
                
                for log_entry in logs:
                    try:
                        message = json.loads(log_entry['message'])['message']
                        
                        if 'Network' in message and 'webSocketFrameReceived' in message.get('method', ''):
                            params = message.get('params', {})
                            response = params.get('response', {})
                            
                            payload_data = response.get('payloadData', '')
                            
                            if payload_data:
                                try:
                                    decoded_data = base64.b64decode(payload_data).decode('utf-8')
                                    data = json.loads(decoded_data)
                                    
                                    messages.append({
                                        'timestamp': log_entry['timestamp'],
                                        'data': data,
                                        'opcode': response.get('opcode', 0)
                                    })
                                    
                                except:
                                    try:
                                        data = json.loads(payload_data)
                                        messages.append({
                                            'timestamp': log_entry['timestamp'],
                                            'data': data,
                                            'opcode': response.get('opcode', 0)
                                        })
                                    except:
                                        pass
                                        
                    except:
                        continue
                        
            except:
                pass
            
        return messages

    def parse_candles_message(self, message: Dict) -> Optional[Dict]:
        """
        Парсинг сообщения со свечами
        
        Args:
            message: WebSocket сообщение
            
        Returns:
            Dict: Распарсенные данные свечи
        """
        data = message.get('data', {})
        
        if not isinstance(data, dict):
            return None
            
        # Проверяем наличие нужных полей
        if 'asset' not in data or 'candles' not in data:
            return None
            
        asset = data.get('asset', 'UNKNOWN')
        period = data.get('period', 60)
        candles = data.get('candles', [])
        history = data.get('history', [])
        
        # Преобразуем свечи в удобный формат
        parsed_candles = []
        for candle in candles:
            if len(candle) >= 5:
                parsed_candles.append({
                    'timestamp': candle[0],
                    'open': candle[1],
                    'close': candle[2],
                    'high': candle[3],
                    'low': candle[4]
                })
        
        # Обновляем последнюю свечу данными из history
        if parsed_candles and history:
            for tstamp, value in history:
                parsed_candles[-1]['close'] = value
                parsed_candles[-1]['timestamp'] = tstamp
                
                # Обновляем high/low
                if value > parsed_candles[-1]['high']:
                    parsed_candles[-1]['high'] = value
                if value < parsed_candles[-1]['low']:
                    parsed_candles[-1]['low'] = value
        
        return {
            'asset': asset,
            'period': period,
            'candles': parsed_candles,
            'updated_at': datetime.utcnow().isoformat()
        }

    def get_current_data(self, asset: str = 'EUR_USD', timeout: int = 10) -> Optional[Dict]:
        """
        Получение текущих данных по активу
        
        Args:
            asset: Название актива (EUR_USD, GBP_USD, и т.д.)
            timeout: Таймаут ожидания в секундах
            
        Returns:
            Dict: Данные по активу или None
        """
        if not self.running or not self.driver:
            logger.error("❌ Collector не запущен")
            return None
            
        start_time = time.time()
        messages = []
        
        # Собираем сообщения пока не найдём нужные
        while time.time() - start_time < timeout:
            new_messages = self.get_websocket_messages()
            
            for msg in new_messages:
                data = msg.get('data', {})
                
                # Проверяем opcode=2 (данные свечей)
                if msg.get('opcode') == 2 and isinstance(data, dict):
                    if data.get('asset') == asset or asset == 'ALL':
                        parsed = self.parse_candles_message(msg)
                        if parsed:
                            return parsed
                            
            time.sleep(0.5)
            
        logger.warning(f"⚠️ Таймаут получения данных для {asset}")
        return None

    def get_multiple_assets(self, assets: List[str], timeout: int = 15) -> List[Dict]:
        """
        Получение данных по нескольким активам
        
        Args:
            assets: Список активов
            timeout: Общий таймаут
            
        Returns:
            List[Dict]: Данные по всем активам
        """
        all_data = []
        start_time = time.time()
        
        while time.time() - start_time < timeout and self.running:
            messages = self.get_websocket_messages()
            
            for msg in messages:
                parsed = self.parse_candles_message(msg)
                if parsed and parsed['asset'] in assets:
                    # Проверяем что ещё не добавили
                    if not any(d['asset'] == parsed['asset'] for d in all_data):
                        all_data.append(parsed)
                        logger.info(f"✅ Получены данные для {parsed['asset']}")
                        
            # Если получили все данные, выходим
            if len(all_data) >= len(assets):
                break
                
            time.sleep(0.5)
            
        return all_data

    def wait_for_candles(self, count: int = 50, timeout: int = 30) -> List[Dict]:
        """
        Ожидание получения указанного количества свечей
        
        Args:
            count: Необходимое количество свечей
            timeout: Таймаут ожидания
            
        Returns:
            List[Dict]: Список свечей
        """
        start_time = time.time()
        all_candles = []
        
        while time.time() - start_time < timeout and self.running:
            messages = self.get_websocket_messages()
            
            for msg in messages:
                parsed = self.parse_candles_message(msg)
                if parsed:
                    candles = parsed.get('candles', [])
                    if len(candles) > len(all_candles):
                        all_candles = candles
                        logger.info(f"📊 Получено свечей: {len(candles)}")
                        
            if len(all_candles) >= count:
                break
                
            time.sleep(0.5)
            
        return all_candles


# Singleton instance
_collector: Optional[PocketOptionSeleniumCollector] = None


def get_collector(profile_path: Optional[str] = None) -> PocketOptionSeleniumCollector:
    """Получение экземпляра коллектора"""
    global _collector
    if _collector is None:
        _collector = PocketOptionSeleniumCollector(profile_path)
    return _collector


# Пример использования
async def main():
    collector = get_collector()
    
    try:
        # Запуск
        collector.start()
        
        # Ожидание загрузки
        logger.info("⏳ Ожидание данных (10 сек)...")
        await asyncio.sleep(10)
        
        # Получение данных
        logger.info("📊 Получение данных...")
        data = collector.get_current_data('EUR_USD', timeout=5)
        
        if data:
            print(f"\n{'='*60}")
            print(f"📈 Данные для {data['asset']}")
            print(f"{'='*60}")
            print(f"Таймфрейм: {data['period']} сек")
            print(f"Количество свечей: {len(data['candles'])}")
            
            if data['candles']:
                last_candle = data['candles'][-1]
                print(f"\nПоследняя свеча:")
                print(f"  Open:  {last_candle['open']:.5f}")
                print(f"  High:  {last_candle['high']:.5f}")
                print(f"  Low:   {last_candle['low']:.5f}")
                print(f"  Close: {last_candle['close']:.5f}")
                
        else:
            print("❌ Не удалось получить данные")
            
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        collector.stop()


if __name__ == '__main__':
    asyncio.run(main())
