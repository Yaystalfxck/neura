"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  User, 
  Mail, 
  DollarSign, 
  Calendar,
  Edit,
  Save,
  X,
  Smartphone,
  MapPin,
  Globe2,
  History,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Check,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Award,
  Shield,
  ChevronRight,
  LogOut,
  Settings,
  Copy,
  CheckCheck,
  Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";

interface UserProfile {
  name?: string;
  email?: string;
  phone?: string | null;
  country?: string;
  language?: string;
}

interface Trade {
  id: number;
  pair: string;
  direction: 'BUY' | 'SELL';
  profit: number;
  percent: number;
  status: 'success' | 'failed' | 'pending';
  date: string;
  entry: number;
  target: number;
  stopLoss: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState<UserProfile>({
    name: "",
    email: "",
    phone: "",
    country: "Россия",
    language: "Русский",
  });

  // Моковые данные сделок с более реалистичными значениями
  const [trades] = useState<Trade[]>([
    { id: 1, pair: "NVDA/USD", direction: 'BUY', profit: 125.50, percent: 5.2, status: 'success', date: "15.01.2024 14:30", entry: 865.42, target: 910.80, stopLoss: 825.00 },
    { id: 2, pair: "EUR/USD", direction: 'SELL', profit: -45.20, percent: -1.8, status: 'failed', date: "15.01.2024 11:15", entry: 1.0950, target: 1.0880, stopLoss: 1.1020 },
    { id: 3, pair: "XAU/USD", direction: 'BUY', profit: 89.30, percent: 3.7, status: 'success', date: "14.01.2024 16:45", entry: 1985.50, target: 2050.00, stopLoss: 1965.00 },
    { id: 4, pair: "BTC/USD", direction: 'SELL', profit: 324.80, percent: 8.1, status: 'success', date: "13.01.2024 09:20", entry: 42500, target: 41000, stopLoss: 43500 },
    { id: 5, pair: "AAPL/USD", direction: 'BUY', profit: 67.90, percent: 2.3, status: 'success', date: "12.01.2024 13:10", entry: 185.60, target: 190.00, stopLoss: 182.00 },
    { id: 6, pair: "TSLA/USD", direction: 'BUY', profit: 234.50, percent: 6.8, status: 'success', date: "11.01.2024 10:30", entry: 234.50, target: 250.00, stopLoss: 220.00 },
    { id: 7, pair: "GBP/USD", direction: 'SELL', profit: -32.10, percent: -1.2, status: 'failed', date: "10.01.2024 15:45", entry: 1.2650, target: 1.2580, stopLoss: 1.2720 },
  ]);

  // Статистика
  const totalProfit = trades.reduce((sum, trade) => sum + trade.profit, 0);
  const successTrades = trades.filter(trade => trade.status === 'success').length;
  const failedTrades = trades.filter(trade => trade.status === 'failed').length;
  const successRate = Math.round((successTrades / trades.length) * 100);
  const avgProfit = trades.length > 0 ? (totalProfit / trades.length) : 0;
  const bestTrade = Math.max(...trades.map(t => t.profit));
  const worstTrade = Math.min(...trades.map(t => t.profit));

