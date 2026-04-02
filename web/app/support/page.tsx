"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Plus,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  User,
  Shield,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useRouter } from 'next/navigation';

interface Ticket {
  id: number;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  messages_count: number;
}

interface Message {
  id: number;
  message: string;
  is_staff_message: boolean;
  created_at: string;
  user_id: number;
}

export default function SupportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState('normal');
  const [lastMessageTime, setLastMessageTime] = useState<number>(0);
  const [isSupportOnline, setIsSupportOnline] = useState(false);
  const [isSupportTyping, setIsSupportTyping] = useState(false);

  // Отслеживаем открытие тикета через backend API
  useEffect(() => {
    if (!selectedTicket || !user) return;

    // Отправляем на сервер что открыли тикет
    const updateViewStatus = async () => {
      try {
        await fetch(`/api/support/tickets/${selectedTicket.id}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
      } catch (error) {
        console.error('Error updating view status:', error);
      }
    };

    // Обновляем сразу и затем каждые 3 секунды
    updateViewStatus();
    const interval = setInterval(updateViewStatus, 3000);

    return () => clearInterval(interval);
  }, [selectedTicket, user]);

  // Получаем кто онлайн из backend API
  useEffect(() => {
    if (!selectedTicket) {
      console.log('❌ No selectedTicket for viewers check');
      return;
    }

    console.log('🔍 Starting viewers check for ticket:', selectedTicket.id);

    const checkViewers = async () => {
      try {
        console.log('📡 Fetching viewers...');
        const response = await fetch(`/api/support/tickets/${selectedTicket.id}/viewers`, {
          credentials: 'include',
        });
        console.log('📥 Response status:', response.status);
        const data = await response.json();
        console.log('📊 Viewers response:', data);

        if (data.success) {
          // Проверяем есть ли поддержка (админ/саппорт) среди зрителей
          const viewersArray = Array.isArray(data.viewers) ? data.viewers : [data.viewers];
          console.log('👥 All viewers:', viewersArray);
          const hasSupport = viewersArray.some((v: any) => {
            console.log('  Viewer:', v, 'role:', v?.role, 'is support?', ['admin', 'support'].includes(v?.role));
            return v && ['admin', 'support'].includes(v.role);
          });
          console.log('🟢 Support online:', hasSupport);
          setIsSupportOnline(hasSupport);
        } else {
          console.log('❌ Response not success');
          setIsSupportOnline(false);
        }
      } catch (error) {
        console.error('❌ Error checking viewers:', error);
        
      }
    };

    // Проверяем каждые 2 секунды
    const interval = setInterval(checkViewers, 2000);
    checkViewers(); // Первая проверка сразу

    return () => clearInterval(interval);
  }, [selectedTicket]);

  // Получаем кто печатает
  useEffect(() => {
    if (!selectedTicket) return;

    const checkTyping = async () => {
      try {
        const response = await fetch(`/api/support/tickets/${selectedTicket.id}/typing`, {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (data.success) {
          console.log('⌨️ Typing status:', data);
          setIsSupportTyping(data.is_typing || false);
        }
      } catch (error) {
        console.error('❌ Error checking typing:', error);
      }
    };

    // Проверяем каждые 1 секунду
    const interval = setInterval(checkTyping, 1000);
    checkTyping();

    return () => clearInterval(interval);
  }, [selectedTicket]);

  // Отправляем статус "печатает" при вводе текста
  const handleTyping = () => {
    if (!selectedTicket) return;
    
    // Отправляем статус что пользователь печатает
    fetch(`/api/support/tickets/${selectedTicket.id}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }).catch(console.error);
  };

  // Polling для real-time обновлений (каждые 2 секунды)
  useEffect(() => {
    if (!selectedTicket) return;

    const refreshInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/support/tickets/${selectedTicket.id}`, {
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success && data.messages) {
          const lastMsgTime = data.messages.length > 0
            ? new Date(data.messages[data.messages.length - 1].created_at).getTime()
            : 0;

          if (lastMsgTime > lastMessageTime) {
            setMessages(data.messages);
            setLastMessageTime(lastMsgTime);
            // Убрал автопрокрутку - не скроллит страницу
          }
          
          // Обновляем статус тикета если изменился
          if (data.ticket && data.ticket.status !== selectedTicket.status) {
            console.log('📊 Ticket status changed:', selectedTicket.status, '→', data.ticket.status);
            // Обновляем статус в selectedTicket
            setSelectedTicket({...selectedTicket, status: data.ticket.status});
          }
        }
      } catch (error) {
        console.error('Error auto-refreshing messages:', error);
      }
    }, 2000); // 2 seconds

    return () => clearInterval(refreshInterval);
  }, [selectedTicket, lastMessageTime]);

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

  const loadTickets = async () => {
    try {
      const response = await fetch('/api/support/tickets', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTicket = async (ticketId: number) => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setSelectedTicket(data.ticket);
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error loading ticket:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: newMessage })
      });

      const data = await response.json();
      if (data.success) {
        setMessages([...messages, data.data]);
        setNewMessage('');
        setLastMessageTime(new Date(data.data.created_at).getTime());
        loadTickets();
      } else {
        console.error('Failed to send message:', data);
        alert(data.error || 'Ошибка при отправке сообщения');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Ошибка при отправке сообщения');
    } finally {
      setIsSending(false);
    }
  };

  const createTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: newTicketSubject,
          message: newTicketMessage,
          priority: newTicketPriority
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewTicketSubject('');
        setNewTicketMessage('');
        setNewTicketPriority('normal');
        loadTickets();
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      open: 'bg-green-500/20 text-green-400',
      in_progress: 'bg-blue-500/20 text-blue-400',
      closed: 'bg-gray-500/20 text-gray-400'
    };
    const labels: Record<string, string> = {
      open: language === 'en' ? 'Open' : 'Открыт',
      in_progress: language === 'en' ? 'In Progress' : 'В работе',
      closed: language === 'en' ? 'Closed' : 'Закрыт'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[status] || badges.open}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, string> = {
      low: 'bg-gray-500/20 text-gray-400',
      normal: 'bg-blue-500/20 text-blue-400',
      high: 'bg-orange-500/20 text-orange-400',
      urgent: 'bg-red-500/20 text-red-400'
    };
    const labels: Record<string, string> = {
      low: language === 'en' ? 'Low' : 'Низкий',
      normal: language === 'en' ? 'Normal' : 'Обычный',
      high: language === 'en' ? 'High' : 'Высокий',
      urgent: language === 'en' ? 'Urgent' : 'Срочный'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[priority] || badges.normal}`}>
        {labels[priority] || priority}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-6 text-gray-400 text-lg">{language === 'en' ? 'Loading...' : 'Загрузка...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {language === 'en' ? 'Support Center' : 'Центр поддержки'}
            </h1>
            <p className="text-gray-400 mt-2">
              {language === 'en' ? 'Create tickets and get help from our team' : 'Создавайте тикеты и получайте помощь от нашей команды'}
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {language === 'en' ? 'New Ticket' : 'Новый тикет'}
          </Button>
        </div>

        {selectedTicket ? (
          /* Chat View */
          <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-2xl overflow-hidden">
            {/* Ticket Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTicket(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <h2 className="text-xl font-bold">{selectedTicket.subject}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                      <span className="text-xs text-gray-400">
                        {new Date(selectedTicket.created_at).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                      </span>
                      {/* Индикатор онлайн поддержки */}
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
                        isSupportOnline
                          ? 'bg-green-900/30 border-green-500/30'
                          : 'bg-gray-700/30 border-gray-500/30'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          isSupportOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                        }`} />
                        <span className={`text-xs ${
                          isSupportOnline ? 'text-green-400' : 'text-gray-400'
                        }`}>
                          {language === 'en' ? 'Support online' : 'Поддержка онлайн'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => {
                // Сообщение от пользователя если user_id совпадает с текущим пользователем
                const isMyMessage = msg.user_id === user?.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 break-words overflow-wrap-break-word ${
                        isMyMessage
                          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700'
                          : 'bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {isMyMessage ? (
                          <>
                            <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-400 truncate">{language === 'en' ? 'You' : 'Вы'}</span>
                          </>
                        ) : (
                          <>
                            <Shield className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="text-xs text-blue-400 font-medium truncate">
                              {language === 'en' ? 'Support Team' : 'Команда поддержки'}
                            </span>
                          </>
                        )}
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {new Date(msg.created_at).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap break-words overflow-wrap-break-word">{msg.message}</p>
                    </div>
                  </div>
                );
              })}
              <div id="messages-end" />
            </div>

            {/* Message Input */}
            <div className="p-6 border-t border-white/10">
              {selectedTicket.status === 'closed' ? (
                <div className="text-center py-4 px-6 bg-gray-800/30 border border-gray-700 rounded-xl">
                  <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400 font-medium">
                    {language === 'en' ? 'This ticket is closed' : 'Этот тикет закрыт'}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    {language === 'en' ? 'You cannot send messages to closed tickets' : 'Вы не можете отправлять сообщения в закрытые тикеты'}
                  </p>
                  <Button
                    onClick={() => {
                      setNewTicketSubject(selectedTicket.subject);
                      setNewTicketMessage('');
                      setNewTicketPriority('normal');
                      setShowCreateModal(true);
                    }}
                    className="mt-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'Create new ticket' : 'Создать новый тикет'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Индикатор что поддержка печатает */}
                  {isSupportTyping && (
                    <div className="flex items-center gap-2 px-4 py-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                      </div>
                      <span className="text-sm text-blue-400 italic">
                        {language === 'en' ? 'Support is typing...' : 'Поддержка печатает...'}
                      </span>
                    </div>
                  )}
                  
                  {/* Поле ввода с улучшенным UX */}
                  <div className="relative">
                    <textarea
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder={language === 'en'
                        ? 'Type your message... (Enter to send, Shift+Enter for new line)'
                        : 'Введите сообщение... (Enter для отправки, Shift+Enter для новой строки)'}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none min-h-[80px]"
                      rows={3}
                    />
                    <div className="absolute bottom-3 right-3">
                      <Button
                        onClick={sendMessage}
                        disabled={isSending || !newMessage.trim()}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        size="sm"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Tickets List */
          <div className="grid gap-4">
            {tickets.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400">
                  {language === 'en' ? 'No tickets yet. Create your first ticket!' : 'Пока нет тикетов. Создайте свой первый тикет!'}
                </p>
              </div>
            ) : (
              tickets.map((ticket) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => loadTicket(ticket.id)}
                  className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-xl p-6 cursor-pointer hover:border-blue-500/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">{ticket.subject}</h3>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {ticket.messages_count} {language === 'en' ? 'messages' : 'сообщений'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        {new Date(ticket.created_at).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-gradient-to-b from-gray-900 to-black border border-gray-800 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">
                    {language === 'en' ? 'Create New Ticket' : 'Создать новый тикет'}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      {language === 'en' ? 'Subject' : 'Тема'}
                    </label>
                    <input
                      type="text"
                      value={newTicketSubject}
                      onChange={(e) => setNewTicketSubject(e.target.value)}
                      placeholder={language === 'en' ? 'Brief description of your issue' : 'Краткое описание вашей проблемы'}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      {language === 'en' ? 'Priority' : 'Приоритет'}
                    </label>
                    <select
                      value={newTicketPriority}
                      onChange={(e) => setNewTicketPriority(e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="low">{language === 'en' ? 'Low' : 'Низкий'}</option>
                      <option value="normal">{language === 'en' ? 'Normal' : 'Обычный'}</option>
                      <option value="high">{language === 'en' ? 'High' : 'Высокий'}</option>
                      <option value="urgent">{language === 'en' ? 'Urgent' : 'Срочный'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      {language === 'en' ? 'Message' : 'Сообщение'}
                    </label>
                    <textarea
                      value={newTicketMessage}
                      onChange={(e) => setNewTicketMessage(e.target.value)}
                      placeholder={language === 'en' ? 'Describe your issue in detail' : 'Подробно опишите вашу проблему'}
                      rows={5}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 border-gray-700"
                    >
                      {language === 'en' ? 'Cancel' : 'Отмена'}
                    </Button>
                    <Button
                      onClick={createTicket}
                      disabled={isSending || !newTicketSubject.trim() || !newTicketMessage.trim()}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      {isSending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                          {language === 'en' ? 'Creating...' : 'Создание...'}
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          {language === 'en' ? 'Create Ticket' : 'Создать тикет'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
