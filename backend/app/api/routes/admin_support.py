from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models import User, SupportTicket, SupportMessage
from app.dependencies import get_admin_user

router = APIRouter(prefix="/api/admin/support", tags=["Admin Support"])


class MessageRequest(BaseModel):
    message: str


class AssignTicketRequest(BaseModel):
    assigned_to: int


class TicketStatusUpdate(BaseModel):
    status: str  # open, in_progress, closed


@router.get("/tickets", response_model=dict)
async def get_all_tickets(
    page: int = 1,
    per_page: int = 20,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение всех тикетов поддержки (Admin)"""
    try:
        print(f"📥 Getting tickets with status_filter={status_filter}")
        
        offset = (page - 1) * per_page

        # Базовый запрос
        query = select(SupportTicket, User).join(User, SupportTicket.user_id == User.id)

        # Фильтр по статусу (только если не 'all')
        if status_filter and status_filter in ['open', 'in_progress', 'closed']:
            print(f"🔍 Filtering by status: {status_filter}")
            query = query.where(SupportTicket.status == status_filter)

        # Общее количество (с учетом фильтра)
        count_query = select(func.count(SupportTicket.id))
        if status_filter and status_filter in ['open', 'in_progress', 'closed']:
            count_query = count_query.where(SupportTicket.status == status_filter)
        
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        print(f"📊 Total tickets: {total}")

        # Получаем тикеты
        query = query.order_by(SupportTicket.created_at.desc()).offset(offset).limit(per_page)
        result = await db.execute(query)
        tickets_with_users = result.all()
        print(f"📋 Found {len(tickets_with_users)} tickets")

        tickets_list = []
        for ticket, user in tickets_with_users:
            # Получаем количество непрочитанных сообщений
            unread_result = await db.execute(
                select(func.count(SupportMessage.id))
                .where(SupportMessage.ticket_id == ticket.id)
                .where(SupportMessage.is_staff_message == False)
                .where(SupportMessage.read_at == None)
            )
            unread_count = unread_result.scalar() or 0

            tickets_list.append({
                "id": ticket.id,
                "subject": ticket.subject,
                "status": ticket.status,
                "priority": ticket.priority,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name
                },
                "assigned_to": ticket.assigned_to,
                "created_at": ticket.created_at.strftime('%Y-%m-%dT%H:%M:%S.000Z') if ticket.created_at else datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z'),
                "updated_at": ticket.updated_at.strftime('%Y-%m-%dT%H:%M:%S.000Z') if ticket.updated_at else None,
                "unread_count": unread_count
            })

        # Статистика - считаем отдельно для каждого статуса
        total_result = await db.execute(select(func.count(SupportTicket.id)))
        total_count = total_result.scalar() or 0
        
        open_result = await db.execute(select(func.count(SupportTicket.id)).where(SupportTicket.status == 'open'))
        open_count = open_result.scalar() or 0
        
        in_progress_result = await db.execute(select(func.count(SupportTicket.id)).where(SupportTicket.status == 'in_progress'))
        in_progress_count = in_progress_result.scalar() or 0
        
        closed_result = await db.execute(select(func.count(SupportTicket.id)).where(SupportTicket.status == 'closed'))
        closed_count = closed_result.scalar() or 0

        print(f"📊 Stats: total={total_count}, open={open_count}, in_progress={in_progress_count}, closed={closed_count}")
        print(f"📋 Tickets found: {len(tickets_list)}")

        return {
            "success": True,
            "tickets": tickets_list,
            "total": total,
            "page": page,
            "per_page": per_page,
            "stats": {
                "total": total_count,
                "open": open_count,
                "in_progress": in_progress_count,
                "closed": closed_count
            }
        }

    except Exception as e:
        print(f"❌ Error in get_all_tickets: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets/{ticket_id}", response_model=dict)
async def get_ticket_admin(
    ticket_id: int,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение тикета с сообщениями (Admin)"""
    try:
        result = await db.execute(
            select(SupportTicket)
            .where(SupportTicket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()

        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")

        # Получаем пользователя
        user_result = await db.execute(
            select(User)
            .where(User.id == ticket.user_id)
        )
        user = user_result.scalar_one_or_none()

        # Получаем сообщения
        msg_result = await db.execute(
            select(SupportMessage)
            .where(SupportMessage.ticket_id == ticket_id)
            .order_by(SupportMessage.created_at.asc())
        )
        messages = msg_result.scalars().all()

        # Помечаем сообщения как прочитанные
        for msg in messages:
            if not msg.is_staff_message and msg.read_at is None:
                msg.read_at = datetime.utcnow()

        messages_list = []
        for msg in messages:
            messages_list.append({
                "id": msg.id,
                "message": msg.message,
                "is_staff_message": msg.is_staff_message,
                "created_at": msg.created_at.isoformat(),
                "user_id": msg.user_id
            })

        return {
            "success": True,
            "ticket": {
                "id": ticket.id,
                "subject": ticket.subject,
                "status": ticket.status,
                "priority": ticket.priority,
                "created_at": ticket.created_at.isoformat(),
                "user": {
                    "id": user.id if user else None,
                    "email": user.email if user else None,
                    "name": user.name if user else None
                }
            },
            "messages": messages_list
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tickets/{ticket_id}/assign", response_model=dict)
async def assign_ticket(
    ticket_id: int,
    data: AssignTicketRequest,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Назначение тикета ответственному (Admin)"""
    try:
        result = await db.execute(
            select(SupportTicket)
            .where(SupportTicket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()

        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")

        ticket.assigned_to = data.assigned_to
        ticket.status = "in_progress"
        ticket.updated_at = datetime.utcnow()

        await db.commit()

        return {
            "success": True,
            "message": "Тикет назначен",
            "assigned_to": data.assigned_to
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tickets/{ticket_id}/status", response_model=dict)
async def update_ticket_status(
    ticket_id: int,
    data: TicketStatusUpdate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновление статуса тикета (Admin)"""
    try:
        result = await db.execute(
            select(SupportTicket)
            .where(SupportTicket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()

        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")

        ticket.status = data.status
        if data.status == "closed":
            ticket.closed_at = datetime.utcnow()
        ticket.updated_at = datetime.utcnow()

        await db.commit()

        return {
            "success": True,
            "message": f"Статус тикета изменен на {data.status}"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tickets/{ticket_id}/messages", response_model=dict)
async def send_admin_message(
    ticket_id: int,
    data: MessageRequest,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Отправка сообщения от поддержки (Admin)"""
    try:
        result = await db.execute(
            select(SupportTicket)
            .where(SupportTicket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()

        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")

        # Создаем сообщение
        message = SupportMessage(
            ticket_id=ticket_id,
            user_id=current_user.id,
            message=data.message,
            is_staff_message=True
        )
        db.add(message)

        ticket.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(message)

        return {
            "success": True,
            "message": "Сообщение отправлено",
            "data": {
                "id": message.id,
                "user_id": message.user_id,  # Добавляем user_id для frontend
                "message": message.message,
                "is_staff_message": message.is_staff_message,
                "created_at": message.created_at.strftime('%Y-%m-%dT%H:%M:%S.000Z') if message.created_at else datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tickets/{ticket_id}/view")
async def update_view_status(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Обновить статус просмотра тикета"""
    try:
        from app.models import TicketViewer
        
        # Находим или создаем запись о просмотре
        viewer_result = await db.execute(
            select(TicketViewer)
            .where(TicketViewer.ticket_id == ticket_id)
            .where(TicketViewer.user_id == current_user.id)
        )
        viewer = viewer_result.scalar_one_or_none()

        if viewer:
            viewer.last_seen = datetime.utcnow()
        else:
            viewer = TicketViewer(
                ticket_id=ticket_id,
                user_id=current_user.id,
                last_seen=datetime.utcnow()
            )
            db.add(viewer)

        await db.commit()

        return {
            "success": True,
            "ticket_id": ticket_id,
            "user_id": current_user.id,
            "username": current_user.name or current_user.email,
            "role": current_user.role,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets/{ticket_id}/viewers")
async def get_viewers(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Получить список кто сейчас просматривает тикет"""
    try:
        from app.models import TicketViewer
        from datetime import timedelta
        
        # Получаем активных зрителей (кто был онлайн последние 5 секунд)
        five_seconds_ago = datetime.utcnow() - timedelta(seconds=5)
        result = await db.execute(
            select(TicketViewer, User)
            .join(User, TicketViewer.user_id == User.id)
            .where(TicketViewer.ticket_id == ticket_id)
            .where(TicketViewer.last_seen > five_seconds_ago)
            .where(TicketViewer.user_id != current_user.id)
        )
        
        viewers = []
        for viewer, user in result.all():
            viewers.append({
                "user_id": user.id,
                "username": user.name or user.email,
                "role": user.role,
                "last_seen": viewer.last_seen.isoformat()
            })

        return {
            "success": True,
            "ticket_id": ticket_id,
            "viewers": viewers,
            "count": len(viewers)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Импортируем хранилище из support.py
from app.api.routes.support import typing_status

@router.post("/tickets/{ticket_id}/typing")
async def update_typing_status(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Обновить статус 'печатает...' для админа/саппорта"""
    try:
        # Сохраняем статус с timestamp
        typing_status[ticket_id] = {
            "user_id": current_user.id,
            "username": current_user.name or current_user.email,
            "role": current_user.role,
            "timestamp": datetime.utcnow().timestamp()
        }
        
        return {
            "success": True,
            "ticket_id": ticket_id,
            "user_id": current_user.id,
            "username": current_user.name or current_user.email,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets/{ticket_id}/typing")
async def get_typing_status(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Получить кто сейчас печатает в тикете"""
    try:
        # Проверяем есть ли активный статус (не старше 3 секунд)
        if ticket_id in typing_status:
            status = typing_status[ticket_id]
            age = datetime.utcnow().timestamp() - status["timestamp"]
            
            # Если статус свежий (< 3 секунд) и это не текущий пользователь
            if age < 3 and status["user_id"] != current_user.id:
                return {
                    "success": True,
                    "is_typing": True,
                    "user_id": status["user_id"],
                    "username": status["username"],
                    "role": status["role"],
                    "age": age
                }
        
        return {
            "success": True,
            "is_typing": False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
