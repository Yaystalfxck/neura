from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import User, PartnerPayout, Referral, Commission, PocketOptionUser
from app.schemas import UserStatusUpdate, PayoutStatusUpdate, APIResponse
from app.dependencies import get_admin_user
from typing import List
from datetime import datetime

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/users", response_model=dict)
async def get_all_users(
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение списка всех пользователей (Admin)"""
    offset = (page - 1) * per_page

    # Общее количество
    result = await db.execute(select(func.count(User.id)))
    total = result.scalar() or 0

    # Пользователи
    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    users = result.scalars().all()

    users_list = []
    for user in users:
        # Получаем данные PocketOption для каждого пользователя
        po_data = None
        if user.pocket_option_id:
            po_result = await db.execute(
                select(PocketOptionUser).where(PocketOptionUser.pocket_option_id == user.pocket_option_id)
            )
            po_user = po_result.scalar_one_or_none()
            if po_user:
                po_data = {
                    "current_balance": float(po_user.current_balance) if po_user.current_balance else 0,
                    "total_deposit": float(po_user.total_deposit) if po_user.total_deposit else 0,
                    "deposits_count": po_user.deposits_count or 0,
                    "verification_status": po_user.verification_status,
                }

        # Используем баланс из PocketOption если он есть, иначе из БД
        balance = float(po_data["current_balance"]) if po_data else float(user.balance or 0)

        users_list.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "balance": balance,
            "status": user.status,
            "role": user.role,
            "pocket_option_id": user.pocket_option_id,
            "referral_rank": user.referral_rank,
            "total_referrals": user.total_referrals or 0,
            "active_referrals": user.active_referrals or 0,
            "total_commission": float(user.total_commission or 0),
            "pending_commission": float(user.pending_commission or 0),
            "paid_commission": float(user.paid_commission or 0),
            "created_at": user.created_at,
            "po_data": po_data
        })

    # Получаем общую статистику
    stats_result = await db.execute(
        select(
            func.count(User.id).label('total_users'),
        )
    )
    stats_row = stats_result.first()

    # Считаем активных и заблокированных отдельно
    active_result = await db.execute(
        select(func.count(User.id)).where(User.status == 'active')
    )
    active_users = active_result.scalar() or 0

    blocked_result = await db.execute(
        select(func.count(User.id)).where(User.status == 'blocked')
    )
    blocked_users = blocked_result.scalar() or 0

    # Статистика по депозитам и балансу из PocketOption
    deposit_stats = await db.execute(
        select(
            func.sum(PocketOptionUser.total_deposit).label('total_deposits'),
            func.sum(PocketOptionUser.current_balance).label('total_balance_po'),
            func.count(PocketOptionUser.id).label('users_with_po'),
        )
    )
    deposit_row = deposit_stats.first()

    # Общий баланс из PocketOption
    total_balance_po = float(deposit_row.total_balance_po or 0) if deposit_row else 0
    total_balance_po = total_balance_po if total_balance_po > 0 else 0

    return {
        "success": True,
        "users": users_list,
        "total": total,
        "page": page,
        "per_page": per_page,
        "stats": {
            "totalUsers": stats_row.total_users or 0 if stats_row else 0,
            "activeUsers": active_users,
            "blockedUsers": blocked_users,
            "totalBalance": total_balance_po,
            "averageBalance": float(total_balance_po / max(active_users, 1)) if active_users > 0 else 0,
            "totalDeposits": float(deposit_row.total_deposits or 0) if deposit_row else 0,
            "totalWithdrawals": 0,
            "usersWithPO": deposit_row.users_with_po or 0 if deposit_row else 0,
        }
    }


@router.get("/users/{user_id}", response_model=dict)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение пользователя по ID (Admin)"""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    return {
        "success": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "balance": user.balance,
            "status": user.status,
            "role": user.role,
            "pocket_option_id": user.pocket_option_id,
            "phone": user.phone,
            "country": user.country,
            "language": user.language,
            "referral_code": user.referral_code,
            "total_referrals": user.total_referrals,
            "total_commission": user.total_commission,
            "created_at": user.created_at,
        }
    }


