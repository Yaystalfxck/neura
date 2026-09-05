FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Копирование requirements
COPY requirements.txt .

# Установка Python зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Fix the legacy logger call used by BinaryOptionsToolsV2.
RUN python -c "from pathlib import Path; p=Path('/usr/local/lib/python3.11/site-packages/BinaryOptionsToolsV2/pocketoption/asynchronous.py'); s=p.read_text(); s=s.replace('self.logger.warn(', 'self.logger.warning(').replace('self.logger.warning(', 'print('); p.write_text(s)" 2>/dev/null || true

# Копирование кода
COPY . .

# Экспортируем порт
EXPOSE 8000

# Команда запуска
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
