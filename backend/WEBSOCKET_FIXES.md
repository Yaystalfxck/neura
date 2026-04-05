# WebSocket Connection Management - Исправления

## Проблема
При множественных запросах сигналов WebSocket соединения не закрывались корректно, что приводило к:
- Превышению лимита подключений на стороне Pocket Option
- Невозможности новых подключений с сайта
- Ошибке "WebSocket is closed before the connection is established"

## Решение

### 1. **Автоматическая очистка при shutdown сервера**
В `backend/app/main.py` добавлен cleanup WebSocket при остановке сервера:

```python
@app.on_event("shutdown")
async def shutdown_event():
    """Очистка при остановке"""
    await close_db()
    
    # Закрываем WebSocket соединение с Pocket Option
    if _pocket_option_ws and _pocket_option_ws.is_connected():
        await _pocket_option_ws.disconnect()
```

### 2. **Отслеживание активных подписок**
В `PocketOptionWebSocket` классе добавлен словарь `active_subscriptions` для отслеживания всех активных подписок.

### 3. **Предотвращение дублирования подписок**
Методы `subscribe_to_candles` и `subscribe_to_quotes` теперь проверяют есть ли уже такая подписка, прежде чем создавать новую.

### 4. **Методы для управления подписками**
Добавлены новые методы:
- `unsubscribe_from_candles(asset_id, timeframe)` - отписка от конкретных свечей
- `unsubscribe_all()` - отписка от всех подписок
- `get_active_subscriptions()` - получение списка активных подписок

### 5. **API endpoints для мониторинга и управления**

#### Получить информацию о подписках:
```
GET /api/po/ws/subscriptions
```

**Response:**
```json
{
  "success": true,
  "connected": true,
  "state": "authorized",
  "subscriptions": {
    "candles:1:60": {
      "type": "candles",
      "asset_id": 1,
      "timeframe": 60,
      "subscribed_at": "2024-01-15T10:30:00"
    }
  },
  "subscription_count": 1
}
```

#### Отписаться от всех подписок (для отладки):
```
POST /api/po/ws/unsubscribe-all
```

#### Переподключить WebSocket (для отладки):
```
POST /api/po/ws/reconnect
```

## Как использовать

### Мониторинг подписок
Чтобы проверить сколько у вас активных WebSocket подписок:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/po/ws/subscriptions
```

### Очистка подписок при проблемах
Если у вас проблемы с подключением и вы хотите очистить все подписки:

```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/po/ws/unsubscribe-all
```

### Переподключение WebSocket
Если WebSocket соединение работает некорректно:

```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/po/ws/reconnect
```

## Рекомендации

1. **Не делайте слишком много запросов подряд** - каждый запрос не создает новое WebSocket соединение благодаря singleton паттерну
2. **Проверяйте статус подписок** перед тем как создавать новые
3. **При проблемах с подключением** используйте endpoint `/api/po/ws/reconnect`
4. **При перезапуске сервера** все WebSocket соединения закрываются корректно автоматически

## Архитектура

```
┌─────────────────────────────────────────┐
│         FastAPI Server (Backend)        │
│                                         │
│  Singleton: PocketOptionWebSocket       │
│  ├─ Active Subscriptions Tracker        │
│  ├─ Prevent Duplicate Subscriptions     │
│  └─ Auto-cleanup on Shutdown            │
│                                         │
│  API Endpoints:                         │
│  ├─ GET  /api/po/ws/subscriptions       │
│  ├─ POST /api/po/ws/unsubscribe-all     │
│  └─ POST /api/po/ws/reconnect           │
└──────────────┬──────────────────────────┘
               │
               │ WebSocket (single connection)
               │
               ▼
┌─────────────────────────────────────────┐
│       Pocket Option WebSocket API       │
│  - Tracks connection state              │
│  - Manages subscriptions                │
│  - Sends real-time data                 │
└─────────────────────────────────────────┘
```

## Тестирование

После внесения изменений:

1. Перезапустите backend сервер
2. Сделайте несколько запросов сигналов
3. Проверьте статус подписок через `/api/po/ws/subscriptions`
4. Убедитесь что подписки не дублируются
5. Перезапустите сервер и убедитесь что соединение закрылось корректно
