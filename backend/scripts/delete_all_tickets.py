#!/usr/bin/env python3
"""
Скрипт для удаления всех тикетов поддержки
Использование: python scripts/delete_all_tickets.py
"""
import asyncio
import sys
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

# Добавляем backend в path
sys.path.insert(0, '.')

from app.database import AsyncSessionLocal
from app.models import SupportTicket, SupportMessage, TicketViewer


async def delete_all_tickets():
    """Удалить все тикеты поддержки с сообщениями и зрителями"""
    async with AsyncSessionLocal() as db:
        try:
            # Удаляем все сообщения (так как они связаны с тикетами)
            result = await db.execute(delete(SupportMessage))
            msg_count = result.rowcount
            print(f'🗑️ Удалено сообщений: {msg_count}')
            
            # Удаляем всех зрителей тикетов
            result = await db.execute(delete(TicketViewer))
            viewer_count = result.rowcount
            print(f'🗑️ Удалено записей зрителей: {viewer_count}')
            
            # Удаляем все тикеты
            result = await db.execute(delete(SupportTicket))
            ticket_count = result.rowcount
            print(f'🗑️ Удалено тикетов: {ticket_count}')
            
            await db.commit()
            
            print(f'\n✅ Все тикеты успешно удалены!')
            print(f'📊 Всего удалено: {ticket_count} тикет(ов), {msg_count} сообщени(й), {viewer_count} запис(ей) зрителей')
            
        except Exception as e:
            print(f'❌ Ошибка: {e}')
            await db.rollback()
            raise


if __name__ == '__main__':
    asyncio.run(delete_all_tickets())
