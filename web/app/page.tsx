"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Shield, Headphones, BarChart3, Smartphone, Bell, ArrowRight, TrendingUp, Users, Target, Activity, Award, TrendingDown, Lock, CreditCard, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { LoginDialog } from "@/components/modals/LoginDialog";
import { RegisterDialog } from "@/components/modals/RegisterDialog";
import { useAuth } from "@/app/contexts/AuthContext";
import { useLanguage } from "@/app/contexts/LanguageContext";

export default function Home() {
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);

  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const faqItems = [
    {
      question: t("faq.q1"),
      answer: t("faq.a1"),
      icon: <Zap className="w-6 h-6 text-blue-400" />
    },
    {
      question: t("faq.q2"),
      answer: t("faq.a2"),
      icon: <Lock className="w-6 h-6 text-green-400" />
    },
    {
      question: t("faq.q3"),
      answer: t("faq.a3"),
      icon: <Headphones className="w-6 h-6 text-purple-400" />
    },
    {
      question: t("faq.q4"),
      answer: t("faq.a4"),
      icon: <CreditCard className="w-6 h-6 text-yellow-400" />
    },
    {
      question: t("faq.q5"),
      answer: t("faq.a5"),
      icon: <MessageCircle className="w-6 h-6 text-cyan-400" />
    }
  ];

  // Статистика с автоматическим обновлением
  const [stats, setStats] = useState({
    users: 7100,
    successfulSignals: 14423,
    failedSignals: 5000,
    accuracy: 74.2,
    totalSignals: 19423,
    dailyGrowth: 12,
    weeklyGrowth: 8.5,
    monthlyGrowth: 23.7
  });

  // Функция для генерации случайного изменения в пределах допустимого
  const generateRandomChange = (baseValue: number, maxChangePercent: number = 3) => {
    const changePercent = (Math.random() * maxChangePercent * 2) - maxChangePercent; // от -3% до +3%
    const change = baseValue * (changePercent / 100);
    return Math.max(0, baseValue + change);
  };

  // Обновление статистики
  const updateStats = () => {
    setStats(prev => {
      // Плавный рост количества пользователей (всегда положительный)
      const newUsers = prev.users * (1 + (Math.random() * 0.015 + 0.005)); // +0.5% до +2%
      
      // Успешные сигналы растут быстрее неудачных
      const newSuccessful = prev.successfulSignals * (1 + (Math.random() * 0.02 + 0.01)); // +1% до +3%
      const newFailed = prev.failedSignals * (1 + (Math.random() * 0.01)); // 0% до +1%
      
      const newTotal = newSuccessful + newFailed;
      const newAccuracy = (newSuccessful / newTotal) * 100;
      
      // Рост в процентах
      const newDailyGrowth = +(prev.dailyGrowth * (1 + (Math.random() * 0.1 - 0.03))).toFixed(1); // от -3% до +7%
      const newWeeklyGrowth = +(prev.weeklyGrowth * (1 + (Math.random() * 0.08 - 0.02))).toFixed(1); // от -2% до +6%
      const newMonthlyGrowth = +(prev.monthlyGrowth * (1 + (Math.random() * 0.05 - 0.01))).toFixed(1); // от -1% до +4%
      
      return {
        users: Math.round(newUsers),
        successfulSignals: Math.round(newSuccessful),
        failedSignals: Math.round(newFailed),
        accuracy: +newAccuracy.toFixed(1),
        totalSignals: Math.round(newTotal),
        dailyGrowth: Math.max(5, Math.min(25, newDailyGrowth)), // ограничиваем от 5% до 25%
        weeklyGrowth: Math.max(3, Math.min(20, newWeeklyGrowth)), // от 3% до 20%
        monthlyGrowth: Math.max(10, Math.min(45, newMonthlyGrowth)) // от 10% до 45%
      };
    });
  };

  // Эффект для автоматического обновления статистики
  useEffect(() => {
    // Обновляем статистику сразу при загрузке
    updateStats();
    
    // Устанавливаем интервал обновления (каждые 24 часа = 86400000 мс)
    // Для демонстрации используем 30 секунд, но можно изменить на 24 часа
    const interval = setInterval(updateStats, 86400000); // 30 секунд для демо
    
    return () => clearInterval(interval);
  }, []);

  // Форматирование чисел
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const handleOpenLogin = () => setIsLoginDialogOpen(true);
  const handleOpenRegister = () => setIsRegisterDialogOpen(true);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        {/* Фоновые элементы с анимацией */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 2 }}
          className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"
        />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ duration: 2, delay: 0.5 }}
          className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
        />

        <div className="container mx-auto max-w-6xl relative z-10">
          {/* Заголовок и описание */}
          <div className="text-center mb-16">
            <motion.h1 
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-300 to-gray-400"
            >
              Neura
            </motion.h1>
            
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-2"
            >
              <p className="text-xl md:text-2xl lg:text-3xl text-gray-300 font-light">
                {t("home.heroSubtitle1")}
              </p>
              <p className="text-xl md:text-2xl lg:text-3xl text-gray-300 font-light">
                {t("home.heroSubtitle2")}
              </p>
            </motion.div>
          </div>

          {/* Кнопки регистрации и авторизации */}
          {!isAuthenticated && !user && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-24"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  onClick={handleOpenRegister}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-10 py-6 text-lg rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/30"
                >
                  {t("header.register")} <ArrowRight className="ml-2" />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleOpenLogin}
                  className="border-2 border-white/50 hover:border-white hover:bg-white/10 text-white px-10 py-6 text-lg rounded-xl font-semibold transition-all backdrop-blur-sm"
                >
                  {t("header.login")}
                </Button>
              </motion.div>
            </motion.div>
          )}

      

          {/* Статистика с автоматическим обновлением */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 max-w-4xl mx-auto shadow-xl"
          >
            <div className="flex justify-between items-center mb-6">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="text-2xl md:text-3xl font-bold text-gray-200"
              >
                {t("home.platformStats")}
              </motion.h2>
              
              {/* Индикатор обновления */}
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center gap-2 text-sm text-blue-400"
              >
                <Activity className="w-4 h-4" />
                <span>{t("home.updateEvery24h")}</span>
              </motion.div>
            </div>
            
            {/* Основные метрики */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Пользователи */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.9 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="text-center p-6 bg-gradient-to-br from-gray-900/50 to-black/50 rounded-xl border border-white/10 hover:border-blue-500/30 transition-all"
              >
                <Users className="w-12 h-12 mx-auto mb-4 text-blue-400" />
                <div className="text-4xl md:text-5xl font-bold text-blue-400 mb-3">
                  {formatNumber(stats.users)}
                </div>
                <div className="text-gray-300 text-lg mb-2">
                  {t("home.users")}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">+{stats.dailyGrowth}% {t("home.dailyGrowth").toLowerCase()}</span>
                </div>
              </motion.div>

              {/* Успешные сигналы */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 1.0 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="text-center p-6 bg-gradient-to-br from-gray-900/50 to-black/50 rounded-xl border border-white/10 hover:border-green-500/30 transition-all"
              >
                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-green-400" />
                <div className="text-4xl md:text-5xl font-bold text-green-400 mb-3">
                  {formatNumber(stats.successfulSignals)}
                </div>
                <div className="text-gray-300 text-lg mb-2">
                  {t("home.successfulSignals")}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Award className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400">{t("home.accuracy")} {stats.accuracy}%</span>
                </div>
              </motion.div>

              {/* Неудачные сигналы */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 1.1 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="text-center p-6 bg-gradient-to-br from-gray-900/50 to-black/50 rounded-xl border border-white/10 hover:border-red-500/30 transition-all"
              >
                <Target className="w-12 h-12 mx-auto mb-4 text-red-400" />
                <div className="text-4xl md:text-5xl font-bold text-red-400 mb-3">
                  {formatNumber(stats.failedSignals)}
                </div>
                <div className="text-gray-300 text-lg mb-2">
                  {t("home.failedSignals")}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm">
                  <TrendingDown className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">{t("home.totalSignals")}: {formatNumber(stats.totalSignals)}</span>
                </div>
              </motion.div>
            </div>

            {/* Дополнительная информация и рост */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.2 }}
              className="mt-10 pt-8 border-t border-gray-800"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-1">{t("home.weeklyGrowth")}</p>
                  <p className="text-2xl font-bold text-green-400">+{stats.weeklyGrowth}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-1">{t("home.monthlyGrowth")}</p>
                  <p className="text-2xl font-bold text-green-400">+{stats.monthlyGrowth}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-1">{t("home.accuracy")}</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.accuracy}%</p>
                </div>
              </div>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 1.3 }}
                className="text-sm text-gray-500 mt-4 text-center"
              >
                {t("home.dataUpdatedAutomatically")} • {new Date().toLocaleDateString('en-US')}
              </motion.p>
            </motion.div>
          </motion.div>

          {/* Дополнительный декоративный элемент */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.5 }}
            className="mt-24 text-center"
          >
            <motion.p
              animate={{ y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-gray-500 text-sm"
            >
              {t("home.joinCommunity")}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Остальные секции без изменений */}
      {/* Что такое Neura? */}
      <AnimatedSection>
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-10"
          >
            {t("home.whatIsNeura").replace("Neura", "Neura")}
          </motion.h2>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 hover:shadow-xl hover:shadow-blue-500/10 transition-shadow"
          >
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="text-lg md:text-xl text-gray-300 leading-relaxed text-center"
            >
              {t("home.whatIsNeuraDesc")}
            </motion.p>
          </motion.div>

          {/* Разделитель */}
          <motion.div 
            initial={{ width: 0 }}
            whileInView={{ width: "100%" }}
            transition={{ duration: 1 }}
            viewport={{ once: true }}
            className="my-16"
          >
            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          </motion.div>

          {/* Почему выбирают нас? */}
          <motion.h3
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-bold text-center mb-12"
          >
            {t("home.whyChooseUs")}
          </motion.h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: t("features.speed"), desc: t("features.speedDesc"), color: "blue" },
              { icon: Shield, title: t("features.reliability"), desc: t("features.reliabilityDesc"), color: "green" },
              { icon: Headphones, title: t("features.support"), desc: t("features.supportDesc"), color: "purple" },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-xl p-6 text-center hover:border-blue-500/30 transition-all group"
              >
                <motion.div 
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4 group-hover:bg-blue-500/30 transition-colors"
                >
                  <item.icon className={`w-8 h-8 text-${item.color}-400 group-hover:scale-110 transition-transform`} />
                </motion.div>
                <h4 className="text-xl font-semibold mb-3">{item.title}</h4>
                <p className="text-gray-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Как начать? */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-gray-900/30">
        <div className="container mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-4"
          >
            {t("home.howToStart")}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-xl text-gray-400 text-center mb-12"
          >
            {t("home.threeSimpleSteps")}
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {[
              { number: "1", title: t("home.step1"), desc: t("home.step1Desc") },
              { number: "2", title: t("home.step2"), desc: t("home.step2Desc") },
              { number: "3", title: t("home.step3"), desc: t("home.step3Desc") },
            ].map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
                className="relative bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-8 text-center hover:shadow-lg hover:shadow-blue-500/20 transition-all"
              >
                <motion.div 
                  animate={{ 
                    scale: [1, 1.1, 1],
                    boxShadow: [
                      "0 0 0px rgba(59, 130, 246, 0)",
                      "0 0 20px rgba(59, 130, 246, 0.5)",
                      "0 0 0px rgba(59, 130, 246, 0)"
                    ]
                  }}
                  transition={{ repeat: Infinity, duration: 2, delay: index * 0.5 }}
                  className="absolute -top-4 -left-4 w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-xl font-bold"
                >
                  {step.number}
                </motion.div>
                <h3 className="text-2xl font-bold mb-4 text-blue-400">{step.title}</h3>
                <p className="text-gray-400">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Разделитель */}
          <motion.div 
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            transition={{ duration: 1 }}
            viewport={{ once: true }}
            className="my-16 origin-left"
          >
            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          </motion.div>

          {/* Инструменты для трейдера */}
          <div className="max-w-4xl mx-auto">
            <motion.h3
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-2xl md:text-3xl font-bold text-center mb-12"
            >
              {t("home.professionalTools")}
            </motion.h3>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:shadow-xl hover:shadow-blue-500/10 transition-all"
            >
              <div className="flex items-center gap-4 mb-6">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                >
                  <BarChart3 className="w-8 h-8 text-blue-400" />
                </motion.div>
                <h4 className="text-xl font-bold">{t("home.interactiveCharts")}</h4>
              </div>
              <p className="text-gray-300 mb-6">
                {t("home.interactiveChartsDesc")}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                {[
                  { icon: Smartphone, title: t("home.mobileApp"), desc: t("home.mobileAppDesc"), color: "green" },
                  { icon: Bell, title: t("home.signalIndicators"), desc: t("home.signalIndicatorsDesc"), color: "yellow" },
                ].map((tool, index) => (
                  <motion.div
                    key={tool.title}
                    initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    className="bg-gray-900/50 rounded-xl p-6 border border-white/10 hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <tool.icon className={`w-6 h-6 text-${tool.color}-400`} />
                      <h5 className="font-semibold">{tool.title}</h5>
                    </div>
                    <p className="text-gray-400 text-sm">
                      {tool.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <AnimatedSection>
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-12"
          >
            {t("home.faq")}
          </motion.h2>

          <div className="space-y-6">
            {faqItems.map((item, index) => (
              <motion.div
                key={item.question}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group"
              >
                <motion.div 
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-blue-500/30 transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <motion.div 
                      whileHover={{ rotate: 15 }}
                      transition={{ duration: 0.3 }}
                      className="mt-1"
                    >
                      {item.icon}
                    </motion.div>
                    <div className="flex-1">
                      <motion.h4 
                        layout
                        className="text-xl font-semibold mb-3"
                      >
                        {item.question}
                      </motion.h4>
                      <motion.p 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ duration: 0.3 }}
                        className="text-gray-400"
                      >
                        {item.answer}
                      </motion.p>
                    </div>
                  </div>
                </motion.div>
                {index < faqItems.length - 1 && (
                  <motion.div 
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                    viewport={{ once: true }}
                    className="my-6 origin-left"
                  >
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* CTA Footer */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-black">
        <div className="container mx-auto max-w-4xl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 border border-white/10 rounded-2xl p-8 md:p-12 text-center relative overflow-hidden"
          >
            {/* Анимированный фон */}
            <motion.div 
              animate={{ 
                x: ["0%", "100%", "0%"],
                opacity: [0.1, 0.2, 0.1]
              }}
              transition={{ repeat: Infinity, duration: 10 }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
            />

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-bold mb-6 relative z-10"
            >
              {t("home.joinProfessionals")}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto relative z-10"
            >
              {t("home.joinProfessionalsDesc")}
            </motion.p>

            {/* Кнопка в футере */}
            {!isAuthenticated && !user && (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative z-10"
              >
                <Button
                  size="lg"
                  onClick={handleOpenRegister}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-12 py-6 text-lg rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/30"
                >
                  {t("home.startNow")}
                </Button>
              </motion.div>
            )}

            

            {/* Footer */}
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
              className="mt-16 pt-8 border-t border-white/10 relative z-10"
            />
          </motion.div>
        </div>
      </section>

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
    </div>
  );
}

// Компонент для анимированных секций
function AnimatedSection({ children }: { children: React.ReactNode }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="py-20 px-4"
    >
      {children}
    </motion.section>
  );
}