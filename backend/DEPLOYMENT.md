# Neura Trading Platform — Установка и запуск на сервере Ubuntu

## Содержание
1. [Требования к серверу](#1-требования-к-серверу)
2. [Подготовка сервера](#2-подготовка-сервера)
3. [Клонирование проекта](#3-клонирование-проекта)
4. [Установка Docker и Docker Compose](#4-установка-docker-и-docker-compose)
5. [Настройка Backend](#5-настройка-backend)
6. [Настройка Frontend](#6-настройка-frontend)
7. [Настройка Nginx](#7-настройка-nginx)
8. [SSL-сертификаты (Let's Encrypt)](#8-ssl-сертификаты-lets-encrypt)
9. [Настройка фаервола (UFW)](#9-настройка-фаервола-ufw)
10. [Первый запуск и проверка](#10-первый-запуск-и-проверка)
11. [Обслуживание](#11-обслуживание)
12. [Реферальная система](#12-реферальная-система)

---

## 1. Требования к серверу

| Ресурс | Минимум | Рекомендация |
|--------|---------|-------------|
| CPU    | 2 ядра  | 4 ядра      |
| RAM    | 4 GB    | 8 GB        |
| Disk   | 20 GB SSD | 40 GB SSD |
| OS     | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

---

## 2. Подготовка сервера

### Подключение

```bash
ssh root@<IP-адрес-сервера>
```

### Обновление системы

```bash
apt update && apt upgrade -y
```

### Установка базовых утилит

```bash
apt install -y curl wget git nano htop ufw
```

---

## 3. Клонирование проекта

```bash
# Создаем директорию
mkdir -p /opt/neura
cd /opt/neura

# Клонируем весь репозиторий
git clone https://github.com/Yaystalfxck/neura.git .

# Проверяем структуру
ls -la backend/ web/
```

Структура проекта:

```
/opt/neura/
├── backend/          # Python FastAPI
│   ├── .env.example
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
└── web/              # Next.js Frontend
    ├── .env.example (или .env.local)
    ├── package.json
    └── app/
```

---

## 4. Установка Docker и Docker Compose

```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Автозапуск Docker
systemctl enable docker
systemctl start docker

# Проверка
docker --version
docker compose version
```

---

## 5. Настройка Backend

### 5.1. Создание .env файла

```bash
cd /opt/neura/backend
cp .env.example .env
nano .env
```

Заполните `.env`:

```env
# Database (для Docker — оставляем как есть, Docker сам создаст БД)
DATABASE_URL=postgresql+asyncpg://neura:neura_password@postgres:5432/neura_db

# JWT
SECRET_KEY=<сгенерируйте случайную строку 32+ символов>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=7

# SMTP (email для восстановления пароля)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ваш-email@gmail.com
SMTP_PASSWORD=<App Password из Google Account>
SMTP_FROM=ваш-email@gmail.com

# API URLs (замените на ваш домен после настройки)
API_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# PocketOption Affiliate API
POCKETOPTION_API_TOKEN=<ваш API токен>
NEXT_PUBLIC_PARTNER_ID=<ваш partner ID>
POCKETOPTION_EMAIL=<email аккаунта PO>
POCKETOPTION_PASSWORD=<пароль аккаунта PO>

# PocketOption WebSocket (для сигналов)
POCKETOPTION_SESSION_TOKEN=<session token из cookies браузера>
POCKETOPTION_UID=<ваш UID>
POCKETOPTION_WS_URL=wss://api-us-north.po.market/socket.io/?EIO=4&transport=websocket
```

> **App Password для Gmail:** https://myaccount.google.com/apppasswords  
> **SECRET_KEY** — сгенерировать: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`

### 5.2. Запуск Backend

```bash
cd /opt/neura/backend
docker compose up -d --build
```

Контейнеры:
- `neura_postgres` — PostgreSQL 15
- `neura_backend` — FastAPI на порту 8000

### 5.3. Применение миграций БД

```bash
docker compose exec backend alembic upgrade head
```

### 5.4. Создание администратора

```bash
docker compose exec backend python3 -c "
from app.database import AsyncSessionLocal, init_db
from app.models import User
from app.utils import get_password_hash
import asyncio

async def create_admin():
    await init_db()
    async with AsyncSessionLocal() as db:
        admin = User(
            name='Admin',
            email='admin@neura.com',
            password=get_password_hash('admin123'),
            pocket_option_id='ADMIN001',
            role='admin',
            balance=10000
        )
        db.add(admin)
        await db.commit()

asyncio.run(create_admin())
"
```

### 5.5. Проверка

```bash
docker compose ps
docker compose logs -f backend
curl http://localhost:8000/docs
```

---

## 6. Настройка Frontend

### 6.1. Создание .env.local

```bash
cd /opt/neura/web
nano .env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Для server-side API вызовов
DATABASE_URL=postgresql://neura:neura_password@localhost:5432/neura_db

# PocketOption (дублируются из backend для server-side)
POCKETOPTION_API_TOKEN=<ваш API токен>
NEXT_PUBLIC_PARTNER_ID=<ваш partner ID>
POCKETOPTION_EMAIL=<email аккаунта PO>
POCKETOPTION_PASSWORD=<пароль аккаунта PO>
```

### 6.2. Установка Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version
npm --version
```

### 6.3. Установка зависимостей и сборка

```bash
cd /opt/neura/web
npm install
npm run build
```

### 6.4. Запуск через PM2

```bash
# Установка PM2
npm install -g pm2

# Запуск
pm2 start npm --name "neura-web" -- start

# Автозапуск
pm2 save
pm2 startup
# Выполните команду, которую выведет pm2 startup
```

### 6.5. Проверка

```bash
pm2 status
curl http://localhost:3000
```

---

## 7. Настройка Nginx

### 7.1. Установка

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### 7.2. Конфигурация

```bash
nano /etc/nginx/sites-available/neura
```

```nginx
# Frontend (порт 3000)
server {
    listen 80;
    server_name ваш-домен.com www.ваш-домен.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API (порт 8000)
server {
    listen 80;
    server_name api.ваш-домен.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **Замените** `ваш-домен.com` на ваш реальный домен.

### 7.3. Активация

```bash
ln -s /etc/nginx/sites-available/neura /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

---

## 8. SSL-сертификаты (Let's Encrypt)

```bash
# Установка Certbot
apt install -y certbot python3-certbot-nginx

# Получение сертификатов
certbot --nginx -d ваш-домен.com -d www.ваш-домен.com
certbot --nginx -d api.ваш-домен.com
```

Certbot автоматически обновит конфигурацию Nginx с SSL.

### Автообновление

```bash
certbot renew --dry-run
# Certbot автоматически обновляет сертификаты через systemd timer
```

### После SSL — обновите .env

**Backend `.env`:**
```env
API_URL=https://api.ваш-домен.com
FRONTEND_URL=https://ваш-домен.com
```

**Frontend `.env.local`:**
```env
NEXT_PUBLIC_API_URL=https://api.ваш-домен.com
NEXT_PUBLIC_APP_URL=https://ваш-домен.com
```

Перезапустите сервисы:
```bash
cd /opt/neura/backend && docker compose down && docker compose up -d --build
cd /opt/neura/web && pm2 restart neura-web
```

---

## 9. Настройка фаервола (UFW)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

---

## 10. Первый запуск и проверка

### Проверка всех сервисов

```bash
# Backend
docker compose -f /opt/neura/backend/docker-compose.yml ps

# Frontend
pm2 status

# Nginx
systemctl status nginx
```

### Тестирование

```bash
# Frontend
curl -I https://ваш-домен.com

# Backend API
curl https://api.ваш-домен.com/api/health

# Swagger Docs
curl https://api.ваш-домен.com/docs
```

### Логи

```bash
# Backend
docker compose -f /opt/neura/backend/docker-compose.yml logs -f backend

# Frontend
pm2 logs neura-web

# Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 11. Обслуживание

### Обновление проекта

```bash
cd /opt/neura
git pull

# Backend
cd /opt/neura/backend
docker compose down
docker compose up -d --build
docker compose exec backend alembic upgrade head

# Frontend
cd /opt/neura/web
npm install
npm run build
pm2 restart neura-web
```

### Бэкап базы данных

```bash
mkdir -p /opt/neura/backups

# Создать бэкап
docker compose -f /opt/neura/backend/docker-compose.yml exec postgres \
  pg_dump -U neura neura_db > /opt/neura/backups/backup_$(date +%Y%m%d).sql

# Восстановить из бэкапа
cat /opt/neura/backups/backup_20260101.sql | \
  docker compose -f /opt/neura/backend/docker-compose.yml exec -T postgres \
  psql -U neura -d neura_db
```

### Мониторинг

```bash
# Ресурсы контейнеров
docker stats

# Системные ресурсы
htop
df -h
free -h

# PM2 мониторинг
pm2 monit
```

### Очистка Docker

```bash
# Удаление неиспользуемых образов и контейнеров
docker system prune -af

# Удаление старых томов
docker volume prune -f
```

### Перезапуск сервисов

```bash
# Backend
docker compose -f /opt/neura/backend/docker-compose.yml restart

# Frontend
pm2 restart neura-web

# Nginx
systemctl restart nginx
```

---

## DNS-записи

В панели управления доменом создайте:

| Тип | Имя | Значение        | TTL  |
|-----|-----|----------------|------|
| A   | @   | IP-адрес сервера | 3600 |
| A   | api | IP-адрес сервера | 3600 |

---

## Быстрый старт — все команды по порядку

```bash
# 1. Подготовка
ssh root@<IP>
apt update && apt upgrade -y
apt install -y curl wget git nano htop ufw

# 2. Клонирование
mkdir -p /opt/neura && cd /opt/neura
git clone https://github.com/Yaystalfxck/neura.git .

# 3. Docker
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
systemctl enable docker && systemctl start docker

# 4. Backend .env
cd /opt/neura/backend
cp .env.example .env
nano .env  # ← заполните все значения

# 5. Запуск Backend
docker compose up -d --build
docker compose exec backend alembic upgrade head

# 6. Frontend .env.local
cd /opt/neura/web
nano .env.local  # ← заполните значения

# 7. Node.js + Frontend
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install
npm run build
npm install -g pm2
pm2 start npm --name "neura-web" -- start
pm2 save
pm2 startup  # ← выполните выведенную команду

# 8. Nginx
apt install -y nginx
nano /etc/nginx/sites-available/neura  # ← вставьте конфиг
ln -s /etc/nginx/sites-available/neura /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 9. SSL
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ваш-домен.com -d www.ваш-домен.com
certbot --nginx -d api.ваш-домен.com

# 10. Фаервол
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## 12. Реферальная система

### Как это работает

```
Пользователь А (приглашающий)
    │
    ├── Получает уникальную ссыл: https://ваш-домен.com/?ref=ABC123
    │
    └── Пользователь Б переходит по ссылке → регистрируется
            │
            ├── Запись о реферале создаётся автоматически
            ├── Счётчик registrations увеличивается
            │
            └── Когда Б делает депозит → А получает комиссию
```

### Автоматическое начисление комиссии

Комиссия начисляется **автоматически** при синхронизации баланса (`/api/user/sync-balance`):

1. Бэкенд получает `total_deposit` от PocketOption API
2. Сравнивает с предыдущим значением в БД
3. Если депозит увеличился → находит реферера → создаёт комиссию

### Процент комиссии по рангам

| Ранг | % комиссии | Рефералов | Депозитов рефералов |
|------|-----------|-----------|---------------------|
| Bronze | 5% | 0 | $0 |
| Silver | 7% | 10 | $1,000 |
| Gold | 10% | 25 | $5,000 |
| Platinum | 12% | 50 | $10,000 |
| Diamond | 15% | 100 | $25,000 |

Ранг обновляется автоматически при проверке ранга (`/api/referral/check-rank/{user_id}`).

### Ключевые эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/partner/referral-link` | Получить свою реферальную ссылку |
| POST | `/api/partner/track-click` | Отслеживание клика по ссылке |
| GET | `/api/partner/stats` | Статистика партнёра |
| GET | `/api/partner/referrals` | Список рефералов |
| GET | `/api/partner/commissions` | История комиссий |
| POST | `/api/partner/request-payout` | Запрос выплаты |
| POST | `/api/referral/track-deposit` | Отслеживание депозита реферала |
| POST | `/api/referral/check-rank/{user_id}` | Проверка/обновление ранга |
| GET | `/api/referral/stats/{user_id}` | Статистика по рефералам |

### Защита от дублей

- **Клики:** in-memory кэш, игнорирует повторные клики в течение 30 секунд
- **Комиссии:** проверка по уникальному `source_id` — комиссия за один депозит создаётся только один раз
- **Регистрации:** уникальный `referred_id` в БД — пользователь может быть приглашён только один раз

### Пример: сколько заработает приглашающий

Если пригласить 5 человек и каждый внесёт по $100:

- Ранг: **Bronze** (5%)
- Общий депозит: $500
- Комиссия: $500 × 5% = **$25**

При ранге **Gold** (10%) с тех же депозитов: $500 × 10% = **$50**
