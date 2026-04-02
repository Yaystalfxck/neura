"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Wallet,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
  Moon,
  Sun,
  Users,
  BarChart3,
  Settings,
  Copy,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AdminNav } from "@/components/admin/AdminNav";
import { MobileAdminHeader, MobileSidebar } from "@/components/admin/MobileAdminHeader";
import { Menu, X } from "lucide-react";

interface Payout {
  id: number;
  user_id: number;
  amount: number;
  method: string;
  details: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  processed_at: string | null;
  user?: {
    id: number;
    name: string;
    email: string;
    pocketOptionId: string;
  };
}

interface PayoutStats {
  totalPending: number;
  totalProcessing: number;
  totalCompleted: number;
  totalAmount: number;
  pendingAmount: number;
  completedAmount: number;
}

export default function AdminPayoutsPage() {
  return (
    <ProtectedRoute adminOnly>
      <AdminPayoutsContent />
    </ProtectedRoute>
  );
}

function AdminPayoutsContent() {
  const router = useRouter();
  const { user, logout } = useAuth();
  
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [stats, setStats] = useState<PayoutStats>({
    totalPending: 0,
    totalProcessing: 0,
    totalCompleted: 0,
    totalAmount: 0,
    pendingAmount: 0,
    completedAmount: 0
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [darkMode, setDarkMode] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Загрузка выплат
  useEffect(() => {
    loadPayouts();
  }, [currentPage, statusFilter, methodFilter]);

  const loadPayouts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        status: statusFilter,
        method: methodFilter,
        search: search
      });

      const response = await fetch(`/api/admin/payouts?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.payouts && data.pagination) {
          setPayouts(data.payouts);
          setStats(data.stats);
          setTotalPages(data.pagination.totalPages);
        } else {
          console.error('API returned error:', data);
          setPayouts([]);
          setTotalPages(0);
        }
      } else {
        console.error('API response not ok:', response.status);
        setPayouts([]);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('Error loading payouts:', error);
      setPayouts([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadPayouts();
  };

  const handleRefresh = () => {
    loadPayouts();
  };

  const handleViewPayout = (payout: Payout) => {
    setSelectedPayout(payout);
    setShowPayoutModal(true);
  };

  const handleUpdateStatus = async (payoutId: number, newStatus: string) => {
    if (!confirm(`Вы уверены, что хотите изменить статус на "${getStatusText(newStatus)}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/payouts/${payoutId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Статус выплаты обновлен на: ${newStatus}`)
          // Обновляем данные
          await loadPayouts();
          if (selectedPayout?.id === payoutId) {
            setSelectedPayout(null);
            setShowPayoutModal(false);
          }
          // Показываем уведомление
          alert(`Статус выплаты изменен на "${getStatusText(newStatus)}"`)
          // Перезагружаем страницу через 1 секунду для обновления статистики
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        } else {
          console.error('❌ Ошибка обновления статуса:', data)
          alert(data.error || 'Ошибка обновления статуса')
        }
      } else {
        const errorData = await response.json()
        console.error('❌ HTTP error:', response.status, errorData)
        alert(errorData.error || 'Ошибка обновления статуса')
      }
    } catch (error) {
      console.error('Error updating payout status:', error);
      alert('Ошибка обновления статуса')
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    alert('Адрес скопирован в буфер обмена');
  };

  const getMethodIcon = (method: string) => {
    switch(method) {
      case 'bank': return <Wallet className="w-4 h-4" />;
      case 'crypto': return <DollarSign className="w-4 h-4" />;
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'pocketoption': return <ExternalLink className="w-4 h-4" />;
      default: return <Wallet className="w-4 h-4" />;
    }
  };

  const getMethodText = (method: string) => {
    switch(method) {
      case 'bank': 
      case 'bank_transfer':
        return 'Банковский перевод';
      case 'crypto': 
        return 'Криптовалюта (USDT TRC20)';
      case 'card': 
        return 'Банковская карта';
      case 'pocketoption': 
      case 'pocket_option':
        return 'PocketOption';
      default: 
        return method;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Ожидает
        </span>;
      case 'processing':
        return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium flex items-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          В обработке
        </span>;
      case 'completed':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Выплачено
        </span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Ошибка
        </span>;
      case 'cancelled':
        return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Отменено
        </span>;
      default:
        return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'pending': return 'Ожидает';
      case 'processing': return 'В обработке';
      case 'completed': return 'Выплачено';
      case 'failed': return 'Ошибка';
      case 'cancelled': return 'Отменено';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'text-yellow-400';
      case 'processing': return 'text-blue-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'cancelled': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  if (isLoading && payouts.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500/30 rounded-full animate-pulse"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            <Wallet className="w-10 h-10 text-blue-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-6 text-gray-400">Загрузка выплат...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gradient-to-b from-black via-gray-900 to-black text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Mobile Header */}
      <MobileAdminHeader
        userRole={user?.role}
        showMenu={showMobileMenu}
        setShowMenu={setShowMobileMenu}
      />
      
      {/* Mobile Sidebar */}
      <MobileSidebar
        userRole={user?.role}
        showMenu={showMobileMenu}
        setShowMenu={setShowMobileMenu}
      />

      {/* Desktop Sidebar */}
      <div className={`hidden lg:block fixed left-0 top-0 h-full w-64 ${darkMode ? 'bg-gray-900/90 border-gray-800' : 'bg-white border-gray-200'} border-r backdrop-blur-xl z-30`}>
        <div className="p-6 pt-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Admin Panel</h1>
              <p className="text-xs text-gray-500">v1.0.0</p>
            </div>
          </div>

          <AdminNav userRole={user?.role} darkMode={darkMode} onNavigate={() => setShowMobileMenu(false)} />
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 p-4 md:p-6 lg:p-8 pt-16 lg:pt-8">
        {/* Header - показан только на desktop */}
        <div className="hidden lg:flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Управление выплатами
            </h1>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
              Всего заявок: {(stats?.totalPending || 0) + (stats?.totalProcessing || 0) + (stats?.totalCompleted || 0)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRefresh}
              variant="outline"
              className={darkMode ? 'border-gray-700 hover:border-gray-500' : ''}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Обновить
            </Button>
            <Button
              onClick={() => router.push('/admin/payouts/export')}
              variant="outline"
              className={darkMode ? 'border-gray-700 hover:border-gray-500' : ''}
            >
              <Download className="w-4 h-4 mr-2" />
              Экспорт
            </Button>
          </div>
        </div>

        {/* Stats Cards - адаптировано для мобильных */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
          <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-yellow-400">{stats?.totalPending || 0}</span>
            </div>
            <div className="text-2xl font-bold mb-1">{stats?.totalPending || 0}</div>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Ожидают обработки</div>
            <div className="text-xs text-yellow-400 mt-2">
              Сумма: ${(stats?.pendingAmount || 0).toFixed(2)}
            </div>
          </div>

          <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-2">
              <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-sm text-blue-400">{stats?.totalProcessing || 0}</span>
            </div>
            <div className="text-2xl font-bold mb-1">{stats?.totalProcessing || 0}</div>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>В обработке</div>
          </div>

          <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-400">{stats?.totalCompleted || 0}</span>
            </div>
            <div className="text-2xl font-bold mb-1">{stats?.totalCompleted || 0}</div>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Выплачено всего</div>
            <div className="text-xs text-green-400 mt-2">
              Сумма: ${(stats?.completedAmount || 0).toFixed(2)}
            </div>
          </div>

          <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-purple-400">${(stats?.totalAmount || 0).toFixed(2)}</span>
            </div>
            <div className="text-2xl font-bold mb-1">${(stats?.totalAmount || 0).toFixed(2)}</div>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Общая сумма выплат</div>
          </div>
        </div>

        {/* Filters */}
        <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6 mb-8`}>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2 block`}>Поиск</label>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <Input
                  type="text"
                  placeholder="ID выплаты, email пользователя..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className={`pl-10 ${darkMode ? 'bg-gray-800/50 border-gray-700 text-white' : 'bg-gray-50 border-gray-300'}`}
                />
              </div>
            </div>

            <div>
              <label className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2 block`}>Статус</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg ${
                  darkMode 
                    ? 'bg-gray-800/50 border-gray-700 text-white' 
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                } border focus:outline-none focus:border-blue-500`}
              >
                <option value="all">Все статусы</option>
                <option value="pending">Ожидает</option>
                <option value="processing">В обработке</option>
                <option value="completed">Выплачено</option>
                <option value="failed">Ошибка</option>
                <option value="cancelled">Отменено</option>
              </select>
            </div>

            <div>
              <label className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2 block`}>Способ вывода</label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg ${
                  darkMode 
                    ? 'bg-gray-800/50 border-gray-700 text-white' 
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                } border focus:outline-none focus:border-blue-500`}
              >
                <option value="all">Все способы</option>
                <option value="bank">Банковский перевод</option>
                <option value="crypto">Криптовалюта</option>
                <option value="card">Карта</option>
                <option value="pocketoption">PocketOption</option>
              </select>
            </div>
          </div>
        </div>

        {/* Payouts Table */}
        <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${darkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">ID</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Пользователь</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Сумма</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Способ</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Статус</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Дата</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Детали</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Действия</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr 
                    key={payout.id} 
                    className={`border-b ${darkMode ? 'border-gray-800 hover:bg-gray-800/30' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
                  >
                    <td className="p-4">
                      <span className="font-mono text-sm">#{payout.id}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold`}>
                          {payout.user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{payout.user?.name || 'Неизвестно'}</div>
                          <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{payout.user?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-green-400">${payout.amount.toFixed(2)}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {getMethodIcon(payout.method)}
                        <span className="text-sm">{getMethodText(payout.method)}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(payout.status)}
                    </td>
                    <td className="p-4">
                      <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {new Date(payout.created_at).toLocaleDateString('ru-RU')}
                      </div>
                      <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {new Date(payout.created_at).toLocaleTimeString('ru-RU')}
                      </div>
                    </td>
                    <td className="p-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewPayout(payout)}
                        className={darkMode ? 'border-gray-700 hover:border-blue-600' : ''}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Детали
                      </Button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {payout.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleUpdateStatus(payout.id, 'processing')}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Взять в работу
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(payout.id, 'cancelled')}
                              className="border-gray-700 hover:border-red-600 text-red-400"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Отклонить
                            </Button>
                          </>
                        )}
                        {payout.status === 'processing' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleUpdateStatus(payout.id, 'completed')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Подтвердить выплату
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(payout.id, 'failed')}
                              className="border-gray-700 hover:border-red-600 text-red-400"
                            >
                              <AlertCircle className="w-4 h-4 mr-1" />
                              Отметить ошибку
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={`flex justify-between items-center p-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Показано {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, payouts.length)} из {payouts.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={darkMode ? 'border-gray-700' : ''}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className={`px-4 py-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={darkMode ? 'border-gray-700' : ''}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Payout Details Modal */}
      {showPayoutModal && selectedPayout && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6 max-w-2xl w-full`}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Wallet className="w-6 h-6 text-green-400" />
                  Заявка на выплату #{selectedPayout.id}
                </h2>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                  Создана: {new Date(selectedPayout.created_at).toLocaleString('ru-RU')}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setShowPayoutModal(false)}
                className={darkMode ? 'text-gray-400 hover:text-white' : ''}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              {/* Информация о пользователе */}
              <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-xl p-4`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" />
                  Информация о пользователе
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>ID:</span>
                    <div className="font-medium">{selectedPayout.user?.id}</div>
                  </div>
                  <div>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Имя:</span>
                    <div className="font-medium">{selectedPayout.user?.name}</div>
                  </div>
                  <div className="col-span-2">
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Email:</span>
                    <div className="font-medium">{selectedPayout.user?.email}</div>
                  </div>
                  <div className="col-span-2">
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>PocketOption ID:</span>
                    <div className="font-mono text-sm">{selectedPayout.user?.pocketOptionId}</div>
                  </div>
                </div>
              </div>

              {/* Детали выплаты */}
              <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-xl p-4`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Детали выплаты
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Сумма:</span>
                    <span className="font-bold text-2xl text-green-400">${selectedPayout.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Способ вывода:</span>
                    <span className="flex items-center gap-1">
                      {getMethodIcon(selectedPayout.method)}
                      {getMethodText(selectedPayout.method)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Статус:</span>
                    {getStatusBadge(selectedPayout.status)}
                  </div>
                  
                  {/* Реквизиты для выплаты */}
                  <div className="mt-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-gray-400">
                        {selectedPayout.method === 'crypto' ? 'Адрес кошелька (USDT TRC20):' : 
                         selectedPayout.method === 'bank_transfer' ? 'Банковские реквизиты:' :
                         'Реквизиты:'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyAddress(selectedPayout.details)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className={`font-mono text-sm break-all p-3 rounded-lg ${
                      selectedPayout.method === 'crypto' 
                        ? 'bg-green-900/20 border border-green-500/30 text-green-400' 
                        : 'bg-gray-800 text-gray-300'
                    }`}>
                      {selectedPayout.details || 'Не указаны'}
                    </p>
                    {selectedPayout.method === 'crypto' && selectedPayout.details && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        <a 
                          href={`https://tronscan.org/#/address/${selectedPayout.details}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          Посмотреть в TronScan
                        </a>
                      </p>
                    )}
                  </div>

                  {selectedPayout.processed_at && (
                    <div className="flex justify-between text-sm">
                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Обработано:</span>
                      <span>{new Date(selectedPayout.processed_at).toLocaleString('ru-RU')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Действия */}
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowPayoutModal(false)}
                  className={darkMode ? 'border-gray-700' : ''}
                >
                  Закрыть
                </Button>
                
                {selectedPayout.status === 'pending' && (
                  <>
                    <Button
                      onClick={() => handleUpdateStatus(selectedPayout.id, 'processing')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Взять в работу
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(selectedPayout.id, 'cancelled')}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Отклонить
                    </Button>
                  </>
                )}
                
                {selectedPayout.status === 'processing' && (
                  <>
                    <Button
                      onClick={() => handleUpdateStatus(selectedPayout.id, 'completed')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Подтвердить выплату
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(selectedPayout.id, 'failed')}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Отметить ошибку
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Нужно добавить импорт CreditCard
import { CreditCard } from "lucide-react";