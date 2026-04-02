import { useEffect, useRef, useCallback, useState } from 'react';

interface UseWebSocketOptions {
  ticketId: number;
  authToken: string | null;
  userId: number;
  onMessage: (data: any) => void;
  onUserListUpdate?: (users: any[]) => void;
  enabled?: boolean;
}

export function useSupportWebSocket({ 
  ticketId, 
  authToken, 
  userId,
  onMessage,
  onUserListUpdate,
  enabled = true 
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  const connect = useCallback(() => {
    if (!enabled || !authToken) return;

    // Закрываем старое соединение если есть
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      // Передаем токен в URL для авторизации
      const wsUrl = `ws://localhost:8000/ws/support/${ticketId}?token=${encodeURIComponent(authToken)}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`🔌 Connected to support ticket ${ticketId}`);
        
        // Отправляем heartbeat каждые 30 секунд
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message:', data);
          
          if (data.type === 'new_message') {
            onMessage(data.data);
          } else if (data.type === 'user_list') {
            setOnlineUsers(data.users);
            if (onUserListUpdate) {
              onUserListUpdate(data.users);
            }
          } else if (data.type === 'pong') {
            // Ответ на heartbeat
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log(`🔌 Disconnected from ticket ${ticketId}. Code: ${event.code}, Reason: ${event.reason || 'Unknown'}`);
        
        // Очищаем heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        // Пытаемся переподключиться через 3 секунды
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connect();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
    }
  }, [ticketId, authToken, enabled, onMessage, onUserListUpdate]);

  // Подключение при монтировании
  useEffect(() => {
    connect();

    // Очистка при размонтировании
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [connect]);

  // Функция для отправки статуса печати
  const sendTypingStatus = useCallback((typing: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'typing', 
        is_typing: typing 
      }));
      setIsTyping(typing);
      
      // Сбрасываем статус печати через 2 секунды
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(false);
      }, 2000);
    }
  }, []);

  // Функция для отправки сообщения через WebSocket
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  return {
    connected: wsRef.current?.readyState === WebSocket.OPEN,
    onlineUsers,
    isTyping,
    sendTypingStatus,
    sendMessage,
    otherUsersTyping: onlineUsers.filter(u => u.user_id !== userId && u.is_typing)
  };
}
