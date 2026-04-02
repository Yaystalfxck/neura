from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from app.database import get_db
from app.models import User, SupportTicket, SupportMessage, TicketViewer
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/support", tags=["Support"])


class CreateTicketRequest(BaseModel):
    subject: str
    message: str
    priority: str = "normal"


class TicketResponse(BaseModel):
    id: int
    subject: str
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime
    messages_count: int = 0


class MessageRequest(BaseModel):
    message: str


@router.post("/tickets", response_model=dict)
async def create_ticket(
    data: CreateTicketRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создание нового тикета поддержки"""
    try:
        ticket = SupportTicket(
            user_id=current_user.id,
            subject=data.subject,
            priority=data.priority,
            status="open"
        )
        db.add(ticket)
        await db.commit()
        await db.refresh(ticket)

        # Создаем первое сообщение
        first_message = SupportMessage(
            ticket_id=ticket.id,
            user_id=current_user.id,
            message=data.message,
            is_staff_message=False
        )
        db.add(first_message)
        await db.commit()

        ticket_created_at = ticket.created_at.strftime('%Y-%m-%dT%H:%M:%S.000Z') if ticket.created_at else datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')

        return {
            "success": True,
            "message": "Тикет поддержки создан",
            "ticket": {
                "id": ticket.id,
                "subject": ticket.subject,
                "status": ticket.status,
                "priority": ticket.priority,
                "created_at": ticket_created_at
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets", response_model=dict)
async def get_user_tickets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение списка тикетов пользователя"""
    try:
        result = await db.execute(
            select(SupportTicket)
            .where(SupportTicket.user_id == current_user.id)
            .order_by(SupportTicket.created_at.desc())
        )
        tickets = result.scalars().all()

        tickets_list = []
        for ticket in tickets:
            # Получаем количество сообщений
            msg_result = await db.execute(
                select(func.count(SupportMessage.id))
                .where(SupportMessage.ticket_id == ticket.id)
            )
            messages_count = msg_result.scalar() or 0

            created_at_str = ticket.created_at.strftime('%Y-%m-%dT%H:%M:%S.000Z') if ticket.created_at else datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')
            updated_at_str = ticket.updated_at.strftime('%Y-%m-%dT%H:%M:%S.000Z') if ticket.updated_at else None

            tickets_list.append({
                "id": ticket.id,
                "subject": ticket.subject,
                "status": ticket.status,
                "priority": ticket.priority,
                "created_at": created_at_str,
                "updated_at": updated_at_str,
                "messages_count": messages_count
            })

        return {
            "success": True,
            "tickets": tickets_list,
            "total": len(tickets_list)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets/{ticket_id}", response_model=dict)
async def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получение тикета с сообщениями"""
    try:
        result = await db.execute(
            select(SupportTicket)
            .where(SupportTicket.id == ticket_id)
            .where(SupportTicket.user_id == current_user.id)
        )
        ticket = result.scalar_one_or_none()

        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")

        # Получаем сообщения
        msg_result = await db.execute(
            select(SupportMessage)
            .where(SupportMessage.ticket_id == ticket_id)
            .order_by(SupportMessage.created_at.asc())
        )
        messages = msg_result.scalars().all()

        messages_list = []
        for msg in messages:
            created_at_str = msg.created_at.strftime('%Y-%m-%dT%H:%M:%S.000Z') if msg.created_at else datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')
            messages_list.append({
                "id": msg.id,
                "message": msg.message,
                "is_staff_message": msg.is_staff_message,
                "created_at": created_at_str,
                "user_id": msg.user_id
            })

        ticket_created_at = ticket.created_at.strftime('%Y-%m-%dT%H:%M:%S.000Z') if ticket.created_at else datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')

        return {
            "success": True,
            "ticket": {
                "id": ticket.id,
                "subject": ticket.subject,
                "status": ticket.status,
                "priority": ticket.priority,
                "created_at": ticket_created_at
            },
            "messages": messages_list
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tickets/{ticket_id}/messages", response_model=dict)
async def send_message(
    ticket_id: int,
    data: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отправка сообщения в тикет"""
    try:
        # Проверяем тикет
        result = await db.execute(
            select(SupportTicket)
            .where(SupportTicket.id == ticket_id)
            .where(SupportTicket.user_id == current_user.id)
        )
        ticket = result.scalar_one_or_none()

        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")

        if ticket.status == "closed":
            raise HTTPException(status_code=400, detail="Нельзя писать в закрытый тикет")

        # Проверяем что сообщение не пустое
        if not data.message or not data.message.strip():
            raise HTTPException(status_code=400, detail="Сообщение не может быть пустым")

        # Создаем сообщение
        # Для пользовательского API все сообщения от пользователя (не от поддержки)
        message = SupportMessage(
            ticket_id=ticket_id,
            user_id=current_user.id,
            message=data.message.strip(),
            is_staff_message=False  # Всегда False для пользовательского API
        )
        db.add(message)

        # Обновляем статус тикета
        if ticket.status == "closed":
            ticket.status = "open"
        ticket.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(message)

        # Форматируем дату в ISO 8601 формат без timezone для JavaScript
        created_at_str = message.created_at.strftime('%Y-%m-%dT%H:%M:%S.000Z') if message.created_at else datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')

        return {
            "success": True,
            "message": "Сообщение отправлено",
            "data": {
                "id": message.id,
                "user_id": message.user_id,  # Добавляем user_id для frontend
                "message": message.message,
                "is_staff_message": message.is_staff_message,
                "created_at": created_at_str
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tickets/{ticket_id}/typing")
async def update_typing_status(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить статус 'печатает...' для пользователя в тике"""
    try:
        # Проверяем доступ к тику
        result = await db.execute(
            select(SupportTicket)
            .where(SupportTicket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()

        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")

        # Проверяем права доступа
        if current_user.role not in ['admin', 'support'] and ticket.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Нет доступа к тику")

        return {
            "success": True,
            "user_id": current_user.id,
            "username": current_user.name or current_user.email,
            "timestamp": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tickets/{ticket_id}/view")
async def update_view_status(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить статус просмотра тикета (онлайн/оффлайн)"""
    try:
        # Проверяем доступ к тику
        result = await db.execute(
            select(SupportTicket)
            .where(SupportTicket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()

        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")

        # Проверяем права доступа
        if current_user.role not in ['admin', 'support'] and ticket.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Нет доступа к тику")

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

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets/{ticket_id}/viewers")
async def get_viewers(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить список кто сейчас просматривает тикет (онлайн < 5 секунд)"""
    try:
        # Проверяем доступ к тику
        result = await db.execute(
            select(SupportTicket)
            .where(SupportTicket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()

        if not ticket:
            raise HTTPException(status_code=404, detail="Тикет не найден")

        # Проверяем права доступа
        if current_user.role not in ['admin', 'support'] and ticket.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Нет доступа к тику")

        # Получаем активных зрителей (кто был онлайн последние 5 секунд)
        five_seconds_ago = datetime.utcnow() - timedelta(seconds=5)
        result = await db.execute(
            select(TicketViewer, User)
            .join(User, TicketViewer.user_id == User.id)
            .where(TicketViewer.ticket_id == ticket_id)
            .where(TicketViewer.last_seen > five_seconds_ago)
            .where(TicketViewer.user_id != current_user.id)  # Исключаем текущего пользователя
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

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Временное хранилище для статуса "печатает" (в продакшене лучше Redis)
typing_status: Dict[int, Dict] = {}

@router.post("/tickets/{ticket_id}/typing")
async def update_typing_status(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить статус 'печатает...' для пользователя"""
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
    current_user: User = Depends(get_current_user)
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
