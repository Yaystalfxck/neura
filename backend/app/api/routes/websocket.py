from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database import get_db
from app.models import User, SupportMessage, SupportTicket
from app.dependencies import get_current_user
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json

router = APIRouter(prefix="/ws", tags=["WebSocket"])

# Хранилище активных подключений: ticket_id -> list of {websocket, user_id, username, is_typing}
active_connections: Dict[int, List[dict]] = {}

# Хранилище онлайн пользователей: user_id -> last_seen
online_users: Dict[int, datetime] = {}

async def accept_connection(websocket: WebSocket, ticket_id: int, user_id: int, username: str, role: str):
    """Принять новое подключение"""
    await websocket.accept()
    if ticket_id not in active_connections:
        active_connections[ticket_id] = []
    
    connection = {
        "websocket": websocket,
        "user_id": user_id,
        "username": username,
        "role": role,
        "is_typing": False,
        "last_seen": datetime.utcnow()
    }
    active_connections[ticket_id].append(connection)
    online_users[user_id] = datetime.utcnow()
    
    print(f"🔌 {username} connected to ticket {ticket_id}. Total connections: {len(active_connections[ticket_id])}")
    
    # Отправляем список онлайн пользователей
    await broadcast_user_list(ticket_id)

def remove_connection(websocket: WebSocket, ticket_id: int):
    """Удалить подключение"""
    if ticket_id in active_connections:
        active_connections[ticket_id] = [
            conn for conn in active_connections[ticket_id] 
            if conn["websocket"] != websocket
        ]
        print(f"🔌 Client disconnected from ticket {ticket_id}. Remaining: {len(active_connections[ticket_id])}")
        if len(active_connections[ticket_id]) == 0:
            del active_connections[ticket_id]

async def broadcast_to_ticket(ticket_id: int, message: dict, exclude_user_id: Optional[int] = None):
    """Отправить сообщение всем подключенным к тику"""
    if ticket_id in active_connections:
        disconnected = []
        for connection in active_connections[ticket_id]:
            if exclude_user_id and connection["user_id"] == exclude_user_id:
                continue
            try:
                await connection["websocket"].send_json(message)
            except:
                disconnected.append(connection)
        
        # Удаляем отключенных клиентов
        for conn in disconnected:
            remove_connection(conn["websocket"], ticket_id)

async def broadcast_user_list(ticket_id: int):
    """Отправить список онлайн пользователей"""
    if ticket_id in active_connections:
        users = [
            {
                "user_id": conn["user_id"],
                "username": conn["username"],
                "role": conn["role"],
                "is_typing": conn["is_typing"],
                "last_seen": conn["last_seen"].isoformat()
            }
            for conn in active_connections[ticket_id]
        ]
        await broadcast_to_ticket(ticket_id, {
            "type": "user_list",
            "users": users
        })

async def update_typing_status(ticket_id: int, user_id: int, is_typing: bool):
    """Обновить статус печати"""
    if ticket_id in active_connections:
        for conn in active_connections[ticket_id]:
            if conn["user_id"] == user_id:
                conn["is_typing"] = is_typing
                conn["last_seen"] = datetime.utcnow()
                break
        await broadcast_user_list(ticket_id)

@router.websocket("/support/{ticket_id}")
async def support_websocket(
    websocket: WebSocket,
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    token: str = None  # Токен из query parameter
):
    """WebSocket для обновлений тикета поддержки"""
    # Авторизация через токен из query parameter
    from app.utils import decode_access_token
    
    if not token:
        await websocket.close(code=4001, reason="Token required")
        return
    
    payload = decode_access_token(token)
    if payload is None:
        await websocket.close(code=4002, reason="Invalid token")
        return
    
    user_id = payload.get("user_id")
    if user_id is None:
        await websocket.close(code=4002, reason="Invalid token")
        return
    
    # Получаем пользователя
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    current_user = result.scalar_one_or_none()
    
    if not current_user:
        await websocket.close(code=4003, reason="User not found")
        return
    
    # Проверяем доступ к тику
    result = await db.execute(
        select(SupportTicket)
        .where(SupportTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        await websocket.close(code=4004, reason="Ticket not found")
        return
    
    # Проверяем права доступа
    if current_user.role not in ['admin', 'support'] and ticket.user_id != current_user.id:
        await websocket.close(code=4003, reason="Access denied")
        return
    
    # Принимаем подключение
    await accept_connection(
        websocket, 
        ticket_id, 
        current_user.id, 
        current_user.name or current_user.email,
        current_user.role
    )
    
    try:
        while True:
            # Получаем данные от клиента
            data = await websocket.receive_json()
            
            if data.get('type') == 'typing':
                # Обновляем статус печати
                is_typing = data.get('is_typing', False)
                await update_typing_status(ticket_id, current_user.id, is_typing)
            
            elif data.get('type') == 'read':
                # Помечаем сообщения как прочитанные
                pass
            
            elif data.get('type') == 'ping':
                # Heartbeat
                await websocket.send_json({"type": "pong"})
            
    except WebSocketDisconnect:
        remove_connection(websocket, ticket_id)
        await broadcast_user_list(ticket_id)
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        remove_connection(websocket, ticket_id)
        await broadcast_user_list(ticket_id)

@router.get("/support/{ticket_id}/online")
async def get_online_users(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить список онлайн пользователей в тике"""
    users = []
    if ticket_id in active_connections:
        users = [
            {
                "user_id": conn["user_id"],
                "username": conn["username"],
                "role": conn["role"],
                "is_typing": conn["is_typing"],
                "last_seen": conn["last_seen"].isoformat()
            }
            for conn in active_connections[ticket_id]
        ]
    
    return {
        "success": True,
        "users": users,
        "count": len(users)
    }

@router.post("/support/notify/{ticket_id}")
async def notify_ticket_update(
    ticket_id: int,
    message_data: dict,
    sender_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Отправить уведомление об обновлении тикета"""
    await broadcast_to_ticket(ticket_id, {
        "type": "new_message",
        "data": message_data
    }, exclude_user_id=sender_id)
    
    return {"success": True, "sent_to": len(active_connections.get(ticket_id, []))}
