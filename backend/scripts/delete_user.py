#!/usr/bin/env python3
"""
Скрипт для удаления пользователя по email
Использование: python scripts/delete_user.py <email>
"""
import asyncio
import sys
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

# Добавляем backend в path
sys.path.insert(0, '.')

from app.database import AsyncSessionLocal
from app.models import User, SupportTicket, SupportMessage, TicketViewer, ReferralLink, Referral, Commission, PartnerPayout, SignalUsage, PocketOptionUser


async def delete_user(email: str):
    """Удалить пользователя по email со всеми связанными данными"""
    async with AsyncSessionLocal() as db:
        try:
            # Ищем пользователя
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            
            if not user:
                print(f'❌ Пользователь {email} не найден')
                return
            
            user_id = user.id
            print(f'🔍 Найден пользователь: ID={user_id}, email={email}')
            
            # Удаляем связанные записи в порядке зависимости
            # Сообщения поддержки
            result = await db.execute(delete(SupportMessage).where(SupportMessage.user_id == user_id))
            print(f'🗑️ Удалено сообщений: {result.rowcount}')
            
            # Зрители тикетов
            result = await db.execute(delete(TicketViewer).where(TicketViewer.user_id == user_id))
            print(f'🗑️ Удалено записей зрителей: {result.rowcount}')
            
            # Тикеты поддержки (как автор)
            result = await db.execute(delete(SupportTicket).where(SupportTicket.user_id == user_id))
            print(f'🗑️ Удалено тикетов: {result.rowcount}')
            
            # Реферальные ссылки
            result = await db.execute(delete(ReferralLink).where(ReferralLink.user_id == user_id))
            print(f'🗑️ Удалено реферальных ссылок: {result.rowcount}')
            
            # Рефералы (где этот пользователь referrer)
            result = await db.execute(delete(Referral).where(Referral.referrer_id == user_id))
            print(f'🗑️ Удалено рефералов (как пригласивший): {result.rowcount}')
            
            # Рефералы (где этот пользователь referred)
            result = await db.execute(delete(Referral).where(Referral.referred_id == user_id))
            print(f'🗑️ Удалено рефералов (как приглашённый): {result.rowcount}')
            
            # Комиссии
            result = await db.execute(delete(Commission).where(Commission.user_id == user_id))
            print(f'🗑️ Удалено комиссий: {result.rowcount}')
            
            # Выплаты
            result = await db.execute(delete(PartnerPayout).where(PartnerPayout.user_id == user_id))
            print(f'🗑️ Удалено выплат: {result.rowcount}')
            
            # Использование сигналов
            result = await db.execute(delete(SignalUsage).where(SignalUsage.user_id == user_id))
            print(f'🗑️ Удалено записей использования сигналов: {result.rowcount}')
            
            # PocketOption данные
            result = await db.execute(delete(PocketOptionUser).where(PocketOptionUser.pocket_option_id == user.pocket_option_id))
            print(f'🗑️ Удалено записей PocketOption: {result.rowcount}')
            
            # Удаляем пользователя
            result = await db.execute(delete(User).where(User.id == user_id))
            print(f'🗑️ Удалён пользователь: {email}')
            
            await db.commit()
            
            print(f'\n✅ Пользователь {email} успешно удалён!')
            
        except Exception as e:
            print(f'❌ Ошибка: {e}')
            await db.rollback()
            raise


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Использование: python scripts/delete_user.py <email>')
        sys.exit(1)
    
    email = sys.argv[1]
    asyncio.run(delete_user(email))