  // Загружаем данные пользователя
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        country: user.country || "Россия",
        language: user.language || "Русский",
      });
    }
  }, [user]);

  // Сбрасываем сообщение об успехе
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const countries = ["Россия", "Казахстан", "Беларусь", "Украина", "США", "Германия", "Франция", "Испания", "Италия", "Другая"];
  const languages = ["Русский", "English", "Español", "Deutsch", "Français", "Italiano", "中文", "日本語"];

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      
      const updateData: Partial<UserProfile> = {};
      
      if (formData.name !== user?.name) updateData.name = formData.name;
      if (formData.email !== user?.email) updateData.email = formData.email;
      if (formData.phone !== user?.phone) updateData.phone = formData.phone;
      if (formData.country !== user?.country) updateData.country = formData.country;
      if (formData.language !== user?.language) updateData.language = formData.language;
      
      if (Object.keys(updateData).length === 0) {
        setIsEditing(false);
        return;
      }
      
      const result = await updateUser(updateData);
      
      if (result.success) {
        setSaveSuccess(true);
        setIsEditing(false);
      } else {
        setSaveError(result.error || 'Ошибка при сохранении профиля');
      }
    } catch (error) {
      setSaveError('Произошла ошибка при сохранении');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        country: user.country || "Россия",
        language: user.language || "Русский",
      });
    }
    setSaveError(null);
    setIsEditing(false);
  };

  const copyPocketOptionId = () => {
    if (user?.pocketOptionId) {
      navigator.clipboard.writeText(user.pocketOptionId);
      setCopied(true);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getInitials = () => {
    if (user?.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || "U";
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-blue-500 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <User className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <p className="mt-6 text-gray-400 text-lg">Загрузка профиля...</p>
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
      </div>

      <div className="container mx-auto px-4 pt-24 pb-12 max-w-7xl relative z-10">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <span>Главная</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white">Профиль</span>
        </div>

        {/* Заголовок с действиями */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Профиль пользователя
            </h1>
            <p className="text-gray-400 mt-2">Управляйте вашим аккаунтом и отслеживайте статистику</p>
          </div>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <Button
              onClick={() => router.push('/dashboard')}
              variant="outline"
              className="border-gray-700 hover:border-gray-500 hover:bg-white/5 flex-1 sm:flex-initial"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Дашборд
            </Button>
            {isEditing ? (
              <>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-red-700 hover:border-red-600 text-red-400 hover:text-red-300 hover:bg-red-950/30 flex-1 sm:flex-initial"
                  disabled={isSaving}
                >
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 flex-1 sm:flex-initial"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Сохранить
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  className="border-blue-700 hover:border-blue-600 text-blue-400 hover:text-blue-300 hover:bg-blue-950/30 flex-1 sm:flex-initial"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Редактировать
                </Button>
                <Button
                  onClick={logout}
                  variant="outline"
                  className="border-gray-700 hover:border-red-600 text-gray-400 hover:text-red-400 hover:bg-red-950/30 flex-1 sm:flex-initial"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Выйти
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Уведомления */}
        {saveError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-red-950/50 border border-red-800 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 flex-1">{saveError}</p>
            <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-green-950/50 border border-green-800 rounded-xl flex items-center gap-3"
          >
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-400 flex-1">Профиль успешно обновлен!</p>
            <button onClick={() => setSaveSuccess(false)} className="text-green-400 hover:text-green-300">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Основной контент */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Левая колонка - Основная информация */}
          <div className="lg:col-span-2 space-y-8">
            {/* Карточка профиля */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 md:p-8 hover:border-gray-700 transition-all"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="relative">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl md:text-3xl font-bold shadow-lg shadow-blue-500/20">
                    {getInitials()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-gray-900"></div>
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">{user.name || "Пользователь"}</h2>
                  <p className="text-gray-400 flex items-center gap-2 mt-1">
                    <Mail className="w-4 h-4" />
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Имя */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Имя пользователя
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      placeholder="Введите ваше имя"
                      disabled={isSaving}
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-800/30 rounded-xl border border-gray-700 text-gray-300">
                      {user.name || "Не указано"}
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email адрес
                  </label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      placeholder="Ваш email"
                      disabled={isSaving}
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-800/30 rounded-xl border border-gray-700 text-gray-300">
                      {user.email}
                    </div>
                  )}
                </div>

                {/* Телефон */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    Номер телефона
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      placeholder="+7 (999) 123-45-67"
                      disabled={isSaving}
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-800/30 rounded-xl border border-gray-700 text-gray-300">
                      {user.phone || "Не указан"}
                    </div>
                  )}
                </div>

                {/* Страна */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Страна проживания
                  </label>
                  {isEditing ? (
                    <select
                      value={formData.country || "Россия"}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      disabled={isSaving}
                    >
                      {countries.map((country) => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-4 py-3 bg-gray-800/30 rounded-xl border border-gray-700 text-gray-300">
                      {user.country || "Не указана"}
                    </div>
                  )}
                </div>

                

                {/* Дата регистрации */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Дата регистрации
                  </label>
                  <div className="px-4 py-3 bg-gray-800/30 rounded-xl border border-gray-700 text-gray-300">
                    {user.createdAt ? formatDate(user.createdAt) : "Нет данных"}
                  </div>
                </div>

                {/* Статус аккаунта */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Статус аккаунта
                  </label>
                  <div className="px-4 py-3 bg-gray-800/30 rounded-xl border border-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-400">Активен</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Расширенная статистика торговли */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 md:p-8 hover:border-gray-700 transition-all"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Детальная статистика торговли
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Всего сделок</div>
                  <div className="text-2xl font-bold">{trades.length}</div>
                  <div className="text-xs text-gray-500 mt-1">за всё время</div>
                </div>
                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Успешных</div>
                  <div className="text-2xl font-bold text-green-400">{successTrades}</div>
                  <div className="text-xs text-gray-500 mt-1">{successRate}% успеха</div>
                </div>
                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Неудачных</div>
                  <div className="text-2xl font-bold text-red-400">{failedTrades}</div>
                  <div className="text-xs text-gray-500 mt-1">{100 - successRate}% неудач</div>
                </div>
                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Средняя прибыль</div>
                  <div className={`text-2xl font-bold ${avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${avgProfit.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">на сделку</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-green-950/30 to-emerald-950/30 rounded-xl p-4 border border-green-800/30">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-300">Лучшая сделка</span>
                  </div>
                  <div className="text-2xl font-bold text-green-400">+${bestTrade.toFixed(2)}</div>
                </div>
                <div className="bg-gradient-to-r from-red-950/30 to-rose-950/30 rounded-xl p-4 border border-red-800/30">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-gray-300">Худшая сделка</span>
                  </div>
                  <div className="text-2xl font-bold text-red-400">${worstTrade.toFixed(2)}</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Правая колонка */}
          <div className="space-y-8">
            {/* Карточка баланса */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-green-400" />
                  Баланс
                </h3>
                <DollarSign className="w-6 h-6 text-green-500/50" />
              </div>
              
              <div className="text-3xl md:text-4xl font-bold text-green-400 mb-2">
                ${typeof user.balance === 'number' 
                  ? user.balance.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                  : '0.00'}
              </div>
              <p className="text-sm text-gray-500 mb-4">Доступно для торговли</p>

              <div className="h-2 bg-gray-800 rounded-full mb-4">
                <div className="w-3/4 h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"></div>
              </div>

              <Button 
                onClick={() => router.push('/deposit')}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                Пополнить баланс
              </Button>
            </motion.div>

            {/* PocketOption ID */}
            {user.pocketOptionId && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-green-950/30 to-emerald-950/30 border border-green-800/30 rounded-2xl p-6 hover:border-green-700/50 transition-all"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-green-400" />
                  <h3 className="text-lg font-bold text-green-400">PocketOption ID</h3>
                </div>
                
                <div className="bg-black/50 rounded-xl p-4 mb-4 font-mono text-center text-green-400 text-lg border border-green-800/30">
                  {user.pocketOptionId}
                </div>
                
                <Button
                  onClick={copyPocketOptionId}
                  variant="outline"
                  className="w-full border-green-800 hover:border-green-600 text-green-400 hover:text-green-300 hover:bg-green-950/30"
                >
                  {copied ? (
                    <>
                      <CheckCheck className="w-4 h-4 mr-2" />
                      Скопировано!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Копировать ID
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {/* Быстрые действия */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all"
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-400" />
                Быстрые действия
              </h3>
              
              <div className="space-y-3">
                <Button
                  onClick={() => router.push('/my-signals')}
                  variant="outline"
                  className="w-full justify-start border-gray-700 hover:border-blue-600 hover:bg-blue-950/30"
                >
                  <History className="w-4 h-4 mr-2" />
                  История сделок
                </Button>
                <Button
                  onClick={() => router.push('/settings')}
                  variant="outline"
                  className="w-full justify-start border-gray-700 hover:border-purple-600 hover:bg-purple-950/30"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Настройки аккаунта
                </Button>
                <Button
                  onClick={() => router.push('/support')}
                  variant="outline"
                  className="w-full justify-start border-gray-700 hover:border-yellow-600 hover:bg-yellow-950/30"
                >
                  <Headphones className="w-4 h-4 mr-2" />
                  Поддержка
                </Button>
              </div>
            </motion.div>

            {/* Последние сделки (мобильная версия) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:hidden bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all"
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-yellow-400" />
                Последние сделки
              </h3>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {trades.slice(0, 3).map((trade) => (
                  <div
                    key={trade.id}
                    className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{trade.pair}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        trade.direction === 'BUY' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.direction}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}$
                      </span>
                      <span className="text-gray-400 text-xs">{trade.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* История сделок (десктоп) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="hidden lg:block mt-8 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 md:p-8 hover:border-gray-700 transition-all"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-yellow-400" />
              История последних сделок
            </h3>
            <Button
              onClick={() => router.push('/my-signals')}
              variant="outline"
              className="border-gray-700 hover:border-blue-600"
            >
              Все сделки
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-gray-800">
                  <th className="pb-3 font-medium">Пара</th>
                  <th className="pb-3 font-medium">Тип</th>
                  <th className="pb-3 font-medium">Прибыль</th>
                  <th className="pb-3 font-medium">Процент</th>
                  <th className="pb-3 font-medium">Статус</th>
                  <th className="pb-3 font-medium">Дата</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(0, 5).map((trade) => (
                  <tr key={trade.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                    <td className="py-4 font-medium">{trade.pair}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        trade.direction === 'BUY' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className={`py-4 font-bold ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}$
                    </td>
                    <td className={`py-4 ${trade.percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.percent >= 0 ? '+' : ''}{trade.percent}%
                    </td>
                    <td className="py-4">
                      {trade.status === 'success' ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          Успешно
                        </span>
                      ) : trade.status === 'failed' ? (
                        <span className="flex items-center gap-1 text-red-400">
                          <XCircle className="w-4 h-4" />
                          Неудача
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Clock className="w-4 h-4" />
                          В процессе
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-gray-400">{trade.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Импортируем недостающую иконку
import { Headphones } from "lucide-react";