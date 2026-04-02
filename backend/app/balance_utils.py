"""
Утилиты для получения баланса пользователя
- Для flaun.feed@mail.ru баланс берётся с демо-счёта через WebSocket (в signal_po.py)
- Для остальных пользователей баланс обновляется из PO Affiliate API
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User, PocketOptionUser
from app.pocketoption_service import get_pocket_option_service
from datetime import datetime
import asyncio


async def get_user_balance(user: User, db: AsyncSession, sync_with_po: bool = False) -> float:
    """
    Получение баланса пользователя
    
    Args:
        user: Пользователь
        db: Сессия БД
        sync_with_po: Если True, синхронизировать с PO API перед возвратом
        
    Returns:
        Баланс пользователя
    """
    # Для flaun.feed@mail.ru - баланс обрабатывается в signal_po.py
    # Возвращаем из БД
    if user.email == "flaun.feed@mail.ru":
        return float(user.balance) if user.balance else 1000.0
    
    # Для остальных - синхронизация с PO Affiliate API и получение из БД
    if sync_with_po:
        try:
            po_service = get_pocket_option_service()
            user_data = await po_service.get_user_data(user.pocket_option_id)
            
            if user_data:
                # Обновляем данные в БД
                new_balance = user_data.get("current_balance", 0.0)
                total_deposit = user_data.get("total_deposit", 0.0)
                deposits_count = user_data.get("deposits_count", 0)
                
                user.balance = new_balance
                
                # Обновляем PocketOptionUser
                po_user_result = await db.execute(
                    select(PocketOptionUser).where(PocketOptionUser.pocket_option_id == user.pocket_option_id)
                )
                po_user = po_user_result.scalar_one_or_none()
                
                if po_user:
                    po_user.current_balance = new_balance
                    po_user.total_deposit = total_deposit
                    po_user.deposits_count = deposits_count
                    po_user.last_sync = datetime.utcnow()
                else:
                    po_user = PocketOptionUser(
                        pocket_option_id=user.pocket_option_id,
                        email=user_data.get("email", ""),
                        current_balance=new_balance,
                        total_deposit=total_deposit,
                        deposits_count=deposits_count,
                        last_sync=datetime.utcnow()
                    )
                    db.add(po_user)
                
                await db.commit()
                print(f"✅ Синхронизирован баланс из PO API для {user.email}: ${new_balance}")
                return new_balance
        except Exception as e:
            print(f"⚠️ Не удалось синхронизировать с PO API: {e}")
            # Продолжаем с балансом из БД
    
    # Для остальных - из БД
    po_result = await db.execute(
        select(PocketOptionUser.current_balance)
        .where(PocketOptionUser.pocket_option_id == user.pocket_option_id)
    )
    po_row = po_result.scalar_one_or_none()
    
    if po_row:
        return float(po_row)
    
    return float(user.balance) if user.balance else 0.0


def clear_demo_balance_cache():
    """Очистить кэш баланса демо-счёта"""
    pass  # Больше не используется
