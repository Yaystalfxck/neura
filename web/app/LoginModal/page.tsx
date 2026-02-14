// app/profile/page.tsx
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
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";

// Типы для профиля пользователя
interface UserProfile {
  name?: string;
  email?: string;
  phone?: string;
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
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserProfile>({
    name: "",
    email: "",
    phone: "",
    country: "Россия",
    language: "Русский",
  });

  // История сделок
  const [trades, setTrades] = useState<Trade[]>([
    { id: 1, pair: "NVDA/USD", direction: 'BUY', profit: 125.50, percent: 5.2, status: 'success', date: "15.01.2024 14:30", entry: 865.42, target: 910.80, stopLoss: 825.00 },
    { id: 2, pair: "EUR/USD", direction: 'SELL', profit: -45.20, percent: -1.8, status: 'failed', date: "15.01.2024 11:15", entry: 1.0950, target: 1.0880, stopLoss: 1.1020 },
    { id: 3, pair: "XAU/USD", direction: 'BUY', profit: 89.30, percent: 3.7, status: 'success', date: "14.01.2024 16:45", entry: 1985.50, target: 2050.00, stopLoss: 1965.00 },
    { id: 4, pair: "BTC/USD", direction: 'SELL', profit: 324.80, percent: 8.1, status: 'success', date: "13.01.2024 09:20", entry: 42500, target: 41000, stopLoss: 43500 },
    { id: 5, pair: "AAPL/USD", direction: 'BUY', profit: 67.90, percent: 2.3, status: 'success', date: "12.01.2024 13:10", entry: 185.60, target: 190.00, stopLoss: 182.00 },
  ]);

  // Статистика
  const totalProfit = trades.reduce((sum, trade) => sum + trade.profit, 0);
  const successTrades = trades.filter(trade => trade.status === 'success').length;
  const successRate = Math.round((successTrades / trades.length) * 100);

  // Загружаем данные пользователя при монтировании
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

  const countries = ["Россия", "Казахстан", "Беларусь", "Украина", "Другая"];
  const languages = ["Русский", "English", "Español", "Deutsch", "Français"];

  const handleSave = async () => {
    try {
      // Обновляем данные пользователя
      updateUser(formData);
      console.log("Профиль обновлен");
      setIsEditing(false);
    } catch (error) {
      console.error("Ошибка обновления профиля:", error);
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
    setIsEditing(false);
  };

  // Показываем лоадер если пользователь загружается
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-7xl">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Профиль</h1>
            <p className="text-gray-400">Основная информация и история сделок</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => router.push('/search')}
              variant="outline"
              className="border-gray-700 hover:border-gray-500"
            >
              Поиск сигналов
            </Button>
            {isEditing ? (
              <>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-red-700 hover:border-red-600 text-red-400"
                >
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-gradient-to-r from-green-600 to-emerald-600"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="border-blue-700 hover:border-blue-600"
              >
                <Edit className="w-4 h-4 mr-2" />
                Редактировать
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Левая колонка - Основная информация */}
          <div className="lg:col-span-2 space-y-8">

            

            {/* Основная информация */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6"
            >
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                Основная информация
              </h2>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Имя */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Имя
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        placeholder="Ваше имя"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-800/30 rounded-lg border border-gray-700">
                        {user.name || "Не указано"}
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </label>
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/30 rounded-lg border border-gray-700">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span>{user.email}</span>
                    </div>
                  </div>

                  {/* Телефон */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      Телефон
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={formData.phone || ""}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        placeholder="+7 (999) 123-45-67"
                      />
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/30 rounded-lg border border-gray-700">
                        <Smartphone className="w-4 h-4 text-gray-500" />
                        <span>{formData.phone || "Не указан"}</span>
                      </div>
                    )}
                  </div>

                  {/* Страна */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Страна
                    </label>
                    {isEditing ? (
                      <select
                        value={formData.country || "Россия"}
                        onChange={(e) => setFormData({...formData, country: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        {countries.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/30 rounded-lg border border-gray-700">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span>{formData.country || "Не указана"}</span>
                      </div>
                    )}
                  </div>

                  {/* Язык */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                      <Globe2 className="w-4 h-4" />
                      Язык
                    </label>
                    {isEditing ? (
                      <select
                        value={formData.language || "Русский"}
                        onChange={(e) => setFormData({...formData, language: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        {languages.map((language) => (
                          <option key={language} value={language}>
                            {language}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/30 rounded-lg border border-gray-700">
                        <Globe2 className="w-4 h-4 text-gray-500" />
                        <span>{formData.language || "Русский"}</span>
                      </div>
                    )}
                  </div>

                  {/* Дата регистрации */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Дата регистрации
                    </label>
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/30 rounded-lg border border-gray-700">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : "Нет данных"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Правая колонка - История сделок */}
          <div className="space-y-8">
            {/* Баланс и аватар */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 text-center"
            >
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
                {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
              </div>
              <h3 className="text-xl font-bold mb-1 truncate px-2">
                {user.name || user.email || "Пользователь"}
              </h3>
              <p className="text-gray-400 mb-6 truncate px-2">{user.email}</p>
              
              <div className="bg-gray-800/30 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Текущий баланс</span>
                  <DollarSign className="w-4 h-4 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-green-400">
                  ${typeof user.balance === 'number' 
                    ? user.balance.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) 
                    : '0.00'}
                </div>
                <div className="text-sm text-gray-500 mt-1">Доступно для торговли</div>
              </div>

              {/* PocketOption ID (только просмотр) */}
              {user.pocketOptionId && (
                <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-800/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-sm text-gray-300">PocketOption ID:</span>
                    <span className="font-mono text-green-400">{user.pocketOptionId}</span>
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    ID привязан к аккаунту
                  </div>
                </div>
              )}
            </motion.div>

            {/* История сделок */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6"
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-yellow-400" />
                Последние сделки
              </h3>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {trades.slice(0, 5).map((trade) => (
                  <div
                    key={trade.id}
                    className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{trade.pair}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          trade.direction === 'BUY' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.direction}
                        </span>
                      </div>
                      <div className={`flex items-center gap-1 ${
                        trade.profit >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}$
                        <span className="text-xs">({trade.percent >= 0 ? '+' : ''}{trade.percent}%)</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {trade.status === 'success' ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span className="text-green-400">Успешно</span>
                          </>
                        ) : trade.status === 'failed' ? (
                          <>
                            <XCircle className="w-3 h-3 text-red-500" />
                            <span className="text-red-400">Неудача</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-yellow-500" />
                            <span className="text-yellow-400">В процессе</span>
                          </>
                        )}
                      </div>
                      <span className="text-gray-400 text-xs">{trade.date}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-800">
                <Button 
                  onClick={() => router.push('/my-signals')}
                  variant="outline"
                  className="w-full border-gray-700 hover:border-gray-500"
                >
                  <History className="w-4 h-4 mr-2" />
                  Вся история сделок
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}