"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Users,
  Gift,
  Copy,
  CheckCheck,
  TrendingUp,
  DollarSign,
  UserPlus,
  Award,
  Shield,
  Clock,
  Wallet,
  Link2,
  Share2,
  Mail,
  MessageCircle,
  ChevronRight,
  BarChart3,
  Target,
  Zap,
  Globe,
  Sparkles,
  Crown,
  Star,
  RefreshCw,
  ExternalLink,
  Settings,
  HelpCircle,
  AlertCircle,
  History,
  User,
  Calendar,
  Download,
  ArrowLeft,
  Twitter,
  Send,
  SlidersHorizontal,
  Eye,
  Filter,
  Search,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

interface Referral {
  id: number;
  name: string;
  email: string;
  registeredAt: string;
  status: 'active' | 'inactive';
  totalDeposit: number;
  commission: number;
  trades: number;
  profit: number;
}

interface CommissionHistory {
  id: number;
  date: string;
  amount: number;
  type: 'deposit' | 'trade' | 'bonus';
  fromUser: string;
  status: 'paid' | 'pending' | 'cancelled';
}

interface PartnerStats {
  totalReferrals: number;
  activeReferrals: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
  conversionRate: number;
  averageDeposit: number;
  totalDeposits: number;
  monthlyGrowth: number;
  rank: string;
  nextRank: string;
  progressToNextRank: number;
  lifetimeValue: number;
  clickThroughRate: number;
  uniqueClicks: number;
  totalClicks: number;
  rankCommission: number;
}

interface ReferralLink {
  id: number;
  code: string;
  url: string;
  clicks: number;
  registrations: number;
  conversions: number;
}

export default function PartnersPage() {
  return (
    <ProtectedRoute>
      <PartnersPageContent />
    </ProtectedRoute>
  );
}

function PartnersPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [referralLink, setReferralLink] = useState<ReferralLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'referrals' | 'commissions' | 'tools'>('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [showCustomize, setShowCustomize] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('bank');
  
  // Статистика партнера из БД
  const [stats, setStats] = useState<PartnerStats>({
    totalReferrals: 0,
    activeReferrals: 0,
    totalCommission: 0,
    pendingCommission: 0,
    paidCommission: 0,
    conversionRate: 0,
    averageDeposit: 0,
    totalDeposits: 0,
    monthlyGrowth: 0,
    rank: 'Bronze',
    nextRank: 'Silver',
    progressToNextRank: 0,
    lifetimeValue: 0,
    clickThroughRate: 0,
    uniqueClicks: 0,
    totalClicks: 0,
    rankCommission: 5
  });

  // Рефералы из БД
  const [referrals, setReferrals] = useState<Referral[]>([]);
  
  // История комиссий из БД
  const [commissionHistory, setCommissionHistory] = useState<CommissionHistory[]>([]);
  
  // Загрузка данных из БД
  useEffect(() => {
    if (user) {
      loadPartnerData();
    }
  }, [user]);

  const loadPartnerData = async () => {
    setIsLoading(true);
    try {
      // Загружаем статистику партнера
      await loadPartnerStats();
      
      // Загружаем реферальную ссылку
      await loadReferralLink();
      
      // Загружаем список рефералов
      await loadReferrals();
      
      // Загружаем историю комиссий
      await loadCommissionHistory();
    } catch (error) {
      console.error('Ошибка загрузки данных партнера:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPartnerStats = async () => {
    try {
      const response = await fetch('/api/partner/stats', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  };

  const loadReferralLink = async () => {
    try {
      const response = await fetch('/api/partner/referral-link', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.link) {
          setReferralLink(data.link);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки реферальной ссылки:', error);
    }
  };

  const loadReferrals = async () => {
    try {
      const response = await fetch('/api/partner/referrals', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setReferrals(data.referrals);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки рефералов:', error);
    }
  };

  const loadCommissionHistory = async () => {
    try {
      const response = await fetch('/api/partner/commissions', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCommissionHistory(data.commissions);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки истории комиссий:', error);
    }
  };

  // Генерация реферальной ссылки
  const generateReferralLink = async () => {
    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/partner/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customCode: customCode || undefined }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setReferralLink(data.link);
        setShowCustomize(false);
      } else {
        console.error('Ошибка генерации ссылки:', data.error);
      }
    } catch (error) {
      console.error('Ошибка генерации ссылки:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Копирование ссылки
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Запрос на выплату
  const requestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Введите корректную сумму');
      return;
    }
    
    if (amount > stats.pendingCommission) {
      alert('Недостаточно средств для вывода');
      return;
    }
    
    try {
      const response = await fetch('/api/partner/request-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          method: payoutMethod,
          details: `Вывод ${amount}$ через ${payoutMethod}`
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        alert('Запрос на выплату отправлен!');
        setShowPayoutDialog(false);
        setPayoutAmount('');
        loadPartnerStats(); // Обновляем статистику
        loadCommissionHistory(); // Обновляем историю
      } else {
        alert(data.error || 'Ошибка запроса на выплату');
      }
    } catch (error) {
      console.error('Ошибка запроса на выплату:', error);
    }
  };

  // Инициализация - генерируем ссылку если её нет
  useEffect(() => {
    if (user && !referralLink && !isGenerating) {
      generateReferralLink();
    }
  }, [user, referralLink]);

  const getRankIcon = (rank: string) => {
    switch(rank) {
      case 'Bronze': return <Shield className="w-6 h-6 text-amber-600" />;
      case 'Silver': return <Award className="w-6 h-6 text-gray-400" />;
      case 'Gold': return <Crown className="w-6 h-6 text-yellow-500" />;
      case 'Platinum': return <Star className="w-6 h-6 text-blue-400" />;
      case 'Diamond': return <Sparkles className="w-6 h-6 text-purple-500" />;
      default: return <Award className="w-6 h-6 text-gray-400" />;
    }
  };

  const getCommissionRate = (rank: string) => {
    switch(rank) {
      case 'Bronze': return '5%';
      case 'Silver': return '7%';
      case 'Gold': return '10%';
      case 'Platinum': return '12%';
      case 'Diamond': return '15%';
      default: return '5%';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500/30 rounded-full animate-pulse"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            <Users className="w-10 h-10 text-blue-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-6 text-gray-400">Загрузка партнерской программы...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Декоративный фон */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-600/5 to-purple-600/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 pt-24 pb-12 max-w-7xl relative z-10">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <span>Главная</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white">Партнерская программа</span>
        </div>

        {/* Заголовок */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Партнерская программа
                </h1>
                <p className="text-gray-400 mt-1">
                  Приглашайте друзей и зарабатывайте до 15% с их депозитов
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="border-gray-700 hover:border-gray-500"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Дашборд
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCustomize(!showCustomize)}
              className="border-gray-700 hover:border-gray-500"
            >
              <Settings className="w-4 h-4 mr-2" />
              Настройки
            </Button>
          </div>
        </div>

        {/* Ранг и комиссия */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
        >
          <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  {getRankIcon(stats.rank)}
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-4 border-gray-900">
                  {stats.progressToNextRank}%
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                  <span className="text-2xl font-bold">{stats.rank}</span>
                  <span className="text-sm text-gray-400">→</span>
                  <span className="text-xl text-yellow-500">{stats.nextRank}</span>
                </div>
                <p className="text-gray-400 mb-4">
                  Ваша текущая комиссия: <span className="text-2xl font-bold text-green-400">{getCommissionRate(stats.rank)}</span>
                </p>
                <div className="w-full bg-gray-800 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-1000"
                    style={{ width: `${stats.progressToNextRank}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  До следующего уровня осталось пригласить {Math.max(0, getNextRankRequirement(stats.nextRank) - stats.totalReferrals)} активных рефералов
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              Уровни партнеров
            </h3>
            <div className="space-y-3">
              {[
                { rank: 'Bronze', commission: '5%', requirement: '0-9 рефералов' },
                { rank: 'Silver', commission: '7%', requirement: '10-24 реферала' },
                { rank: 'Gold', commission: '10%', requirement: '25-49 рефералов' },
                { rank: 'Platinum', commission: '12%', requirement: '50-99 рефералов' },
                { rank: 'Diamond', commission: '15%', requirement: '100+ рефералов' }
              ].map((level, i) => (
                <div key={level.rank} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {level.rank === stats.rank && (
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    )}
                    <span className={level.rank === stats.rank ? 'text-white font-medium' : 'text-gray-400'}>
                      {level.rank}
                    </span>
                  </div>
                  <span className="text-green-400 font-medium">{level.commission}</span>
                  <span className="text-gray-500 text-xs">{level.requirement}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Реферальная ссылка */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 mb-8 hover:border-gray-700 transition-all"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Link2 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Ваша реферальная ссылка</h2>
                <p className="text-sm text-gray-400">
                  Делитесь этой ссылкой с друзьями и получайте комиссию с их депозитов
                </p>
              </div>
            </div>
            
            <Button
              variant="outline"
              onClick={generateReferralLink}
              disabled={isGenerating}
              className="border-gray-700 hover:border-gray-500"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Генерация...' : 'Сгенерировать новую'}
            </Button>
          </div>

          {showCustomize && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-gray-800/30 rounded-xl border border-gray-700"
            >
              <label className="text-sm text-gray-400 mb-2 block">
                Персональный код (только латиница и цифры)
              </label>
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder="например: trader2024"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className="bg-gray-800/50 border-gray-700 text-white flex-1"
                />
                <Button
                  onClick={generateReferralLink}
                  disabled={isGenerating}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Применить
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Только латинские буквы, цифры и нижнее подчеркивание. Максимум 20 символов.
              </p>
            </motion.div>
          )}

          {referralLink && (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  value={referralLink.url}
                  readOnly
                  className="w-full bg-gray-800/50 border-gray-700 text-white pr-24"
                />
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(referralLink.url)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-gray-700 hover:bg-gray-600"
                >
                  {copied ? (
                    <>
                      <CheckCheck className="w-4 h-4 mr-1" />
                      Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Копировать
                    </>
                  )}
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink.url)}&text=${encodeURIComponent('Присоединяйся к Neura Signals!')}`, '_blank')}
                  className="border-blue-700 hover:border-blue-600 text-blue-400"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Telegram
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Зарабатывай на трейдинге с Neura Signals!')}&url=${encodeURIComponent(referralLink.url)}`, '_blank')}
                  className="border-sky-700 hover:border-sky-600 text-sky-400"
                >
                  <Twitter className="w-4 h-4 mr-2" />
                  Twitter
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`mailto:?subject=${encodeURIComponent('Присоединяйся к Neura Signals')}&body=${encodeURIComponent(`Привет! Я использую Neura Signals для торговли. Присоединяйся по моей реферальной ссылке:\n\n${referralLink.url}\n\nНе упусти возможность зарабатывать вместе!`)}`)}
                  className="border-gray-700 hover:border-gray-500"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>
          )}
          
          {referralLink && (
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                Кликов: {referralLink.clicks || 0}
              </div>
              <div className="flex items-center gap-1">
                <UserPlus className="w-4 h-4" />
                Регистраций: {referralLink.registrations || 0}
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                Конверсий: {referralLink.conversions || 0}
              </div>
            </div>
          )}
        </motion.div>

        {/* Статистика */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-green-400">+{stats.monthlyGrowth}%</span>
            </div>
            <div className="text-2xl font-bold mb-1">{stats.totalReferrals}</div>
            <div className="text-sm text-gray-400">Всего рефералов</div>
            <div className="text-xs text-gray-500 mt-2">
              Активных: {stats.activeReferrals}
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-400">+${stats.totalCommission.toFixed(2)}</span>
            </div>
            <div className="text-2xl font-bold mb-1">${stats.totalCommission.toFixed(2)}</div>
            <div className="text-sm text-gray-400">Заработано всего</div>
            <div className="text-xs text-gray-500 mt-2">
              Ожидает: ${stats.pendingCommission.toFixed(2)}
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-5 h-5 text-yellow-500" />
              <span className="text-sm text-green-400">{stats.conversionRate}%</span>
            </div>
            <div className="text-2xl font-bold mb-1">{stats.conversionRate}%</div>
            <div className="text-sm text-gray-400">Конверсия</div>
            <div className="text-xs text-gray-500 mt-2">
              Кликов: {stats.uniqueClicks}
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <Wallet className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-green-400">${stats.averageDeposit.toFixed(2)}</span>
            </div>
            <div className="text-2xl font-bold mb-1">${stats.averageDeposit.toFixed(2)}</div>
            <div className="text-sm text-gray-400">Средний депозит</div>
            <div className="text-xs text-gray-500 mt-2">
              LTV: ${stats.lifetimeValue.toFixed(2)}
            </div>
          </div>
        </motion.div>

        {/* Табы */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Обзор', icon: BarChart3 },
            { id: 'referrals', label: 'Рефералы', icon: Users },
            { id: 'commissions', label: 'Комиссии', icon: DollarSign },
            { id: 'tools', label: 'Инструменты', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Контент табов */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Обзор */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Динамика приглашений
                  </h3>
                  <div className="space-y-4">
                    {[
                      { month: 'Январь', count: 12, commission: 145.30 },
                      { month: 'Декабрь', count: 15, commission: 182.50 },
                      { month: 'Ноябрь', count: 8, commission: 95.20 },
                      { month: 'Октябрь', count: 5, commission: 62.75 },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-gray-400">{item.month}</span>
                        <div className="flex items-center gap-6">
                          <span className="text-white">{item.count} реф.</span>
                          <span className="text-green-400 font-medium">+${item.commission}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-400" />
                    Достижения
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-gray-800/30 rounded-xl">
                      <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                        <Crown className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div>
                        <div className="font-medium">Пригласи 50 рефералов</div>
                        <div className="text-sm text-gray-400">Прогресс: {stats.totalReferrals}/50</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-gray-800/30 rounded-xl">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <div className="font-medium">Заработай $1000 комиссии</div>
                        <div className="text-sm text-gray-400">Прогресс: ${stats.totalCommission.toFixed(2)}/$1000</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-400" />
                  Как это работает
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Link2 className="w-6 h-6 text-blue-400" />
                    </div>
                    <h4 className="font-medium mb-2">1. Поделитесь ссылкой</h4>
                    <p className="text-sm text-gray-400">
                      Отправьте вашу реферальную ссылку друзьям в соцсетях или мессенджерах
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <UserPlus className="w-6 h-6 text-green-400" />
                    </div>
                    <h4 className="font-medium mb-2">2. Друг регистрируется</h4>
                    <p className="text-sm text-gray-400">
                      По вашей ссылке друг создает аккаунт и пополняет баланс
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <DollarSign className="w-6 h-6 text-yellow-400" />
                    </div>
                    <h4 className="font-medium mb-2">3. Получаете комиссию</h4>
                    <p className="text-sm text-gray-400">
                      Вам начисляется до 15% от депозита друга и часть его прибыли
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Рефералы */}
          {activeTab === 'referrals' && (
            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    Ваши рефералы ({referrals.length})
                  </h3>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Экспорт
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-700"
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      Фильтр
                    </Button>
                  </div>
                </div>
              </div>
              
              {referrals.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <UserPlus className="w-10 h-10 text-gray-600" />
                  </div>
                  <h4 className="text-xl font-bold mb-3">У вас пока нет рефералов</h4>
                  <p className="text-gray-400 mb-6 max-w-md mx-auto">
                    Поделитесь вашей реферальной ссылкой и начните зарабатывать комиссию с депозитов друзей!
                  </p>
                  <Button
                    onClick={() => {
                      if (referralLink) {
                        copyToClipboard(referralLink.url);
                      }
                    }}
                    className="bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Скопировать ссылку
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-900/50">
                        <th className="text-left p-4 text-gray-400 font-medium">Пользователь</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Дата</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Статус</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Депозит</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Комиссия</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Сделки</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Прибыль</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((ref) => (
                        <tr key={ref.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="p-4">
                            <div className="font-medium">{ref.name}</div>
                            <div className="text-xs text-gray-500">{ref.email}</div>
                          </td>
                          <td className="p-4 text-gray-300">{ref.registeredAt}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-xs ${
                              ref.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {ref.status === 'active' ? 'Активен' : 'Неактивен'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="font-medium">${ref.totalDeposit.toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-green-400 font-medium">+${ref.commission.toFixed(2)}</span>
                          </td>
                          <td className="p-4 text-gray-300">{ref.trades}</td>
                          <td className="p-4">
                            <span className={ref.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                              ${ref.profit.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Комиссии */}
          {activeTab === 'commissions' && (
            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-400" />
                      История комиссий
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Доступно к выводу: ${stats.pendingCommission.toFixed(2)}
                    </p>
                  </div>
                  <Button 
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    onClick={() => setShowPayoutDialog(true)}
                    disabled={stats.pendingCommission <= 0}
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Вывести средства
                  </Button>
                </div>
              </div>

              {commissionHistory.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <DollarSign className="w-10 h-10 text-gray-600" />
                  </div>
                  <h4 className="text-xl font-bold mb-3">История комиссий пуста</h4>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Приглашайте друзей и получайте комиссию с их депозитов. История начислений появится здесь.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-900/50">
                        <th className="text-left p-4 text-gray-400 font-medium">Дата</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Тип</th>
                        <th className="text-left p-4 text-gray-400 font-medium">От кого</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Сумма</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissionHistory.map((item) => (
                        <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="p-4 text-gray-300">{item.date}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-xs ${
                              item.type === 'deposit'
                                ? 'bg-blue-500/20 text-blue-400'
                                : item.type === 'trade'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}>
                              {item.type === 'deposit' ? 'Депозит' : item.type === 'trade' ? 'Торговля' : 'Бонус'}
                            </span>
                          </td>
                          <td className="p-4 text-gray-300">{item.fromUser}</td>
                          <td className="p-4">
                            <span className="text-green-400 font-medium">+${item.amount.toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-xs ${
                              item.status === 'paid'
                                ? 'bg-green-500/20 text-green-400'
                                : item.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {item.status === 'paid' ? 'Выплачено' : item.status === 'pending' ? 'Ожидает' : 'Отменено'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Инструменты */}
          {activeTab === 'tools' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" />
                  Промо-материалы
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  Используйте готовые баннеры и тексты для привлечения рефералов
                </p>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Текст для Telegram</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-gray-400"
                        onClick={() => {
                          const text = `📊 Зарабатывай на трейдинге с Neura Signals! ИИ анализирует рынок и дает точные сигналы. Зарегистрируйся по ссылке и получи бонус: ${referralLink?.url || ''}`;
                          navigator.clipboard.writeText(text);
                          alert('Текст скопирован!');
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-400">
                      📊 Зарабатывай на трейдинге с Neura Signals! ИИ анализирует рынок и дает точные сигналы. 
                      Зарегистрируйся по ссылке и получи бонус: {referralLink?.url || ''}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Текст для Twitter</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-gray-400"
                        onClick={() => {
                          const text = `🚀 Торгуй с умом! Neura Signals - AI платформа для трейдинга. Точность сигналов 74%! Присоединяйся 👇 ${referralLink?.url || ''}`;
                          navigator.clipboard.writeText(text);
                          alert('Текст скопирован!');
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-400">
                      🚀 Торгуй с умом! Neura Signals - AI платформа для трейдинга. 
                      Точность сигналов 74%! Присоединяйся 👇
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  Аналитика ссылок
                </h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Переходы по ссылке</span>
                      <span className="text-white font-medium">{stats.uniqueClicks}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, (stats.uniqueClicks / (stats.totalClicks || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Регистрации</span>
                      <span className="text-white font-medium">{stats.totalReferrals}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, stats.conversionRate)}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Первые депозиты</span>
                      <span className="text-white font-medium">{stats.activeReferrals}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${stats.totalReferrals > 0 ? (stats.activeReferrals / stats.totalReferrals) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>
                <Button 
                  className="w-full mt-6 bg-gray-800 hover:bg-gray-700"
                  onClick={() => setActiveTab('referrals')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Подробная статистика
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Диалог вывода средств */}
      {showPayoutDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 max-w-md w-full"
          >
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-green-400" />
              Вывод средств
            </h3>
            
            <p className="text-gray-400 text-sm mb-6">
              Доступно для вывода: <span className="text-green-400 font-bold">${stats.pendingCommission.toFixed(2)}</span>
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Сумма вывода</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="pl-8 bg-gray-800/50 border-gray-700 text-white"
                    min="1"
                    max={stats.pendingCommission}
                    step="0.01"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Способ вывода</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="bank">Банковский перевод</option>
                  <option value="crypto">Криптовалюта (USDT)</option>
                  <option value="card">Карта</option>
                  <option value="pocketoption">PocketOption</option>
                </select>
              </div>
              
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={requestPayout}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  disabled={!payoutAmount || parseFloat(payoutAmount) <= 0 || parseFloat(payoutAmount) > stats.pendingCommission}
                >
                  Подтвердить
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPayoutDialog(false)}
                  className="flex-1 border-gray-700 hover:border-gray-500"
                >
                  Отмена
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Вспомогательная функция для получения требования следующего ранга
function getNextRankRequirement(rank: string): number {
  switch(rank) {
    case 'Silver': return 10;
    case 'Gold': return 25;
    case 'Platinum': return 50;
    case 'Diamond': return 100;
    default: return 0;
  }
}