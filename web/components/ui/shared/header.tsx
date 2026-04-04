// components/ui/shared/header.tsx - исправленная версия
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Menu, 
  X, 
  User, 
  LogIn, 
  LogOut,
  Home,
  Info,
  BookOpen,
  Handshake,
  Zap,
  Sparkles,
  ChevronRight,
  CreditCard,
  Shield,
  Bell,
  TrendingUp,
  Star,
  Moon,
  Settings,
  Wallet,
  HelpCircle,
  BarChart3
} from "lucide-react";
import { LoginDialog } from "@/components/modals/LoginDialog";
import { RegisterDialog } from "@/components/modals/RegisterDialog";
import { UserProfileDropdown } from "@/components/modals/UserProfileDropdown";
import { useAuth } from "@/app/contexts/AuthContext";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/shared/LanguageSwitcher";

interface Props {
    className?: string;
}

export const Header: React.FC<Props> = ({ className }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
    const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [hoveredLink, setHoveredLink] = useState<string | null>(null);
    
    const pathname = usePathname();
    const router = useRouter();
    const { user, isAuthenticated, logout } = useAuth();
    const { t, language, setLanguage } = useLanguage();

    // Эффект для отслеживания скролла с debounce
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        
        const handleScroll = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setScrolled(window.scrollY > 10);
            }, 10);
        };
        
        window.addEventListener("scroll", handleScroll);
        return () => {
            window.removeEventListener("scroll", handleScroll);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);

    // Блокировка скролла при открытом меню
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isMenuOpen]);

    const navLinks = [
        { id: "home", href: "/", label: t("header.home"), icon: <Home className="w-5 h-5" /> },
        { id: "about", href: "/about", label: t("header.about"), icon: <Info className="w-5 h-5" /> },
        { id: "guide", href: "/guide", label: t("header.guide"), icon: <BookOpen className="w-5 h-5" /> },
        { id: "partners", href: "/partners", label: t("header.partners"), icon: <Handshake className="w-5 h-5" /> }
    ];

    const protectedLinks = [
        { id: "signals", href: "/Signals", label: t("header.signals"), icon: <TrendingUp className="w-5 h-5" /> },
    ];

    const userLinks = [
        { id: "profile", href: "/profile", label: t("header.profile"), icon: <User className="w-5 h-5" /> },
        { id: "balance", href: "https://pocketoption.com/en/?utm_campaign=828455&utm_source=affiliate&utm_medium=sr&a=i3b3QQKnpCQikx&al=1724298&ac=users&cid=923101&code=WELCOME50", label: t("header.balance"), icon: <Wallet className="w-5 h-5" />, external: true },
        { id: "support", href: "/support", label: t("header.support"), icon: <HelpCircle className="w-5 h-5" /> },
    ];

    const handleLogout = async () => {
        await logout();
        setIsMenuOpen(false);
        router.push("/");
    };

    // Улучшенная функция для отображения имени пользователя
    const getUserDisplayName = () => {
        if (user?.name && user.name.trim().length > 0) {
            return user.name;
        }
        if (user?.email) {
            return user.email.split('@')[0];
        }
        return "Пользователь";
    };

    const getUserInitial = () => {
        const displayName = getUserDisplayName();
        return displayName[0]?.toUpperCase() || "U";
    };

    return (
        <>
            <motion.header 
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={cn(
                    'sticky top-0 z-50 border-b transition-all duration-300',
                    scrolled 
                        ? 'border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl shadow-black/50' 
                        : 'border-transparent bg-black/90 backdrop-blur-lg',
                    className
                )}
            >
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between py-4">
                        {/* Логотип с анимацией */}
                        <Link href="/">
                            <motion.div 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="flex items-center gap-3 group cursor-pointer"
                            >
                                <div className="relative">
                                    <motion.div 
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-20 group-hover:opacity-30 transition-opacity"
                                    />
                                    <div className="relative w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                        <Zap className="w-5 h-5 text-white" fill="white" />
                                    </div>
                                </div>
                                <div>
                                    <motion.h1 
                                        initial={{ opacity: 0.8 }}
                                        whileHover={{ opacity: 1 }}
                                        className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
                                    >
                                        Neura
                                    </motion.h1>
                                    <p className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                                        AI for you
                                    </p>
                                </div>
                            </motion.div>
                        </Link>

                        {/* Десктопная навигация - с исправленной анимацией */}
                        <nav className="hidden lg:flex items-center gap-6">
                            {navLinks.map((link) => (
                                <div key={link.id} className="relative">
                                    <motion.div
                                        whileHover={{ y: -2 }}
                                        whileTap={{ scale: 0.95 }}
                                        onHoverStart={() => setHoveredLink(link.id)}
                                        onHoverEnd={() => setHoveredLink(null)}
                                        className="relative"
                                    >
                                        {link.external ? (
                                            <a
                                                href={link.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cn(
                                                    "relative text-sm font-medium transition-all px-1 py-2 block",
                                                    pathname === link.href
                                                        ? "text-white"
                                                        : "text-gray-400 hover:text-white"
                                                )}
                                            >
                                                {link.label}
                                                {pathname === link.href && (
                                                    <motion.div
                                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                                                        layoutId={`desktop-active-${link.id}`}
                                                        key={`desktop-active-${link.id}`}
                                                    />
                                                )}
                                            </a>
                                        ) : (
                                            <Link
                                                href={link.href}
                                                className={cn(
                                                    "relative text-sm font-medium transition-all px-1 py-2 block",
                                                    pathname === link.href
                                                        ? "text-white"
                                                        : "text-gray-400 hover:text-white"
                                                )}
                                            >
                                                {link.label}
                                                {pathname === link.href && (
                                                    <motion.div
                                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                                                        layoutId={`desktop-active-${link.id}`}
                                                        key={`desktop-active-${link.id}`}
                                                    />
                                                )}
                                            </Link>
                                        )}
                                    </motion.div>

                                    {/* Анимация при наведении - упрощенная */}
                                    {hoveredLink === link.id && pathname !== link.href && (
                                        <motion.div
                                            initial={{ scaleX: 0 }}
                                            animate={{ scaleX: 1 }}
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gray-500/30 to-gray-400/30 rounded-full origin-left"
                                        />
                                    )}
                                </div>
                            ))}
                            
                            {/* Защищённые ссылки для авторизованных */}
                            {isAuthenticated && protectedLinks.map((link) => (
                                <div key={link.id} className="relative">
                                    <motion.div
                                        whileHover={{ y: -2 }}
                                        whileTap={{ scale: 0.95 }}
                                        onHoverStart={() => setHoveredLink(link.id)}
                                        onHoverEnd={() => setHoveredLink(null)}
                                        className="relative"
                                    >
                                        <Link
                                            href={link.href}
                                            className={cn(
                                                "relative text-sm font-medium transition-all px-1 py-2 block",
                                                pathname === link.href
                                                    ? "text-white"
                                                    : "text-gray-400 hover:text-white"
                                            )}
                                        >
                                            {link.label}
                                            {pathname === link.href && (
                                                <motion.div
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                                                    layoutId={`protected-active-${link.id}`}
                                                    key={`protected-active-${link.id}`}
                                                />
                                            )}
                                        </Link>
                                    </motion.div>

                                    {/* Анимация при наведении */}
                                    {hoveredLink === link.id && pathname !== link.href && (
                                        <motion.div
                                            initial={{ scaleX: 0 }}
                                            animate={{ scaleX: 1 }}
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-full origin-left"
                                        />
                                    )}
                                </div>
                            ))}
                        </nav>

                        {/* Правая часть */}
                        <div className="flex items-center gap-3">
                            {/* Кнопка поддержки */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push('/support')}
                                className="hidden lg:flex items-center gap-2 text-gray-400 hover:text-white hover:bg-gray-800"
                            >
                                <HelpCircle className="w-4 h-4" />
                                <span className="text-sm">{t("header.support")}</span>
                            </Button>

                            {/* Переключатель языка */}
                            <LanguageSwitcher />

                            {isAuthenticated ? (
                                // Для десктопа - красивый профиль
                                <div className="hidden lg:block">
                                    <UserProfileDropdown />
                                </div>
                            ) : (
                                // Для неавторизованных на десктопе
                                <>
                                    <motion.div
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="hidden lg:block"
                                    >
                                        <Button
                                            onClick={() => setIsLoginDialogOpen(true)}
                                            variant="outline"
                                            className="border-gray-700 hover:border-gray-600 hover:bg-gray-900/50 text-white rounded-lg"
                                        >
                                            {t("auth.signIn")}
                                        </Button>
                                    </motion.div>

                                    <motion.div
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="hidden lg:block"
                                    >
                                        <Button
                                            onClick={() => setIsRegisterDialogOpen(true)}
                                            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg"
                                        >
                                            {t("auth.registerTitle")}
                                        </Button>
                                    </motion.div>
                                </>
                            )}

                            {/* Кнопка мобильного меню */}
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="lg:hidden p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                            >
                                {isMenuOpen ? (
                                    <X className="w-6 h-6" />
                                ) : (
                                    <Menu className="w-6 h-6" />
                                )}
                            </motion.button>
                        </div>
                    </div>
                </div>
            </motion.header>

            {/* Мобильное меню с кнопками профиля и выхода */}
            <AnimatePresence mode="wait">
                {isMenuOpen && (
                    <>
                        {/* Затемнение фона */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMenuOpen(false)}
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                        />

                        {/* Само меню */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm lg:hidden"
                        >
                            <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-black border-l border-white/10 shadow-2xl">
                                {/* Шапка меню */}
                                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-gray-900 to-black">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                                                <Zap className="w-6 h-6 text-white" fill="white" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-white">Neura</h2>
                                                <p className="text-sm text-gray-400">AI for you</p>
                                            </div>
                                        </div>
                                        <motion.button
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => setIsMenuOpen(false)}
                                            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
                                        >
                                            <X className="w-5 h-5" />
                                        </motion.button>
                                    </div>

                                    {/* Блок профиля для авторизованных пользователей */}
                                    {isAuthenticated && user && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.1 }}
                                            className="p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl border border-white/10 mb-4"
                                        >
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
                                                    <span className="text-white font-bold text-lg">
                                                        {getUserInitial()}
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-white truncate">
                                                        {getUserDisplayName()}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                                                            {t("header.balance")}: ${user?.balance?.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) || '0.00'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Кнопки профиля и выхода */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    onClick={() => {
                                                        router.push("/profile");
                                                        setIsMenuOpen(false);
                                                    }}
                                                    size="sm"
                                                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                                                >
                                                    <User className="w-4 h-4 mr-1" />
                                                    {t("header.profile")}
                                                </Button>
                                                <Button
                                                    onClick={handleLogout}
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-red-700 hover:border-red-600 hover:bg-red-900/20 text-red-400"
                                                >
                                                    <LogOut className="w-4 h-4 mr-1" />
                                                    {t("auth.logout")}
                                                </Button>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Основное содержимое меню с прокруткой */}
                                <div className="flex-1 overflow-y-auto py-4">
                                    {/* Основная навигация */}
                                    <div className="px-4 mb-6">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
                                            Навигация
                                        </h3>
                                        <div className="space-y-1">
                                            {navLinks.map((link, index) => (
                                                <motion.div
                                                    key={link.id}
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                >
                                                    {link.external ? (
                                                        <a
                                                            href={link.href}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={() => setIsMenuOpen(false)}
                                                        >
                                                            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 rounded-lg bg-gray-800">
                                                                        {link.icon}
                                                                    </div>
                                                                    <span className="font-medium text-gray-300">
                                                                        {link.label}
                                                                    </span>
                                                                </div>
                                                                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300 group-hover:translate-x-1 transition-transform" />
                                                            </div>
                                                        </a>
                                                    ) : (
                                                        <Link
                                                            href={link.href}
                                                            onClick={() => setIsMenuOpen(false)}
                                                        >
                                                            <div className={cn(
                                                                "flex items-center justify-between p-3 rounded-xl transition-all group",
                                                                pathname === link.href
                                                                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-white/10"
                                                                    : "hover:bg-white/5"
                                                            )}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className={cn(
                                                                        "p-2 rounded-lg",
                                                                        pathname === link.href 
                                                                            ? "bg-gradient-to-r from-blue-500 to-cyan-500"
                                                                            : "bg-gray-800"
                                                                    )}>
                                                                        {link.icon}
                                                                    </div>
                                                                    <span className={cn(
                                                                        "font-medium",
                                                                        pathname === link.href ? "text-white" : "text-gray-300"
                                                                    )}>
                                                                        {link.label}
                                                                    </span>
                                                                </div>
                                                                <ChevronRight className={cn(
                                                                    "w-4 h-4 transition-transform",
                                                                    pathname === link.href ? "text-white" : "text-gray-500 group-hover:text-gray-300 group-hover:translate-x-1"
                                                                )} />
                                                            </div>
                                                        </Link>
                                                    )}
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Для авторизованных пользователей - торговые ссылки */}
                                    {isAuthenticated && (
                                        <>
                                            <div className="px-4 mb-6">
                                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
                                                    Торговля
                                                </h3>
                                                <div className="space-y-1">
                                                    {protectedLinks.map((link, index) => (
                                                        <motion.div
                                                            key={link.id}
                                                            initial={{ opacity: 0, x: 20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: 0.2 + index * 0.05 }}
                                                        >
                                                            <Link
                                                                href={link.href}
                                                                onClick={() => setIsMenuOpen(false)}
                                                            >
                                                                <div className={cn(
                                                                    "flex items-center justify-between p-3 rounded-xl transition-all group",
                                                                    pathname === link.href
                                                                        ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-white/10"
                                                                        : "hover:bg-white/5"
                                                                )}>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={cn(
                                                                            "p-2 rounded-lg",
                                                                            pathname === link.href 
                                                                                ? "bg-gradient-to-r from-green-500 to-emerald-500"
                                                                                : "bg-gray-800"
                                                                        )}>
                                                                            {link.icon}
                                                                        </div>
                                                                        <span className={cn(
                                                                            "font-medium",
                                                                            pathname === link.href ? "text-white" : "text-gray-300"
                                                                        )}>
                                                                            {link.label}
                                                                        </span>
                                                                    </div>
                                                                    <ChevronRight className={cn(
                                                                        "w-4 h-4 transition-transform",
                                                                        pathname === link.href ? "text-white" : "text-gray-500 group-hover:text-gray-300 group-hover:translate-x-1"
                                                                    )} />
                                                                </div>
                                                            </Link>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Дополнительные ссылки для пользователя */}
                                            <div className="px-4 mb-6">
                                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
                                                    Аккаунт
                                                </h3>
                                                <div className="space-y-1">
                                                    {userLinks.map((link, index) => (
                                                        <motion.div
                                                            key={link.id}
                                                            initial={{ opacity: 0, x: 20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: 0.3 + index * 0.05 }}
                                                        >
                                                            {link.external ? (
                                                                <a
                                                                    href={link.href}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={() => setIsMenuOpen(false)}
                                                                >
                                                                    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="p-2 rounded-lg bg-gray-800">
                                                                                {link.icon}
                                                                            </div>
                                                                            <span className="font-medium text-gray-300">
                                                                                {link.label}
                                                                            </span>
                                                                        </div>
                                                                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300 group-hover:translate-x-1 transition-transform" />
                                                                    </div>
                                                                </a>
                                                            ) : (
                                                                <Link
                                                                    href={link.href}
                                                                    onClick={() => setIsMenuOpen(false)}
                                                                >
                                                                    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="p-2 rounded-lg bg-gray-800">
                                                                                {link.icon}
                                                                            </div>
                                                                            <span className="font-medium text-gray-300">
                                                                                {link.label}
                                                                            </span>
                                                                        </div>
                                                                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300 group-hover:translate-x-1 transition-transform" />
                                                                    </div>
                                                                </Link>
                                                            )}
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Для неавторизованных - кнопки входа и регистрации */}
                                    {!isAuthenticated && (
                                        <div className="px-4">
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.6 }}
                                                className="p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl border border-white/10 mb-4"
                                            >
                                                <div className="flex items-center gap-3 mb-3">
                                                    <Shield className="w-5 h-5 text-blue-400" />
                                                    <h4 className="font-medium text-white">{t("auth.secureLogin")}</h4>
                                                </div>
                                                <p className="text-sm text-gray-400 mb-4">
                                                    {t("auth.loginToAccessAll")}
                                                </p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Button
                                                        onClick={() => {
                                                            setIsLoginDialogOpen(true);
                                                            setIsMenuOpen(false);
                                                        }}
                                                        variant="outline"
                                                        className="border-gray-700 hover:border-gray-600 hover:bg-gray-900/50 text-white rounded-lg"
                                                    >
                                                        <User className="w-4 h-4 mr-2" />
                                                        {t("auth.login")}
                                                    </Button>
                                                    <Button
                                                        onClick={() => {
                                                            setIsRegisterDialogOpen(true);
                                                            setIsMenuOpen(false);
                                                        }}
                                                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg"
                                                    >
                                                        <LogIn className="w-4 h-4 mr-2" />
                                                        {t("auth.register")}
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        </div>
                                    )}
                                </div>

                                {/* Футер меню */}
                                <div className="p-6 border-t border-white/10">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-gray-500">{t("footer.version")} 1.0.0</span>
                                        <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5">
                                            <Moon className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="flex gap-4">
                                        <Link
                                            href="/privacy"
                                            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            {t("footer.privacy")}
                                        </Link>
                                        <Link
                                            href="/terms"
                                            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            {t("footer.terms")}
                                        </Link>
                                        <Link
                                            href="/support"
                                            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            {t("header.support")}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Диалоговые окна */}
            <LoginDialog
                isOpen={isLoginDialogOpen}
                onClose={() => setIsLoginDialogOpen(false)}
                onSwitchToRegister={() => {
                    setIsLoginDialogOpen(false);
                    setIsRegisterDialogOpen(true);
                }}
            />

            <RegisterDialog
                isOpen={isRegisterDialogOpen}
                onClose={() => setIsRegisterDialogOpen(false)}
                onSwitchToLogin={() => {
                    setIsRegisterDialogOpen(false);
                    setIsLoginDialogOpen(true);
                }}
            />
        </>
    );
};