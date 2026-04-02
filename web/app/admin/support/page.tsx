"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Send,
  Shield,
  User,
  ChevronLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { AdminNav } from '@/components/admin/AdminNav';
import { MobileAdminHeader, MobileSidebar } from '@/components/admin/MobileAdminHeader';

interface Ticket {
  id: number;
  subject: string;
  status: string;
  priority: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
  unread_count: number;
}

interface Message {
  id: number;
  message: string;
  is_staff_message: boolean;
  created_at: string;
  user_id: number;
}

export default function AdminSupportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketStats, setTicketStats] = useState({ total: 0, open: 0, in_progress: 0, closed: 0 });
  const [lastMessageTime, setLastMessageTime] = useState<number>(0);
  const [isUserOnline, setIsUserOnline] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [lastTicketsRefresh, setLastTicketsRefresh] = useState<number>(Date.now());

  // Автообновление списка тикетов каждые 10 секунд
  useEffect(() => {
    const ticketsInterval = setInterval(() => {
      if (!selectedTicket) {
        loadTickets();
      }
      setLastTicketsRefresh(Date.now());
    }, 10000);

    return () => clearInterval(ticketsInterval);
  }, [selectedTicket]);

  // Отслеживаем открытие тикета через backend API
  useEffect(() => {
    if (!selectedTicket || !user) {
      console.log('❌ No selectedTicket or user for view status');
      return;
    }

    console.log('🔍 Starting view status updates for ticket:', selectedTicket.id, 'user:', user.id);

    const updateViewStatus = async () => {
      try {
        console.log('📡 Sending view status...');
        const response = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        console.log('📥 View status response:', response.status);
      } catch (error) {
        console.error('❌ Error updating view status:', error);
      }
    };

    updateViewStatus();
    const interval = setInterval(updateViewStatus, 3000);

    return () => clearInterval(interval);
  }, [selectedTicket, user]);

  // Получаем кто онлайн из backend API
  useEffect(() => {
    if (!selectedTicket) return;

    const checkViewers = async () => {
      try {
        const response = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/viewers`, {
          credentials: 'include',
        });
        const data = await response.json();
        
        console.log('📊 Viewers response:', data);

        if (data.success) {
          // Проверяем есть ли обычный пользователь среди зрителей
          const viewersArray = Array.isArray(data.viewers) ? data.viewers : [data.viewers];
          console.log('👥 All viewers:', viewersArray);
          const hasUser = viewersArray.some((v: any) => {
            console.log('  Viewer:', v, 'role:', v?.role, 'is user?', v?.role === 'user');
            return v && v.role === 'user';
          });
          console.log('👤 User online:', hasUser);
          setIsUserOnline(hasUser);
        } else {
          setIsUserOnline(false);
        }
      } catch (error) {
        console.error('❌ Error checking viewers:', error);
        setIsUserOnline(false);
      }
    };

    const interval = setInterval(checkViewers, 2000);
    checkViewers();

    return () => clearInterval(interval);
  }, [selectedTicket]);

  // Отправляем статус "печатает" при вводе текста
  const handleTyping = () => {
    if (!selectedTicket) return;
    
    fetch(`/api/admin/support/tickets/${selectedTicket.id}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }).catch(console.error);
  };

  // Auto-refresh messages every 5 seconds when ticket is open
  useEffect(() => {
    if (!selectedTicket) return;

    const refreshInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/support/tickets/${selectedTicket.id}`, { 
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
          }
        }
      } catch (error) {
        console.error('Error auto-refreshing messages:', error);
      }
    }, 5000);

    return () => clearInterval(refreshInterval);
  }, [selectedTicket, lastMessageTime]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'support') {
      loadTickets();
    } else {
      router.push('/admin');
    }
  }, [user]);

  // Auto-refresh tickets list every 10 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (!selectedTicket) {
        loadTickets();
      }
    }, 10000); // 10 seconds

    return () => clearInterval(refreshInterval);
  }, [statusFilter, selectedTicket]);

  const loadTickets = async () => {
    try {
      const response = await fetch(`/api/admin/support/tickets?status_filter=${statusFilter}`, { 
        credentials: 'include' 
      });
      const data = await response.json();
      if (data.success) {
        setTickets(data.tickets);
        setTicketStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTicket = async (ticketId: number) => {
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}`, { 
        credentials: 'include' 
      });
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
      // Сначала обновляем статус просмотра (чтобы показать что админ онлайн)
      await fetch(`/api/admin/support/tickets/${selectedTicket.id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const response = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: newMessage })
      });

      const data = await response.json();
      if (data.success) {
        setMessages([...messages, data.data]);
        setNewMessage('');
        loadTickets();
      } else {
        console.error('Failed to send message:', data);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const updateTicketStatus = async (status: string) => {
    if (!selectedTicket) return;

    try {
      const response = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });

      const data = await response.json();
      if (data.success) {
        setSelectedTicket({ ...selectedTicket, status });
        loadTickets();
      }
    } catch (error) {
      console.error('Error updating status:', error);
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

  const filteredTickets = tickets.filter(ticket => {
    if (searchQuery && !ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !ticket.user.email.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

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
      {/* Mobile Header & Sidebar */}
      <MobileAdminHeader 
        userRole={user?.role} 
        showMenu={showMobileMenu} 
        setShowMenu={setShowMobileMenu} 
      />
      <MobileSidebar 
        userRole={user?.role} 
        showMenu={showMobileMenu} 
        setShowMenu={setShowMobileMenu} 
      />

      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-full w-64 bg-gray-900/90 border-gray-800 border-r backdrop-blur-xl z-30">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Admin Panel</h1>
              <p className="text-xs text-gray-500">v1.0.0</p>
            </div>
          </div>

          <AdminNav userRole={user?.role} darkMode={true} />
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 p-4 md:p-6 lg:p-8 pt-16 lg:pt-8">
        {/* Header - показан только на desktop */}
        <div className="hidden lg:flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {language === 'en' ? 'Support Administration' : 'Администрирование поддержки'}
            </h1>
            <p className="text-gray-400 mt-2">
              {language === 'en' ? 'Manage and respond to support tickets' : 'Управление и ответы на тикеты поддержки'}
            </p>
          </div>
          <Button
            onClick={loadTickets}
            variant="outline"
            className="border-gray-700 hover:border-gray-500"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {language === 'en' ? 'Refresh' : 'Обновить'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{ticketStats.total}</div>
            <div className="text-sm text-gray-400">{language === 'en' ? 'Total' : 'Всего'}</div>
          </div>
          <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-green-400">{ticketStats.open}</div>
            <div className="text-sm text-gray-400">{language === 'en' ? 'Open' : 'Открытые'}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-400">{ticketStats.in_progress}</div>
            <div className="text-sm text-gray-400">{language === 'en' ? 'In Progress' : 'В работе'}</div>
          </div>
          <div className="bg-gradient-to-br from-gray-900/20 to-gray-800/20 border border-gray-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-gray-400">{ticketStats.closed}</div>
            <div className="text-sm text-gray-400">{language === 'en' ? 'Closed' : 'Закрытые'}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'en' ? 'Search tickets...' : 'Поиск тикетов...'}
              className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'open', 'in_progress', 'closed'].map((status) => (
              <Button
                key={status}
                onClick={() => { setStatusFilter(status); loadTickets(); }}
                variant={statusFilter === status ? 'default' : 'outline'}
                className={statusFilter === status ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-700'}
              >
                {language === 'en' ? status.replace('_', ' ') : status === 'open' ? 'Открытые' : status === 'in_progress' ? 'В работе' : status === 'closed' ? 'Закрытые' : 'Все'}
              </Button>
            ))}
          </div>
        </div>

        {selectedTicket ? (
          /* Chat View */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Ticket List Sidebar */}
            <div className="lg:col-span-1 bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-400 hover:text-white w-full justify-start"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  {language === 'en' ? 'Back to tickets' : 'Назад к тикетам'}
                </Button>
              </div>
              <div className="h-[600px] overflow-y-auto p-4 space-y-2">
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => loadTicket(ticket.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedTicket?.id === ticket.id
                        ? 'bg-blue-900/30 border border-blue-500/50'
                        : 'bg-gray-800/30 border border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium truncate">{ticket.subject}</span>
                      {ticket.unread_count > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                          {ticket.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <User className="w-3 h-3" />
                      <span className="truncate">{ticket.user.email}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Area */}
            <div className="lg:col-span-3 bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-2xl overflow-hidden">
              {/* Ticket Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedTicket.subject}</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400">{selectedTicket.user.email}</span>
                      {/* Индикатор онлайн пользователя */}
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
                        isUserOnline
                          ? 'bg-green-900/30 border-green-500/30'
                          : 'bg-gray-700/30 border-gray-500/30'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          isUserOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                        }`} />
                        <span className={`text-xs ${
                          isUserOnline ? 'text-green-400' : 'text-gray-400'
                        }`}>
                          {language === 'en' ? 'User online' : 'Пользователь онлайн'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => updateTicketStatus('open')}
                    variant="outline"
                    size="sm"
                    className={selectedTicket.status === 'open' ? 'bg-green-600 hover:bg-green-700 border-green-600' : 'border-gray-700'}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'Open' : 'Открыть'}
                  </Button>
                  <Button
                    onClick={() => updateTicketStatus('in_progress')}
                    variant="outline"
                    size="sm"
                    className={selectedTicket.status === 'in_progress' ? 'bg-blue-600 hover:bg-blue-700 border-blue-600' : 'border-gray-700'}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'In Progress' : 'В работе'}
                  </Button>
                  <Button
                    onClick={() => updateTicketStatus('closed')}
                    variant="outline"
                    size="sm"
                    className={selectedTicket.status === 'closed' ? 'bg-gray-600 hover:bg-gray-700 border-gray-600' : 'border-gray-700'}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'Close' : 'Закрыть'}
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="h-[500px] overflow-y-auto p-6 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_staff_message ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 break-words overflow-wrap-break-word ${
                        msg.is_staff_message
                          ? 'bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-500/30'
                          : 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {msg.is_staff_message ? (
                          <>
                            <Shield className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="text-xs text-blue-400 font-medium truncate">
                              {language === 'en' ? 'Support Team' : 'Команда поддержки'}
                            </span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-400 truncate">{language === 'en' ? 'User' : 'Пользователь'}</span>
                          </>
                        )}
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {new Date(msg.created_at).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap break-words overflow-wrap-break-word">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <div className="p-6 border-t border-white/10">
                {/* Индикатор что пользователь печатает */}
                {isUserTyping && (
                  <div className="mb-3 flex items-center gap-2 px-4 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                    </div>
                    <span className="text-sm text-green-400 italic">
                      {language === 'en' ? 'User is typing...' : 'Пользователь печатает...'}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <input
                    type="text"
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
                    placeholder={language === 'en' ? 'Type your message... (Enter to send)' : 'Введите сообщение... (Enter для отправки)'}
                    className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={isSending || !newMessage.trim()}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Tickets List */
          <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/30">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">{language === 'en' ? 'Subject' : 'Тема'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">{language === 'en' ? 'User' : 'Пользователь'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">{language === 'en' ? 'Status' : 'Статус'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">{language === 'en' ? 'Priority' : 'Приоритет'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">{language === 'en' ? 'Created' : 'Создан'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">{language === 'en' ? 'Unread' : 'Непрочитанные'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket, idx) => (
                    <tr
                      key={ticket.id}
                      onClick={() => loadTicket(ticket.id)}
                      className={`cursor-pointer ${idx % 2 === 0 ? 'bg-black/20' : ''} hover:bg-white/5`}
                    >
                      <td className="px-6 py-4 font-medium">{ticket.subject}</td>
                      <td className="px-6 py-4 text-gray-400">{ticket.user.email}</td>
                      <td className="px-6 py-4">{getStatusBadge(ticket.status)}</td>
                      <td className="px-6 py-4">{getPriorityBadge(ticket.priority)}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(ticket.created_at).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                      </td>
                      <td className="px-6 py-4">
                        {ticket.unread_count > 0 ? (
                          <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                            {ticket.unread_count}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
