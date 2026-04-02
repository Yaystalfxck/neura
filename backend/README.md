# Neura Backend - Python FastAPI

Бэкенд для Neura Trading Platform на Python + FastAPI + PostgreSQL.

## 📋 Требования

- Python 3.11+
- PostgreSQL 15+
- pip

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Настройка окружения

```bash
# Скопируйте .env.example в .env
cp .env.example .env

# Отредактируйте .env
nano .env  # или ваш редактор
```

**Обязательно измените:**
- `SECRET_KEY` - сгенерируйте случайную строку (минимум 32 символа)
- `DATABASE_URL` - подключите вашу PostgreSQL
- `SMTP_PASSWORD` - пароль для отправки email

### 3. Запуск PostgreSQL (Docker)

```bash
docker-compose up -d postgres
```

### 4. Применение миграций

```bash
alembic upgrade head
```

### 5. Запуск сервера

```bash
# Development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 🐳 Docker Compose (всё вместе)

```bash
docker-compose up -d
```

Это запустит:
- PostgreSQL на порту 5432
- FastAPI backend на порту 8000

## 📁 Структура проекта

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Точка входа FastAPI
│   ├── config.py            # Конфигурация
│   ├── database.py          # Подключение к БД
│   ├── models.py            # SQLAlchemy модели
│   ├── schemas.py           # Pydantic схемы
│   ├── dependencies.py      # FastAPI зависимости
│   ├── utils.py             # Утилиты (auth, password)
│   ├── email_service.py     # Email сервис
│   └── api/
│       ├── __init__.py
│       └── routes/
│           ├── auth.py          # /api/auth
│           ├── login.py         # /api/login
│           ├── register.py      # /api/register
│           ├── reset_password.py# /api/reset-password
│           ├── profile.py       # /api/profile
│           ├── user.py          # /api/user/*
│           ├── partner.py       # /api/partner/*
│           └── admin.py         # /api/admin/*
├── alembic/
│   ├── env.py
│   ├── versions/
│   │   └── 001_initial.py
│   └── script.py.mako
├── alembic.ini
├── requirements.txt
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

## 🔑 API Endpoints

### Auth
- `GET /api/auth` - Проверка авторизации
- `POST /api/login` - Вход
- `POST /api/register` - Регистрация
- `POST /api/reset-password` - Запрос сброса пароля
- `PUT /api/reset-password` - Проверка кода
- `PATCH /api/reset-password` - Установка нового пароля
- `POST /api/auth/logout` - Выход

### Profile
- `GET /api/profile` - Получить профиль
- `PUT /api/profile` - Обновить профиль
- `PUT /api/profile/password` - Сменить пароль

### Partner
- `GET /api/partner/referral-link` - Реферальная ссылка
- `GET /api/partner/stats` - Статистика
- `GET /api/partner/referrals` - Список рефералов
- `GET /api/partner/commissions` - История комиссий
- `POST /api/partner/request-payout` - Запрос выплаты

### Admin
- `GET /api/admin/users` - Все пользователи
- `GET /api/admin/users/{id}` - Пользователь по ID
- `PUT /api/admin/users/{id}/status` - Изменить статус
- `DELETE /api/admin/users/{id}` - Удалить
- `GET /api/admin/payouts` - Все выплаты
- `PUT /api/admin/payouts/{id}/status` - Изменить статус выплаты

### User
- `GET /api/user/signal-limits` - Лимиты сигналов
- `POST /api/user/sync-balance` - Синхронизация баланса

## 🔧 Миграции Alembic

```bash
# Создать новую миграцию
alembic revision --autogenerate -m "Description"

# Применить миграции
alembic upgrade head

# Откатить миграцию
alembic downgrade -1

# История миграций
alembic history
```

## 🧪 Тестирование

```bash
# Запустить тесты (когда будут добавлены)
pytest
```

## 📊 API Документация

После запуска сервера откройте:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🔐 Безопасность

- Пароли хешируются через bcrypt
- JWT токены для авторизации
- CORS настроен для frontend
- SQL injection защита через SQLAlchemy ORM

## 📝 Создание админа

```python
# В Python консоли после запуска
from app.database import AsyncSessionLocal, init_db
from app.models import User
from app.utils import get_password_hash
import asyncio

async def create_admin():
    await init_db()
    async with AsyncSessionLocal() as db:
        admin = User(
            name="Admin",
            email="admin@neura.com",
            password=get_password_hash("admin123"),
            pocket_option_id="ADMIN001",
            role="admin",
            balance=10000
        )
        db.add(admin)
        await db.commit()

asyncio.run(create_admin())
```

## 🤝 Интеграция с Frontend

Обновите `.env` в frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 📞 Поддержка

При проблемах:
1. Проверьте логи: `docker-compose logs -f backend`
2. Проверьте подключение к БД
3. Убедитесь, что все зависимости установлены
