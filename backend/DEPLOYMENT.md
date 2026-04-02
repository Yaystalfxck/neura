# Neura Trading Platform - Руководство по установке на сервер

## Содержание
1. [Требования к серверу](#требования-к-серверу)
2. [Подготовка сервера](#подготовка-сервера)
3. [Установка Docker](#установка-docker)
4. [Настройка Backend](#настройка-backend)
5. [Настройка Frontend](#настройка-frontend)
6. [Подключение домена](#подключение-домена)
7. [Настройка Nginx](#настройка-nginx)
8. [SSL сертификаты](#ssl-сертификаты)
9. [Запуск проекта](#запуск-проекта)
10. [Мониторинг и обслуживание](#мониторинг-и-обслуживание)

---

## Требования к серверу

**Минимальные:**
- CPU: 2 ядра
- RAM: 4 GB
- Disk: 20 GB SSD
- OS: Ubuntu 20.04/22.04 LTS

**Рекомендуемые:**
- CPU: 4 ядра
- RAM: 8 GB
- Disk: 40 GB SSD
- OS: Ubuntu 22.04 LTS

---

## Подготовка сервера

### 1. Подключение к серверу
```bash
ssh root@your-server-ip
```

### 2. Обновление системы
```bash
apt update && apt upgrade -y
```

### 3. Создание пользователя (опционально)
```bash
adduser neura
usermod -aG sudo neura
su - neura
```

---

## Установка Docker

### 1. Установка Docker и Docker Compose
```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Проверка установки
docker --version
docker-compose --version
```

---

## Настройка Backend

### 1. Загрузка файлов проекта
```bash
# Создаем директорию
mkdir -p /opt/neura
cd /opt/neura

# Копируем файлы backend (через scp, git или вручную)
# Пример с git:
git clone <your-repo-url> backend
cd backend
```

### 2. Настройка переменных окружения
```bash
# Копируем .env.example в .env
cp .env.example .env

# Редактируем .env
nano .env
```

**Важно:** Никогда не коммитьте `.env` файлы в git! Используйте `.env.example` как шаблон.

### 3. Конфигурация .env
```bash
# Database
DATABASE_URL=postgresql+asyncpg://neura:neura_password@postgres:5432/neura_db

# JWT Settings
SECRET_KEY=your-super-secret-key-min-32-characters-long-for-security
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=7

# SMTP Email Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # App Password, не обычный пароль!
SMTP_FROM=noreply@yourdomain.com

# API Settings
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# PocketOption API Settings
POCKETOPTION_API_TOKEN=your-api-token
NEXT_PUBLIC_PARTNER_ID=your-partner-id
POCKETOPTION_EMAIL=your-po-email
POCKETOPTION_PASSWORD=your-po-password
```

### 4. Запуск Backend
```bash
# Запуск через Docker Compose
docker-compose up -d

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f backend
docker-compose logs -f postgres
```

### 5. Инициализация базы данных
```bash
# Запуск миграций (если используется Alembic)
docker-compose exec backend alembic upgrade head

# Создание суперпользователя (опционально)
docker-compose exec backend python -c "from app.database import *; from app.models import *; import asyncio; asyncio.run(create_admin())"
```

---

## Настройка Frontend

### 1. Загрузка файлов проекта
```bash
cd /opt/neura
git clone <your-repo-url> web
cd web
```

### 2. Настройка переменных окружения
```bash
# Создаем .env.local из .env.example
cp .env.example .env.local

# Редактируем .env.local
nano .env.local
```

**Важно:** Никогда не коммитьте `.env.local` файлы в git! Используйте `.env.example` как шаблон.

### 3. Конфигурация .env.local
```bash
# Frontend environment variables
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Database (PostgreSQL) - для server-side операций
DATABASE_URL=postgres://neura:neura_password@localhost:5432/neura_db

# PocketOption API Settings
POCKETOPTION_API_TOKEN=your-api-token
NEXT_PUBLIC_PARTNER_ID=your-partner-id
POCKETOPTION_EMAIL=your-po-email
POCKETOPTION_PASSWORD=your-po-password
```

### 4. Установка зависимостей и сборка
```bash
# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка зависимостей
npm install

# Сборка проекта
npm run build
```

### 5. Настройка PM2 (Process Manager)
```bash
# Установка PM2
sudo npm install -g pm2

# Запуск приложения
pm2 start npm --name "neura-web" -- start

# Сохранение конфигурации
pm2 save

# Автозапуск при загрузке
pm2 startup
# Выполните команду которую выведет pm2 startup
```

---

## Подключение домена

### 1. Настройка DNS записей

В панели управления доменом создайте записи:

```
Тип    Имя              Значение              TTL
A      @                ваш-server-ip         3600
A      api              ваш-server-ip         3600
CNAME  www              yourdomain.com        3600
```

### 2. Проверка DNS
```bash
# Проверка DNS записей
nslookup yourdomain.com
nslookup api.yourdomain.com
```

---

## Настройка Nginx

### 1. Установка Nginx
```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2. Конфигурация Nginx

Создайте файл конфигурации:
```bash
sudo nano /etc/nginx/sites-available/neura
```

### 3. Конфигурация для Frontend + Backend
```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Активация конфигурации
```bash
# Создание символической ссылки
sudo ln -s /etc/nginx/sites-available/neura /etc/nginx/sites-enabled/

# Удаление дефолтной конфигурации
sudo rm /etc/nginx/sites-enabled/default

# Проверка конфигурации
sudo nginx -t

# Перезапуск Nginx
sudo systemctl restart nginx
```

---

## SSL сертификаты

### 1. Установка Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Получение сертификатов
```bash
# Для frontend
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Для backend API
sudo certbot --nginx -d api.yourdomain.com
```

### 3. Автообновление сертификатов
```bash
# Проверка автообновления
sudo certbot renew --dry-run

# Certbot автоматически обновит сертификаты
```

### 4. Конфигурация Nginx с SSL (автоматически создается Certbot)

Nginx конфигурация будет обновлена автоматически с SSL настройками.

---

## Запуск проекта

### 1. Проверка всех сервисов
```bash
# Backend
docker-compose ps

# Frontend
pm2 status

# Nginx
sudo systemctl status nginx
```

### 2. Просмотр логов
```bash
# Backend логи
docker-compose logs -f backend

# Frontend логи
pm2 logs neura-web

# Nginx логи
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 3. Тестирование
```bash
# Проверка frontend
curl https://yourdomain.com

# Проверка backend API
curl https://api.yourdomain.com/api/health

# Проверка WebSocket (если есть)
curl -i https://api.yourdomain.com/api/
```

---

## Мониторинг и обслуживание

### 1. Мониторинг ресурсов
```bash
# Использование Docker
docker stats

# Использование PM2
pm2 monit

# Системные ресурсы
htop
df -h
free -h
```

### 2. Резервное копирование базы данных
```bash
# Создание бэкапа
docker-compose exec postgres pg_dump -U neura neura_db > backup_$(date +%Y%m%d).sql

# Восстановление из бэкапа
cat backup_20260101.sql | docker-compose exec -T postgres psql -U neura -d neura_db
```

### 3. Обновление проекта
```bash
# Backend
cd /opt/neura/backend
git pull
docker-compose down
docker-compose up -d --build

# Frontend
cd /opt/neura/web
git pull
npm install
npm run build
pm2 restart neura-web
```

### 4. Очистка старых Docker образов
```bash
# Удаление неиспользуемых образов
docker image prune -a

# Удаление старых контейнеров
docker container prune
```

---

## Безопасность

### 1. Настройка фаервола
```bash
# Установка UFW
sudo apt install ufw

# Разрешение SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'

# Включение фаервола
sudo ufw enable
sudo ufw status
```

### 2. Настройка Fail2Ban
```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Обновление системы
```bash
# Автоматические обновления безопасности
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Решение проблем

### Backend не запускается
```bash
# Проверка логов
docker-compose logs backend

# Пересоздание контейнера
docker-compose down
docker-compose up -d --build
```

### Frontend не доступен
```bash
# Проверка PM2
pm2 status
pm2 logs neura-web

# Перезапуск
pm2 restart neura-web
```

### Ошибки Nginx
```bash
# Проверка конфигурации
sudo nginx -t

# Перезапуск
sudo systemctl restart nginx

# Логи
sudo tail -f /var/log/nginx/error.log
```

### Проблемы с SSL
```bash
# Пересоздание сертификата
sudo certbot delete --cert-name yourdomain.com
sudo certbot --nginx -d yourdomain.com

# Проверка автообновления
sudo certbot renew --dry-run
```

---

## Контакты и поддержка

При возникновении проблем:
1. Проверьте логи сервисов
2. Убедитесь что все порты открыты
3. Проверьте DNS записи
4. Убедитесь что SSL сертификаты действительны

**Документация:**
- [Docker](https://docs.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Nginx](https://nginx.org/en/docs/)
- [Certbot](https://certbot.eff.org/docs/)
- [PM2](https://pm2.keymetrics.io/docs/)
- [Next.js](https://nextjs.org/docs)
- [FastAPI](https://fastapi.tiangolo.com/)
