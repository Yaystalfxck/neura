"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  DollarSign,
  Calendar,
  Copy,
  Check,
  Wallet,
  TrendingUp,
  Shield,
  Phone,
  MapPin,
  Globe,
  Edit2,
  Save,
  X,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { useLanguage } from "@/app/contexts/LanguageContext";

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const { t, language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    country: "",
  });
  const [pocketOptionId, setPocketOptionId] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userCountry, setUserCountry] = useState("");

  // Синхронизация баланса
  const syncBalance = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/user/sync-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error syncing balance:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Загрузка данных пользователя
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/profile', {
          credentials: 'include',
        });
        
        
        const data = await response.json();
        
        if (data.success && data.user) {
          const user = data.user;
          
          setFormData({
            name: user.name || "",
            email: user.email || "",
            phone: user.phone || "",
            country: user.country || "",
          });
          setUserPhone(user.phone || "");
          setUserCountry(user.country || "");
          // API возвращает snake_case: pocket_option_id
          setPocketOptionId(user.pocket_option_id || user.pocketOptionId || "");
          // API возвращает строку с датой
          setCreatedAt(user.created_at || user.createdAt || "");
          
        } else {
          console.error('❌ No user data in response');
        }
      } catch (error) {
        console.error('❌ Error loading profile:', error);
      }
    };
    
    loadProfile();
  }, []);

  // Копирование ID
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Сохранение изменений
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Отправляем только поля которые можно редактировать
      const updateData = {
        name: formData.name,
        phone: formData.phone,
        country: formData.country,
      };
      
      
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setIsEditing(false);
        // Перезагружаем страницу для обновления всех данных
        window.location.reload();
      } else {
        console.error('Error saving profile:', data.message || data.detail);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Форматирование баланса
  const formatBalance = (balance: number | null | undefined) => {
    if (balance === null || balance === undefined) return '0.00';
    return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(balance);
  };

  // Форматирование даты
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '—';
      return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch (error) {
      return '—';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center px-4">
          <Shield className="w-20 h-20 text-gray-600 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-3">{t("profile.accessDenied")}</h2>
          <p className="text-gray-400 mb-8">{t("profile.loginRequired")}</p>
          <Button 
            onClick={() => router.push('/')} 
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {t("header.home")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header с градиентом */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-xl" />
          <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Аватар */}
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/50">
                  <User className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full border-4 border-gray-900 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>

              {/* Информация */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent">
                  {user.name || user.email.split('@')[0]}
                </h1>
                <p className="text-gray-400 text-lg mb-4">{user.email}</p>
                
                {/* Кнопки действий */}
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <Button
                    onClick={() => setIsEditing(!isEditing)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {isEditing ? (
                      <>
                        <X className="w-4 h-4 mr-2" />
                        {t("common.cancel")}
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-4 h-4 mr-2" />
                        {t("profile.edit")}
                      </>
                    )}
                  </Button>
                  
                  {isEditing && (
                    <>
                      <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        {isSaving ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        {t("profile.save")}
                      </Button>
                      
                      <Button
                        onClick={() => {
                          setIsEditing(false);
                          setFormData({
                            name: user.name || "",
                            email: user.email || "",
                            phone: user.phone || "",
                            country: user.country || "",
                          });
                        }}
                        variant="outline"
                        className="border-white/20 hover:bg-white/10"
                      >
                        {t("common.reset")}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Баланс */}
              <div className="w-full md:w-auto">
                <div className="bg-gradient-to-br from-emerald-500/20 to-green-500/20 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 text-center md:text-right">
                  <p className="text-emerald-300/60 text-sm mb-2">{t("profile.balance")}</p>
                  <div className="flex items-center justify-center md:justify-end gap-3">
                    <p className="text-3xl font-bold text-emerald-400">
                      {formatBalance(user.balance)}
                    </p>
                    <Button
                      onClick={syncBalance}
                      disabled={isSyncing}
                      size="sm"
                      variant="ghost"
                      className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20"
                    >
                      {isSyncing ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-emerald-300/40 text-xs mt-2">PocketOption</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Уведомление об успешном сохранении */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-green-500/20 backdrop-blur-xl border border-green-500/30 rounded-2xl flex items-center gap-3"
            >
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-green-300">{t("profile.changesSaved")}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Основная информация */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Левая колонка - Информация */}
          <div className="lg:col-span-2 space-y-6">
            {/* Личные данные */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  {t("profile.personalInfo")}
                </h2>
              </div>

              <div className="space-y-4">
                {/* Имя */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">{t("profile.name")}</label>
                  {isEditing ? (
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-white/5 border-white/10 focus:border-blue-500/50 text-white"
                      placeholder={t("profile.namePlaceholder")}
                    />
                  ) : (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <p className="text-white font-medium">{user.name || '—'}</p>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">{t("profile.email")}</label>
                  {isEditing ? (
                    <Input
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-white/5 border-white/10 focus:border-blue-500/50 text-white"
                      placeholder="email@example.com"
                    />
                  ) : (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                      <p className="text-white font-medium">{user.email}</p>
                      <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                        {t("profile.verified")}
                      </div>
                    </div>
                  )}
                </div>

                {/* Телефон */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">{t("profile.phone")}</label>
                  {isEditing ? (
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="bg-white/5 border-white/10 focus:border-blue-500/50 text-white pl-12"
                        placeholder="+7 (999) 000-00-00"
                      />
                    </div>
                  ) : (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-500" />
                      <p className="text-white font-medium">{userPhone || '—'}</p>
                    </div>
                  )}
                </div>

                {/* Страна */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">{t("profile.country")}</label>
                  {isEditing ? (
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <Input
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="bg-white/5 border-white/10 focus:border-blue-500/50 text-white pl-12"
                        placeholder={t("profile.countryPlaceholder")}
                      />
                    </div>
                  ) : (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-gray-500" />
                      <p className="text-white font-medium">{userCountry || '—'}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Правая колонка - Дополнительно */}
          <div className="space-y-6">
            {/* PocketOption ID */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6"
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-400" />
                PocketOption ID
              </h3>
              
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
                <p className="text-gray-400 text-sm mb-2">Ваш ID</p>
                <div className="flex items-center justify-between">
                  <p className="text-white font-mono font-bold break-all">
                    {pocketOptionId || '—'}
                  </p>
                  {pocketOptionId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(pocketOptionId)}
                      className="text-blue-400 hover:text-white flex-shrink-0 ml-2"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              <p className="text-xs text-gray-500">
                {t("profile.pocketOptionIdNote")}
              </p>
            </motion.div>

            {/* Дата регистрации */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6"
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                {t("profile.registered")}
              </h3>
              
              <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-4">
                <p className="text-white font-medium">
                  {formatDate(createdAt)}
                </p>
              </div>
            </motion.div>

            {/* Язык */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6"
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                {t("profile.language")}
              </h3>
              
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4">
                <p className="text-white font-medium capitalize">
                  {language === 'ru' ? 'Русский' : 'English'}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
