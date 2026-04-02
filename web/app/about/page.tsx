// app/about/page.tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Zap,
  ChartLine,
  Users,
  User,
  Shield,
  TrendingUp,
  Target,
  BarChart3,
  Clock,
  Globe,
  ArrowRight,
  Headphones,
  Smartphone,
  MessageCircle,
  Award,
  Rocket
} from "lucide-react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { LoginDialog } from "@/components/modals/LoginDialog";
import { RegisterDialog } from "@/components/modals/RegisterDialog";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function AboutPage() {
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);

  const handleOpenLogin = () => setIsLoginDialogOpen(true);
  const handleOpenRegister = () => setIsRegisterDialogOpen(true);

  const teamMembers = [
    {
      name: t("about.member1Name"),
      role: t("about.member1Role"),
      experience: t("about.member1Desc"),
      description: t("about.member1Spec"),
      icon: <BarChart3 className="w-6 h-6" />
    },
    {
      name: t("about.member2Name"),
      role: t("about.member2Role"),
      experience: t("about.member2Desc"),
      description: t("about.member2Spec"),
      icon: <Brain className="w-6 h-6" />
    },
    {
      name: t("about.member3Name"),
      role: t("about.member3Role"),
      experience: t("about.member3Desc"),
      description: t("about.member3Spec"),
      icon: <Shield className="w-6 h-6" />
    }
  ];

  const features = [
    {
      icon: <Brain className="w-10 h-10" />,
      title: t("about.feature1Title"),
      description: t("about.feature1Desc"),
      color: "blue"
    },
    {
      icon: <Zap className="w-10 h-10" />,
      title: t("about.feature2Title"),
      description: t("about.feature2Desc"),
      color: "purple"
    },
    {
      icon: <ChartLine className="w-10 h-10" />,
      title: t("about.feature3Title"),
      description: t("about.feature3Desc"),
      color: "green"
    }
  ];

  const stats = [
    { value: "98.7%", label: t("about.signalAccuracy"), icon: <Target className="w-8 h-8" />, color: "green" },
    { value: "10K+", label: t("about.usersCount"), icon: <Users className="w-8 h-8" />, color: "blue" },
    { value: "24/7", label: t("about.systemUptime"), icon: <Clock className="w-8 h-8" />, color: "purple" },
    { value: "45%", label: t("about.averageReturn"), icon: <TrendingUp className="w-8 h-8" />, color: "yellow" }
  ];

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
              {t("about.title")}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-2"
            >
              <p className="text-xl md:text-2xl lg:text-3xl text-gray-300 font-light">
                {t("about.subtitle")}
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

          {/* Статистика */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 max-w-4xl mx-auto shadow-xl"
          >
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-200"
            >
              {t("aboutExtended.achievements")}
            </motion.h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  className="text-center p-6 bg-gradient-to-br from-gray-900/50 to-black/50 rounded-xl border border-white/10 hover:border-blue-500/30 transition-all cursor-pointer"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-full mb-4">
                    {stat.icon}
                  </div>
                  <div className={`text-4xl md:text-5xl font-bold text-${stat.color}-400 mb-3`}>
                    {stat.value}
                  </div>
                  <div className="text-gray-300 text-lg">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Mission Section */}
      <AnimatedSection>
        <div className="container mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-10"
          >
            {t("aboutExtended.provenSolutions")}
          </motion.h2>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 hover:shadow-xl hover:shadow-blue-500/10 transition-all mb-16"
          >
            <div className="space-y-8">
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="text-lg md:text-xl text-gray-300 leading-relaxed"
              >
                {t("about.missionDesc")}
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                className="text-lg md:text-xl text-gray-300 leading-relaxed"
              >
                {t("home.home") === 'Home'
                  ? 'We believe that successful trading is not only about strategy and numbers, but also access to quality information, timely signals, and reliable support.'
                  : 'Мы верим, что успешный трейдинг — это не только стратегия и цифры, но и доступ к качественной информации, своевременным сигналам и надёжной поддержке.'}
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
                className="text-lg md:text-xl text-gray-300 leading-relaxed"
              >
                {t("aboutExtended.aiAnalyzesMarkets")}
              </motion.p>
            </div>
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

          {/* Преимущества */}
          <motion.h3
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-bold text-center mb-12"
          >
            {t("aboutExtended.whyNeura")}
          </motion.h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-xl p-6 text-center hover:border-blue-500/30 transition-all group cursor-pointer"
              >
                <motion.div 
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4 group-hover:bg-blue-500/30 transition-colors"
                >
                  {feature.icon}
                </motion.div>
                <h4 className="text-xl font-semibold mb-3">{feature.title}</h4>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Team Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-gray-900/30">
        <div className="container mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-4"
          >
            {t("about.team")}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-xl text-gray-400 text-center mb-12"
          >
            {t("aboutExtended.teamSubtitle")}
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {teamMembers.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
                className="relative bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-8 hover:shadow-lg hover:shadow-blue-500/20 transition-all overflow-hidden group"
              >
                {/* Анимированный фон для карточки */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 group-hover:opacity-20 transition-opacity"
                />
                
                <div className="relative z-10">
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.1, 1],
                      boxShadow: [
                        "0 0 0px rgba(59, 130, 246, 0)",
                        "0 0 20px rgba(59, 130, 246, 0.5)",
                        "0 0 0px rgba(59, 130, 246, 0)"
                      ]
                    }}
                    transition={{ repeat: Infinity, duration: 3, delay: index * 0.5 }}
                    className="w-20 h-20 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white mb-6 mx-auto"
                  >
                    {member.icon}
                  </motion.div>
                  
                  <h3 className="text-2xl font-bold mb-2 text-center text-blue-400">{member.name}</h3>
                  <div className="text-lg font-semibold text-gray-300 text-center mb-3">{member.role}</div>
                  <div className="text-sm text-blue-300 text-center mb-4">{member.experience}</div>
                  <p className="text-gray-400 text-center text-sm">{member.description}</p>
                </div>
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

          {/* Дополнительные преимущества */}
          <div className="max-w-4xl mx-auto">
            <motion.h3
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-2xl md:text-3xl font-bold text-center mb-12"
            >
              {t("aboutExtended.whatDistinguishes")}
            </motion.h3>

            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:shadow-xl hover:shadow-blue-500/10 transition-all"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  {
                    icon: <Award className="w-8 h-8 text-yellow-400" />,
                    title: t("about.provenResultsTitle"),
                    desc: t("about.provenResultsDesc2"),
                    color: "yellow"
                  },
                  {
                    icon: <Headphones className="w-8 h-8 text-green-400" />,
                    title: t("about.support247"),
                    desc: t("about.support247Desc"),
                    color: "green"
                  },
                  {
                    icon: <Smartphone className="w-8 h-8 text-blue-400" />,
                    title: t("about.multiplatform"),
                    desc: t("about.multiplatformDesc"),
                    color: "blue"
                  },
                  {
                    icon: <MessageCircle className="w-8 h-8 text-purple-400" />,
                    title: t("about.traderCommunity"),
                    desc: t("about.traderCommunityDesc"),
                    color: "purple"
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    className="bg-gray-900/50 rounded-xl p-6 border border-white/10 hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {item.icon}
                      <h5 className="font-semibold text-lg">{item.title}</h5>
                    </div>
                    <p className="text-gray-400 text-sm">
                      {item.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <AnimatedSection>
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
              {t("aboutExtended.startEarningToday")}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto relative z-10"
            >
              {t("aboutExtended.joinThousands")}
            </motion.p>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative z-10"
            >
              {!isAuthenticated && !user ? (
                <Button
                  size="lg"
                  onClick={handleOpenRegister}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-12 py-6 text-lg rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/30"
                >
                  {t("aboutExtended.startFreeTrial")} <Rocket className="ml-2" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => router.push("/Signals")}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-12 py-6 text-lg rounded-xl font-semibold transition-all shadow-lg shadow-green-500/30"
                >
                  {t("header.getSignal")} <Zap className="ml-2" />
                </Button>
              )}
            </motion.div>
          </motion.div>
        </div>
      </AnimatedSection>

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