@router.put("/users/{user_id}/status", response_model=dict)
async def update_user_status(
    user_id: int,
    status_data: UserStatusUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновление статуса пользователя (Admin)"""
    if status_data.status not in ["active", "blocked", "inactive"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный статус",
        )

    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    user.status = status_data.status
    await db.commit()

    return {
        "success": True,
        "message": f"Статус пользователя изменен на {status_data.status}",
    }


@router.put("/users/{user_id}/role", response_model=dict)
async def update_user_role(
    user_id: int,
    role_data: dict,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Изменение роли пользователя (Admin)"""
    new_role = role_data.get("role", "user")
    
    if new_role not in ["user", "admin", "support"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректная роль. Доступны: user, admin, support",
        )

    # 🔴 ПРОВЕРКА: Только главный админ (flaun.feed@mail.ru) может выдавать роли
    MASTER_ADMIN_EMAIL = "flaun.feed@mail.ru"
    
    if current_user.email != MASTER_ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только главный администратор может изменять роли",
        )

    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    # Нельзя менять роль самому главному админу
    if user.email == MASTER_ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нельзя изменить роль главного администратора",
        )

    old_role = user.role
    user.role = new_role
    await db.commit()

    print(f"👑 Роль пользователя {user.email} изменена: {old_role} → {new_role} (админ: {current_user.email})")

    return {
        "success": True,
        "message": f"Роль пользователя изменена на {new_role}",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
        }
    }


