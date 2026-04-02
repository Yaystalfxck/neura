"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  Mail,
  Phone,
  Globe,
  Clock,
  UserCheck,
  UserX,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Shield,
  Award,
  Star,
  Crown,
  Sparkles,
  Wallet,
  BarChart3,
  PieChart,
  Activity,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  CreditCard,
  MessageCircle,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { toast } from "sonner";
import { AdminNav } from "@/components/admin/AdminNav";
import { RoleSelectorModal } from "@/components/admin/RoleSelectorModal";
import { MobileAdminHeader, MobileSidebar } from "@/components/admin/MobileAdminHeader";

interface User {
  id: number;
  name: string;
  email: string;
  pocketOptionId: string;
  balance: number;
  phone: string | null;
  country: string;
  language: string;
  status: 'active' | 'blocked' | 'inactive';
  referral_code: string | null;
  referred_by: number | null;
  referral_rank: string;
  total_referrals: number;
  active_referrals: number;
  total_commission: number;
  pending_commission: number;
  paid_commission: number;
  lifetime_value: number;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

interface PocketOptionData {
  id: number;
  pocket_option_id: string;
  email: string;
  reg_date: string;
  verification_status: string;
  ftd_amount: number;
  deposits_count: number;
  withdrawals_count: number;
  current_balance: number;
  total_deposit: number;
  total_withdrawal: number;
  last_sync: string;
}

interface UserWithPO extends User {
  po_data?: PocketOptionData;
  trades_count?: number;
  total_trades_volume?: number;
  profit_loss?: number;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBalance: number;
  usersWithPO: number;
  averageBalance: number;
  topReferrers: number;
  totalReferrals: number;
  totalCommission: number;
}

interface PayoutStats {
  totalPending: number;
  totalProcessing: number;
  totalCompleted: number;
}

export default function AdminUsersPage() {
  return (
    <ProtectedRoute adminOnly>
      <AdminUsersContent />
    </ProtectedRoute>
  );
}

function AdminUsersContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  
  const [users, setUsers] = useState<UserWithPO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rankFilter, setRankFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [selectedUser, setSelectedUser] = useState<UserWithPO | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userForRoleChange, setUserForRoleChange] = useState<{id: number, currentRole: string} | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    blockedUsers: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalBalance: 0,
    usersWithPO: 0,
    averageBalance: 0,
    topReferrers: 0,
    totalReferrals: 0,
    totalCommission: 0
  });
  
  const [payoutStats, setPayoutStats] = useState<PayoutStats>({
    totalPending: 0,
    totalProcessing: 0,
    totalCompleted: 0
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [darkMode, setDarkMode] = useState(true);

  // Загрузка пользователей
  useEffect(() => {
    loadUsers();
    loadPayoutStats();
  }, [currentPage, statusFilter, rankFilter, sortBy]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        status: statusFilter,
        rank: rankFilter,
        sort: sortBy,
        search: search
      });

      const response = await fetch(`/api/admin/users?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.users && data.pagination) {
          setUsers(data.users);
          setStats(data.stats);
          setTotalPages(data.pagination.totalPages);
        } else {
          console.error('API returned error:', data);
          setUsers([]);
          setTotalPages(0);
        }
      } else {
        console.error('API response not ok:', response.status);
        setUsers([]);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPayoutStats = async () => {
    try {
      const response = await fetch('/api/admin/payouts/stats', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stats) {
          setPayoutStats(data.stats);
        } else {
          console.error('Payout stats API error:', data);
        }
      }
    } catch (error) {
      console.error('Error loading payout stats:', error);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadUsers();
  };

  const handleRefresh = () => {
    loadUsers();
    loadPayoutStats();
  };

  const handleViewUser = async (userId: number) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSelectedUser(data.user);
          setShowUserModal(true);
        }
      }
    } catch (error) {
      console.error('Error loading user details:', error);
    }
  };

  const handleToggleUserStatus = async (userId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';

    if (!confirm(`Вы уверены, что хотите ${newStatus === 'active' ? 'разблокировать' : 'заблокировать'} пользователя?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          loadUsers();
        }
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  const handleOpenRoleModal = (userId: number, currentRole: string) => {
    setUserForRoleChange({ id: userId, currentRole });
    setShowRoleModal(true);
  };

  const handleApplyRole = async (newRole: string) => {
    if (!userForRoleChange) return;

    try {
      const response = await fetch(`/api/admin/users/${userForRoleChange.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Роль изменена на "${newRole}"`);
        loadUsers();
      } else {
        const errorMsg = data.detail || data.error || 'Ошибка при изменении роли';
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Error changing role:', error);
      toast.error('Ошибка при изменении роли');
    } finally {
      setUserForRoleChange(null);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Вы уверены, что хотите удалить пользователя? Это действие необратимо!')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          loadUsers();
        }
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleSyncPOData = async (userId: number, pocketOptionId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/sync-po`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pocketOptionId }),
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Данные PocketOption успешно синхронизированы');
          if (selectedUser?.id === userId) {
            setSelectedUser(data.user);
          }
          loadUsers();
        }
      }
    } catch (error) {
      console.error('Error syncing PO data:', error);
      alert('Ошибка синхронизации данных PocketOption');
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(users, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `users_export_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Фильтрация пользователей (на случай если API не работает)
  const filteredUsers = users.filter(user => {
    if (statusFilter !== 'all' && user.status !== statusFilter) return false;
    if (rankFilter !== 'all' && user.referral_rank !== rankFilter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.pocketOptionId.toLowerCase().includes(searchLower) ||
        (user.phone?.toLowerCase() || '').includes(searchLower)
      );
    }
    return true;
  });

  const getRankIcon = (rank: string) => {
    switch(rank) {
      case 'Bronze': return <Shield className="w-4 h-4 text-amber-600" />;
      case 'Silver': return <Award className="w-4 h-4 text-gray-400" />;
      case 'Gold': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'Platinum': return <Star className="w-4 h-4 text-blue-400" />;
      case 'Diamond': return <Sparkles className="w-4 h-4 text-purple-500" />;
      default: return <Award className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">Активен</span>;
      case 'blocked':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">Заблокирован</span>;
      default:
        return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-medium">Неактивен</span>;
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500/30 rounded-full animate-pulse"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            <Users className="w-10 h-10 text-blue-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-6 text-gray-400">Загрузка пользователей...</p>
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

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 ${
              darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span>{darkMode ? 'Светлая тема' : 'Темная тема'}</span>
          </button>
          <button 
            onClick={logout}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${
              darkMode ? 'hover:bg-red-500/10 text-red-400 hover:text-red-300' : 'hover:bg-red-50 text-red-600'
            }`}
          >
            <LogOut className="w-5 h-5" />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 p-4 md:p-6 lg:p-8 pt-16 lg:pt-8">
        {/* Header - показан только на desktop */}
        <div className="hidden lg:flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Управление пользователями
            </h1>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1 text-sm md:text-base`}>
              Всего пользователей: {stats.totalUsers}
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
              onClick={handleExport}
              variant="outline"
              className={darkMode ? 'border-gray-700 hover:border-gray-500' : ''}
            >
              <Download className="w-4 h-4 mr-2" />
              Экспорт
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-2">
              <Users className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className="text-sm text-green-400">+{stats.activeUsers}</span>
            </div>
            <div className="text-2xl font-bold mb-1">{stats.totalUsers}</div>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Всего пользователей</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-green-400">Активных: {stats.activeUsers}</span>
              <span className="text-red-400">Заблокировано: {stats.blockedUsers}</span>
            </div>
          </div>

          <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-2">
              <Wallet className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
              <span className="text-sm text-green-400">${stats.totalBalance.toFixed(2)}</span>
            </div>
            <div className="text-2xl font-bold mb-1">${stats.totalBalance.toFixed(2)}</div>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Общий баланс</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-green-400">Средний: ${stats.averageBalance.toFixed(2)}</span>
            </div>
          </div>

          <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className={`w-5 h-5 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
              <span className="text-sm text-green-400">${stats.totalDeposits.toFixed(2)}</span>
            </div>
            <div className="text-2xl font-bold mb-1">${stats.totalDeposits.toFixed(2)}</div>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Всего депозитов</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-red-400">Выводов: ${stats.totalWithdrawals.toFixed(2)}</span>
            </div>
          </div>

          <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-2">
              <Award className={`w-5 h-5 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <span className="text-sm text-green-400">{stats.usersWithPO}</span>
            </div>
            <div className="text-2xl font-bold mb-1">{stats.usersWithPO}</div>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Синхронизировано с PO</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-blue-400">Рефералов: {stats.totalReferrals}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6 mb-8`}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2 block`}>Поиск</label>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <Input
                  type="text"
                  placeholder="Имя, email, ID, телефон..."
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
                <option value="all">Все</option>
                <option value="active">Активные</option>
                <option value="blocked">Заблокированные</option>
                <option value="inactive">Неактивные</option>
              </select>
            </div>

            <div>
              <label className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2 block`}>Ранг</label>
              <select
                value={rankFilter}
                onChange={(e) => setRankFilter(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg ${
                  darkMode 
                    ? 'bg-gray-800/50 border-gray-700 text-white' 
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                } border focus:outline-none focus:border-blue-500`}
              >
                <option value="all">Все ранги</option>
                <option value="Bronze">Bronze</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
                <option value="Diamond">Diamond</option>
              </select>
            </div>

            <div>
              <label className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2 block`}>Сортировка</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg ${
                  darkMode 
                    ? 'bg-gray-800/50 border-gray-700 text-white' 
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                } border focus:outline-none focus:border-blue-500`}
              >
                <option value="newest">Сначала новые</option>
                <option value="oldest">Сначала старые</option>
                <option value="balance_desc">По балансу (убыв)</option>
                <option value="balance_asc">По балансу (возр)</option>
                <option value="referrals_desc">По рефералам</option>
                <option value="commission_desc">По комиссии</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className={`${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${darkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Пользователь</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">PocketOption ID</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Баланс</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Ранг</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Рефералы</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Комиссия</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Статус</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Дата</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr 
                    key={user.id} 
                    className={`border-b ${darkMode ? 'border-gray-800 hover:bg-gray-800/30' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{user.email}</div>
                          {user.phone && (
                            <div className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>{user.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-sm">{user.pocketOptionId}</div>
                      {user.po_data && (
                        <div className={`text-xs ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                          ✓ Синхронизировано
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-green-400">${user.balance.toFixed(2)}</div>
                      {user.po_data && (
                        <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          PO: ${user.po_data.current_balance.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getRankIcon(user.referral_rank)}
                        <span>{user.referral_rank}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{user.total_referrals || 0}</div>
                      <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Активных: {user.active_referrals || 0}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-green-400">+${(user.total_commission || 0).toFixed(2)}</div>
                      <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Ожидает: ${(user.pending_commission || 0).toFixed(2)}
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          (user as any).role === 'admin'
                            ? 'bg-purple-500/20 text-purple-400'
                            : (user as any).role === 'support'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {(user as any).role === 'admin' ? 'ADMIN' : (user as any).role === 'support' ? 'SUPPORT' : 'USER'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenRoleModal(user.id, (user as any).role || 'user')}
                          className={`h-6 w-6 p-0 ${
                            (user as any).role === 'admin'
                              ? 'hover:bg-purple-900/30 hover:text-purple-400'
                              : (user as any).role === 'support'
                                ? 'hover:bg-blue-900/30 hover:text-blue-400'
                                : 'hover:bg-gray-700 hover:text-gray-300'
                          }`}
                          title="Изменить роль"
                        >
                          <Shield className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                      <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {new Date(user.createdAt).toLocaleTimeString('ru-RU')}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewUser(user.id)}
                          className={darkMode ? 'border-gray-700 hover:border-blue-600' : ''}
                          title="Просмотр"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleUserStatus(user.id, user.status)}
                          className={darkMode ? `border-gray-700 ${
                            user.status === 'active' 
                              ? 'hover:border-red-600 hover:bg-red-950/30' 
                              : 'hover:border-green-600 hover:bg-green-950/30'
                          }` : ''}
                          title={user.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                        >
                          {user.status === 'active' ? (
                            <Ban className="w-4 h-4 text-red-400" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteUser(user.id)}
                          className={darkMode ? 'border-gray-700 hover:border-red-600 hover:bg-red-950/30' : ''}
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
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
              Показано {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, stats.totalUsers)} из {stats.totalUsers}
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

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedUser.name}</h2>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getRankIcon(selectedUser.referral_rank)}
                    <span>{selectedUser.referral_rank}</span>
                    {getStatusBadge(selectedUser.status)}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => setShowUserModal(false)}
                className={darkMode ? 'text-gray-400 hover:text-white' : ''}
              >
                ✕
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Основная информация */}
              <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-xl p-4`}>
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Основная информация
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>ID:</span>
                    <span className="font-mono">{selectedUser.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>PocketOption ID:</span>
                    <span className="font-mono">{selectedUser.pocketOptionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Телефон:</span>
                    <span>{selectedUser.phone || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Страна:</span>
                    <span>{selectedUser.country}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Язык:</span>
                    <span>{selectedUser.language}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Дата регистрации:</span>
                    <span>{new Date(selectedUser.createdAt).toLocaleString('ru-RU')}</span>
                  </div>
                </div>
              </div>

              {/* Финансовая информация */}
              <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-xl p-4`}>
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Финансовая информация
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Баланс:</span>
                    <span className="font-bold text-green-400">${selectedUser.balance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Lifetime Value:</span>
                    <span className="font-bold text-blue-400">${(selectedUser.lifetime_value || 0).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-700 my-2"></div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Всего комиссии:</span>
                    <span className="text-green-400">+${(selectedUser.total_commission || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Ожидает выплаты:</span>
                    <span className="text-yellow-400">${(selectedUser.pending_commission || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Выплачено:</span>
                    <span className="text-green-400">${(selectedUser.paid_commission || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Реферальная информация */}
              <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-xl p-4`}>
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-400" />
                  Реферальная программа
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Реферальный код:</span>
                    <span className="font-mono">{selectedUser.referral_code || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Приглашен пользователем:</span>
                    <span>{selectedUser.referred_by ? `ID: ${selectedUser.referred_by}` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Всего рефералов:</span>
                    <span className="font-bold">{selectedUser.total_referrals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Активных рефералов:</span>
                    <span className="text-green-400">{selectedUser.active_referrals}</span>
                  </div>
                </div>
              </div>

              {/* PocketOption данные */}
              <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-xl p-4`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-purple-400" />
                    Данные PocketOption
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => handleSyncPOData(selectedUser.id, selectedUser.pocketOptionId)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Синхронизировать
                  </Button>
                </div>
                {selectedUser.po_data ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Статус верификации:</span>
                      <span className={selectedUser.po_data.verification_status === 'verified' ? 'text-green-400' : 'text-yellow-400'}>
                        {selectedUser.po_data.verification_status === 'verified' ? 'Верифицирован' : 'Не верифицирован'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Дата регистрации в PO:</span>
                      <span>{new Date(selectedUser.po_data.reg_date).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>FTD:</span>
                      <span className="font-bold text-green-400">${selectedUser.po_data.ftd_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Всего депозитов:</span>
                      <span>${selectedUser.po_data.total_deposit.toFixed(2)} ({selectedUser.po_data.deposits_count})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Всего выводов:</span>
                      <span>${selectedUser.po_data.total_withdrawal.toFixed(2)} ({selectedUser.po_data.withdrawals_count})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Текущий баланс PO:</span>
                      <span className="font-bold">${selectedUser.po_data.current_balance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Последняя синхронизация:</span>
                      <span className="text-xs">{new Date(selectedUser.po_data.last_sync).toLocaleString('ru-RU')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Данные PocketOption отсутствуют</p>
                    <Button
                      size="sm"
                      onClick={() => handleSyncPOData(selectedUser.id, selectedUser.pocketOptionId)}
                      className="mt-2 bg-purple-600 hover:bg-purple-700"
                    >
                      Загрузить данные
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Действия */}
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowUserModal(false)}
                className={darkMode ? 'border-gray-700' : ''}
              >
                Закрыть
              </Button>
              <Button
                onClick={() => handleToggleUserStatus(selectedUser.id, selectedUser.status)}
                className={selectedUser.status === 'active' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
                }
              >
                {selectedUser.status === 'active' ? (
                  <>
                    <Ban className="w-4 h-4 mr-2" />
                    Заблокировать
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Разблокировать
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Role Selector Modal */}
      {userForRoleChange && (
        <RoleSelectorModal
          isOpen={showRoleModal}
          onClose={() => {
            setShowRoleModal(false);
            setUserForRoleChange(null);
          }}
          onSelect={handleApplyRole}
          currentRole={userForRoleChange.currentRole}
        />
      )}
    </div>
  );
}