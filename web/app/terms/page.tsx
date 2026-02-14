// app/terms/page.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, FileText, AlertTriangle, CheckCircle, XCircle, Zap, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Animated Background Elements */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 2 }}
        className="fixed top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl -z-10"
      />
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="fixed bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10"
      />


      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 mb-6"
          >
            <Shield className="w-8 h-8 text-blue-400" />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300"
          >
            Условия пользования
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto"
          >
            Правила использования платформы Neura
          </motion.p>
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-12">
          {/* Section 1 */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-blue-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold">1. Общие положения</h2>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="space-y-4 text-gray-300"
            >
              <p>
                Используя платформу Neura, вы подтверждаете, что прочитали, поняли и соглашаетесь соблюдать 
                настоящие Условия пользования. Мы оставляем за собой право изменять эти условия в любое время.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-lg bg-gray-900/50 border border-gray-800"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="font-semibold">Разрешено</span>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>• Использование сервиса для личного трейдинга</li>
                    <li>• Получение и применение торговых сигналов</li>
                    <li>• Техническая аналитика и обучение</li>
                  </ul>
                </motion.div>
                
                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-lg bg-gray-900/50 border border-gray-800"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span className="font-semibold">Запрещено</span>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>• Перепродажа сигналов третьим лицам</li>
                    <li>• Использование ботов для обхода ограничений</li>
                    <li>• Мошеннические действия на платформе</li>
                  </ul>
                </motion.div>
              </div>
            </motion.div>
          </motion.section>

          {/* Section 2 */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-purple-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold">2. Использование сервиса</h2>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="space-y-6 text-gray-300"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-lg bg-gray-900/50 border border-gray-800"
                >
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Требования к пользователям
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>• Возраст от 18 лет</li>
                    <li>• Верифицированный аккаунт</li>
                    <li>• Согласие с условиями</li>
                    <li>• Наличие торгового счёта</li>
                  </ul>
                </motion.div>
                
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-lg bg-gray-900/50 border border-gray-800"
                >
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    Ограничения
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>• 1 аккаунт на пользователя</li>
                    <li>• Запрет на автоматический парсинг</li>
                    <li>• Ограничение по частоте запросов</li>
                    <li>• Соблюдение законодательства</li>
                  </ul>
                </motion.div>
              </div>
            </motion.div>
          </motion.section>

          {/* Section 3 */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-green-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30">
                <Users className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold">3. Ответственность</h2>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="space-y-4 text-gray-300"
            >
              <p>
                Neura предоставляет аналитические инструменты и сигналы, но не гарантирует прибыль. 
                Вы несёте полную ответственность за свои торговые решения.
              </p>
              
              <motion.div
                animate={{ 
                  boxShadow: [
                    "0 0 0px rgba(239, 68, 68, 0)",
                    "0 0 20px rgba(239, 68, 68, 0.3)",
                    "0 0 0px rgba(239, 68, 68, 0)"
                  ]
                }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="p-4 rounded-lg bg-red-900/20 border border-red-800/50 mt-6"
              >
                <h4 className="font-semibold text-red-300 mb-2">Важное предупреждение</h4>
                <p className="text-sm text-red-200/80">
                  Торговля на финансовых рынках связана с риском потери средств. Используйте только 
                  те средства, которые готовы потерять. Прошлые результаты не гарантируют будущих.
                </p>
              </motion.div>
            </motion.div>
          </motion.section>

          {/* Section 4 */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-yellow-500/30 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
                <Lock className="w-6 h-6 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold">4. Конфиденциальность</h2>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="space-y-4 text-gray-300"
            >
              <p>
                Мы защищаем ваши данные в соответствии с нашей Политикой конфиденциальности. 
                Подробнее о том, как мы обрабатываем информацию, вы можете узнать на соответствующей странице.
              </p>
              
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-900/50 border border-gray-800 mt-6"
              >
                <div>
                  <h4 className="font-semibold">Политика конфиденциальности</h4>
                  <p className="text-sm text-gray-400 mt-1">Узнайте больше о защите ваших данных</p>
                </div>
                <motion.div
                  whileHover={{ x: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link href="/privacy">
                    <Button 
                      variant="outline" 
                      className="border-gray-700 hover:border-blue-500 hover:bg-blue-900/20"
                    >
                      Подробнее
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.section>
        </div>

        {/* Acceptance Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="mt-16 text-center"
        >
          <motion.p
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-gray-400 mb-6"
          >
            Продолжая использование платформы, вы соглашаетесь с условиями
          </motion.p>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href="/">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-12 py-6 rounded-xl"
              >
                Вернуться на главную
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </main>

    
    </div>
  );
}