@router.delete("/users/{user_id}", response_model=dict)
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Удаление пользователя (Admin)"""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    await db.delete(user)
    await db.commit()

    return {
        "success": True,
        "message": "Пользователь удален",
    }


@router.get("/payouts", response_model=dict)
async def get_all_payouts(
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение всех выплат (Admin)"""
    offset = (page - 1) * per_page

    result = await db.execute(select(func.count(PartnerPayout.id)))
    total = result.scalar() or 0

    result = await db.execute(
        select(PartnerPayout, User)
        .join(User, PartnerPayout.user_id == User.id)
        .order_by(PartnerPayout.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    payouts = result.all()

    payouts_list = [
        {
            "id": p[0].id,
            "user_id": p[0].user_id,
            "user": {
                "id": p[1].id if p[1] else None,
                "name": p[1].name if p[1] else None,
                "email": p[1].email if p[1] else None,
                "pocket_option_id": p[1].pocket_option_id if p[1] else None,
            } if p[1] else None,
            "amount": p[0].amount,
            "method": p[0].method,
            "details": p[0].details,
            "status": p[0].status,
            "created_at": p[0].created_at,
            "processed_at": p[0].processed_at,
        }
        for p in payouts
    ]

    # Получаем статистику
    stats_result = await db.execute(
        select(
            func.sum(PartnerPayout.amount).label('pending_amount'),
            func.count(PartnerPayout.id).label('pending_count'),
        )
        .where(PartnerPayout.status == "pending")
    )
    stats_row = stats_result.first()
    pending_amount = float(stats_row[0]) if stats_row and stats_row[0] else 0
    pending_count = stats_row[1] or 0 if stats_row else 0

    return {
        "success": True,
        "payouts": payouts_list,
        "total": total,
        "page": page,
        "per_page": per_page,
        "stats": {
            "totalPending": pending_count,
            "totalProcessing": 0,
            "totalCompleted": 0,
            "totalAmount": pending_amount,
            "pendingAmount": pending_amount,
            "completedAmount": 0
        }
    }


@router.put("/payouts/{payout_id}/status", response_model=dict)
async def update_payout_status(
    payout_id: int,
    status_data: PayoutStatusUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновление статуса выплаты (Admin)"""
    valid_statuses = ["pending", "processing", "completed", "failed", "cancelled"]
    
    if status_data.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный статус",
        )

    result = await db.execute(
        select(PartnerPayout).where(PartnerPayout.id == payout_id)
    )
    payout = result.scalar_one_or_none()

    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Выплата не найдена",
        )

    # Обновление статуса выплаты
    payout.status = status_data.status

    if status_data.status in ["completed", "failed", "cancelled"]:
        payout.processed_at = func.now()

    # Обновление баланса пользователя
    if status_data.status == "completed":
        # Выплата подтверждена - переводим из pending в paid
        user_result = await db.execute(
            select(User).where(User.id == payout.user_id)
        )
        user = user_result.scalar_one_or_none()

        if user:
            user.paid_commission = (user.paid_commission or 0) + payout.amount
            # pending уже был уменьшен при создании заявки на выплату

    elif status_data.status in ["cancelled", "failed"]:
        # Выплата отклонена - возвращаем деньги в pending и восстанавливаем комиссии
        user_result = await db.execute(
            select(User).where(User.id == payout.user_id)
        )
        user = user_result.scalar_one_or_none()

        if user:
            # Возвращаем сумму обратно в pending_commission
            user.pending_commission = (user.pending_commission or 0) + payout.amount
            
            # Восстанавливаем статус комиссий из "reserved" в "pending"
            commissions_result = await db.execute(
                select(Commission)
                .where(Commission.user_id == user.id)
                .where(Commission.status == "reserved")
                .order_by(Commission.created_at)
            )
            reserved_commissions = commissions_result.scalars().all()
            
            total_restored = 0
            for comm in reserved_commissions:
                comm.status = "pending"
                comm.paid_at = None
                total_restored += comm.amount
                if total_restored >= payout.amount:
                    break

    await db.commit()

    return {
        "success": True,
        "message": "Статус выплаты обновлен",
    }


@router.get("/payouts/stats", response_model=dict)
async def get_payout_stats(
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Статистика выплат (Admin)"""
    # Всего выплат
    result = await db.execute(select(func.count(PartnerPayout.id)))
    total_payouts = result.scalar() or 0

    # Ожидающие выплаты (количество и сумма)
    result = await db.execute(
        select(
            func.count(PartnerPayout.id),
            func.sum(PartnerPayout.amount)
        )
        .where(PartnerPayout.status == "pending")
    )
    pending_row = result.first()
    pending_count = pending_row[0] or 0 if pending_row else 0
    pending_amount = pending_row[1] or 0 if pending_row else 0

    # В обработке
    result = await db.execute(
        select(
            func.count(PartnerPayout.id),
            func.sum(PartnerPayout.amount)
        )
        .where(PartnerPayout.status == "processing")
    )
    processing_row = result.first()
    processing_count = processing_row[0] or 0 if processing_row else 0
    processing_amount = processing_row[1] or 0 if processing_row else 0

    # Выплаченные (количество и сумма)
    result = await db.execute(
        select(
            func.count(PartnerPayout.id),
            func.sum(PartnerPayout.amount)
        )
        .where(PartnerPayout.status == "completed")
    )
    completed_row = result.first()
    completed_count = completed_row[0] or 0 if completed_row else 0
    completed_amount = completed_row[1] or 0 if completed_row else 0

    return {
        "success": True,
        "stats": {
            "total_payouts": total_payouts,
            "pending_count": pending_count,
            "pending_amount": float(pending_amount),
            "processing_count": processing_count,
            "processing_amount": float(processing_amount),
            "completed_count": completed_count,
            "completed_amount": float(completed_amount),
        }
    }


@router.post("/users/{user_id}/sync-po", response_model=dict)
async def sync_user_pocketoption_data(
    user_id: int,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Синхронизация данных пользователя с PocketOption API (Admin)"""
    try:
        # Находим пользователя
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not user.pocket_option_id:
            raise HTTPException(status_code=400, detail="PocketOption ID not specified")

        # Получаем сервис PocketOption
        from app.pocketoption_service import get_pocket_option_service
        po_service = get_pocket_option_service()

        # Получаем данные из API
        po_data = await po_service.get_user_data(user.pocket_option_id)

        if not po_data:
            raise HTTPException(status_code=404, detail="User not found in PocketOption")

        # Обновляем баланс пользователя
        new_balance = po_data.get("current_balance", 0.0)
        user.balance = new_balance

        # Обновляем/создаем запись в PocketOptionUser
        po_user_result = await db.execute(
            select(PocketOptionUser).where(PocketOptionUser.pocket_option_id == user.pocket_option_id)
        )
        po_user = po_user_result.scalar_one_or_none()

        if po_user:
            # Обновляем существующую запись
            po_user.current_balance = new_balance
            po_user.total_deposit = po_data.get("total_deposit", 0.0)
            po_user.deposits_count = po_data.get("deposits_count", 0)
            po_user.email = po_data.get("email", "")
            po_user.verification_status = po_data.get("verification_status", "pending")
            po_user.last_sync = datetime.utcnow()
        else:
            # Создаем новую запись
            from datetime import datetime as dt_module
            po_user = PocketOptionUser(
                pocket_option_id=user.pocket_option_id,
                email=po_data.get("email", ""),
                current_balance=new_balance,
                total_deposit=po_data.get("total_deposit", 0.0),
                deposits_count=po_data.get("deposits_count", 0),
                verification_status=po_data.get("verification_status", "pending"),
                last_sync=dt_module.utcnow()
            )
            db.add(po_user)

        await db.commit()

        print(f"✅ Admin sync: User {user.email}, PO ID: {user.pocket_option_id}, Balance: ${new_balance}, Deposits: ${po_data.get('total_deposit', 0)}")

        return {
            "success": True,
            "message": "Data synchronized successfully",
            "balance": new_balance,
            "total_deposit": po_data.get("total_deposit", 0.0),
            "deposits_count": po_data.get("deposits_count", 0)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error syncing PO data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
