// components/modals/UserProfileDropdown.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Settings, 
  LogOut, 
  Bell, 
  CreditCard, 
  BarChart3,
  ChevronDown,
  ChevronRight,
  Star,
  Shield,
  Sparkles,
  Wallet,
  HelpCircle,
  Zap,
  TrendingUp,
  History,
  Key,
  ShieldCheck,
  ExternalLink
} from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UserProfileDropdownProps {
  className?: string;
  variant?: "desktop" | "mobile";
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  className,
  variant = "desktop"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && !(event.target as Element).closest('.user-profile-dropdown')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Если пользователь не авторизован, не показываем меню
  if (!isAuthenticated || !user) return null;

  const menuItems = [
    {
      icon: User,
      label: t("userProfile.profile"),
      href: "/profile",
      description: t("userProfile.profileDesc"),
      color: "text-blue-400"
    },
    {
      icon: TrendingUp,
      label: t("header.signals"),
      href: "/Signals",
      description: t("userProfile.signalsDesc"),
      color: "text-green-400",
      badge: "New"
    },

    {
      icon: CreditCard,
      label: "PocketOption",
      href: "https://pocketoption.com/en/?utm_campaign=828455&utm_source=affiliate&utm_medium=sr&a=i3b3QQKnpCQikx&al=1724298&ac=users&cid=923101&code=WELCOME50",
      description: t("userProfile.brokerDesc"),
      color: "text-orange-400",
      external: true
    },
    {
      icon: Wallet,
      label: t("userProfile.balance"),
      href: "https://pocketoption.com/en/?utm_campaign=828455&utm_source=affiliate&utm_medium=sr&a=i3b3QQKnpCQikx&al=1724298&ac=users&cid=923101&code=WELCOME50",
      description: t("userProfile.balanceDesc"),
      color: "text-emerald-400",
      external: true
    },

    {
      icon: HelpCircle,
      label: t("header.support"),
      href: "/support",
      description: t("userProfile.supportDesc"),
      color: "text-cyan-400"
    },
  ];

  // Форматируем баланс
  const formattedBalance = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(user?.balance || 0);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    router.push("/");
  };

  const handleGetSignal = () => {
    router.push("/Signals");
    setIsOpen(false);
  };

  // Десктопная версия
  if (variant === "desktop") {
    return (
      <div className={cn("relative user-profile-dropdown", className)}>
        {/* Кнопка профиля */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-gray-900/50 to-gray-800/30 hover:from-gray-800 hover:to-gray-700/50 border border-gray-700/50 hover:border-gray-600 transition-all group backdrop-blur-sm"
        >
          {/* Аватар */}
          <div className="relative">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-semibold text-sm">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
              <Star className="w-1.5 h-1.5 text-white" fill="white" />
            </div>
          </div>

          {/* Информация (только на десктопе) */}
          <div className="hidden lg:block text-left">
            <p className="text-xs font-medium text-white leading-tight truncate max-w-[100px]">
              {user?.name?.split('@')[0] || "Пользователь"}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles className="w-2.5 h-2.5 text-yellow-500" />
              <span className="text-[10px] text-green-400 font-semibold">
                {formattedBalance.replace('$', '$ ')}
              </span>
            </div>
          </div>

          {/* Стрелка */}
          <ChevronDown className={cn(
            "w-3.5 h-3.5 transition-transform duration-200",
            isOpen ? "text-white rotate-180" : "text-gray-400 group-hover:text-white"
          )} />
        </motion.button>

        {/* Выпадающее меню (десктоп) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2 w-80 z-50"
            >
              <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-gray-800 shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-xl">
                {/* Шапка профиля */}
                <div className="p-4 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-pink-900/20 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur opacity-30"
                      />
                      <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-lg">
                          {user?.name?.[0]?.toUpperCase() || "U"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold truncate">{user?.name}</h3>
                      <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          <div className="px-2 py-0.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full border border-yellow-500/30">
                            <div className="flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5 text-yellow-400" />
                              <span className="text-xs font-medium text-yellow-400">Premium</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 bg-gray-900/50 px-2 py-1 rounded-lg">
                          <Wallet className="w-3 h-3 text-emerald-400" />
                          <span className="text-sm font-bold text-emerald-400">
                            {user?.balance?.toLocaleString() || '0'}
                          </span>
                          <span className="text-xs text-gray-400">$</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Основные пункты меню */}
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  <div className="p-2">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <Button
                        onClick={handleGetSignal}
                        size="sm"
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                      >
                        <Zap className="w-3.5 h-3.5 mr-1.5" />
                        {t("userProfile.getSignal")}
                      </Button>
                      <Button
                        onClick={() => window.open("https://pocketoption.com/en/?utm_campaign=828455&utm_source=affiliate&utm_medium=sr&a=i3b3QQKnpCQikx&al=1724298&ac=users&cid=923101&code=WELCOME50", "_blank")}
                        size="sm"
                        variant="outline"
                        className="w-full border-gray-700 hover:border-gray-600 hover:bg-gray-800/50 text-white"
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                        {t("userProfile.topUp")}
                      </Button>
                    </div>

                    {menuItems.slice(0, 4).map((item, index) => (
                      <Link key={index} href={item.href} target={item.external ? "_blank" : "_self"}>
                        <motion.div
                          whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.05)" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => !item.external && setIsOpen(false)}
                          className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg bg-gray-800/50 group-hover:bg-gray-700/50", item.color)}>
                              <item.icon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">{item.label}</span>
                                {item.badge && (
                                  <span className="px-1.5 py-0.5 bg-green-500 text-[10px] font-bold text-white rounded-full">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400">{item.description}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300" />
                        </motion.div>
                      </Link>
                    ))}
                  </div>

                  {/* Разделитель */}
                  <div className="px-4 py-2">
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
                  </div>

                  {/* Второстепенные пункты */}
                  <div className="p-2">
                    {menuItems.slice(4).map((item, index) => (
                      <Link key={index} href={item.href} target={item.external ? "_blank" : "_self"}>
                        <motion.div
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => !item.external && setIsOpen(false)}
                          className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-800/30 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <item.icon className={cn("w-4 h-4", item.color)} />
                            <span className="text-sm text-gray-300 group-hover:text-white">{item.label}</span>
                          </div>
                          {item.external ? (
                            <ExternalLink className="w-3 h-3 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-gray-500" />
                          )}
                        </motion.div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Выйти */}
                <div className="p-3 border-t border-gray-800/50 bg-gray-900/30">
                  <motion.button
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 cursor-pointer transition-colors group"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">{t("auth.logout")}</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Мобильная версия (просто кнопка аватарки)
  return (
    <Link href="/profile" className={className}>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-2 py-1 rounded-xl bg-gradient-to-r from-gray-900/50 to-gray-800/30 border border-gray-700/50"
      >
        <div className="relative">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900" />
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </motion.div>
    </Link>
  );
};