"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle,
  Home,
  Search,
  RefreshCw,
  Brain,
  Satellite,
  Zap,
  ArrowRight,
  Sparkles,
  Navigation,
  Map,
  Compass
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();
  const [particles, setParticles] = useState<Array<{x: number, y: number, size: number}>>([]);
  const [isHovered, setIsHovered] = useState<string | null>(null);

  // Создаем частицы для фона
  useEffect(() => {
    const newParticles = [];
    for (let i = 0; i < 50; i++) {
      newParticles.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1
      });
    }
    setParticles(newParticles);
  }, []);

  // Анимация для основных действий
  const actionButtons = [
    {
      id: "home",
      icon: Home,
      title: "На главную",
      description: "Вернуться на главную страницу",
      color: "from-blue-500/20 to-cyan-500/20",
      textColor: "text-blue-400",
      hoverColor: "hover:border-blue-500/50 hover:bg-blue-500/10",
      path: "/"
    },
    {
      id: "search",
      icon: Search,
      title: "Поиск сигналов",
      description: "Найти торговые сигналы",
      color: "from-green-500/20 to-emerald-500/20",
      textColor: "text-green-400",
      hoverColor: "hover:border-green-500/50 hover:bg-green-500/10",
      path: "/Signals"
    },
    {
      id: "refresh",
      icon: RefreshCw,
      title: "Обновить",
      description: "Обновить текущую страницу",
      color: "from-purple-500/20 to-pink-500/20",
      textColor: "text-purple-400",
      hoverColor: "hover:border-purple-500/50 hover:bg-purple-500/10",
      action: () => window.location.reload()
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white overflow-hidden relative">
      {/* Анимированные частицы на фоне */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-blue-500/20"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.2, 0.5, 0.2]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          />
        ))}
      </div>

      {/* Большие анимированные фоновые элементы */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 2 }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
      />
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
      />

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="max-w-6xl mx-auto">
          
          

          {/* Основной контент */}
          <div className="text-center mb-20">
            {/* Анимация иконки ошибки */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -180 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ 
                duration: 0.8, 
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
              className="inline-block mb-12"
            >
              <div className="relative">
                {/* Внешнее свечение */}
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3]
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 2,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-red-500/30 to-orange-500/30 blur-2xl rounded-full"
                />
                
                {/* Среднее свечение */}
                <motion.div 
                  animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.4, 0.6, 0.4]
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 2,
                    delay: 0.2,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-4 bg-gradient-to-r from-red-500/40 to-orange-500/40 blur-xl rounded-full"
                />
                
                {/* Основная иконка */}
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="relative bg-gradient-to-br from-red-500/30 to-orange-500/30 border border-red-500/40 rounded-full p-12 shadow-2xl"
                >
                  <AlertTriangle className="w-32 h-32 text-red-400" />
                </motion.div>
              </div>
            </motion.div>

            {/* Текст ошибки */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <motion.h1 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ 
                  duration: 0.5, 
                  type: "spring",
                  stiffness: 200
                }}
                className="text-8xl md:text-9xl font-bold mb-6 bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent"
              >
                404
              </motion.h1>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  Страница не найдена
                </h2>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
                  Кажется, мы потеряли эту страницу в космическом пространстве. 
                  Но не волнуйтесь, у нас есть другие пути!
                </p>
              </motion.div>

              {/* Анимация спутника */}
              <motion.div
                animate={{ 
                  x: [-100, 100, -100],
                  rotate: [0, 180, 360]
                }}
                transition={{ 
                  duration: 8,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="inline-block mb-10"
              >
                <Satellite className="w-20 h-20 text-blue-400" />
              </motion.div>
            </motion.div>
          </div>

          {/* Карточки с вариантами действий */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {actionButtons.map((action, index) => (
              <motion.div
                key={action.id}
                initial={{ y: 50, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ 
                  duration: 0.5, 
                  delay: 0.7 + index * 0.1,
                  type: "spring",
                  stiffness: 100
                }}
                whileHover={{ y: -10 }}
                onHoverStart={() => setIsHovered(action.id)}
                onHoverEnd={() => setIsHovered(null)}
              >
                {action.path ? (
                  <Link href={action.path}>
                    <div className={`bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 transition-all duration-300 cursor-pointer h-full ${action.hoverColor} group`}>
                      <div className="flex items-center gap-4 mb-6">
                        <motion.div 
                          animate={isHovered === action.id ? { scale: 1.2, rotate: 360 } : {}}
                          transition={{ duration: 0.5 }}
                          className={`p-4 ${action.color} rounded-xl`}
                        >
                          <action.icon className={`w-8 h-8 ${action.textColor}`} />
                        </motion.div>
                        <h3 className="text-2xl font-bold">{action.title}</h3>
                      </div>
                      <p className="text-gray-400 mb-6">
                        {action.description}
                      </p>
                      <div className={`font-medium flex items-center gap-2 ${action.textColor}`}>
                        Перейти 
                        <motion.span
                          animate={isHovered === action.id ? { x: 5 } : { x: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </motion.span>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <Button
                    onClick={action.action}
                    className={`w-full bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 transition-all duration-300 h-full flex flex-col items-start justify-start ${action.hoverColor} group`}
                    variant="ghost"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <motion.div 
                        animate={isHovered === action.id ? { scale: 1.2, rotate: 180 } : {}}
                        transition={{ duration: 0.5 }}
                        className={`p-4 ${action.color} rounded-xl`}
                      >
                        <action.icon className={`w-8 h-8 ${action.textColor}`} />
                      </motion.div>
                      <h3 className="text-2xl font-bold">{action.title}</h3>
                    </div>
                    <p className="text-gray-400 mb-6 text-left">
                      {action.description}
                    </p>
                    <div className={`font-medium flex items-center gap-2 ${action.textColor}`}>
                      Обновить 
                      <motion.span
                        animate={isHovered === action.id ? { rotate: 180 } : { rotate: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </motion.span>
                    </div>
                  </Button>
                )}
              </motion.div>
            ))}
          </div>

          {/* Дополнительная помощь */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="bg-gradient-to-r from-gray-900/50 to-black/50 border border-white/10 rounded-2xl p-8 md:p-12 backdrop-blur-sm"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-left">
                <div className="flex items-center gap-3 mb-4">
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ repeat: Infinity, duration: 4 }}
                  >
                    <Compass className="w-8 h-8 text-yellow-400" />
                  </motion.div>
                  <h3 className="text-2xl font-bold">Заблудились в навигации?</h3>
                </div>
                <p className="text-gray-400">
                  Используйте меню или карту сайта, чтобы найти нужную информацию. 
                  Если проблема повторяется, свяжитесь с нашей службой поддержки.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="outline"
                    className="border-white/20 hover:border-white/40 backdrop-blur-sm"
                    onClick={() => router.push('/support')}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Поддержка
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Анимация внизу */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.5 }}
            className="mt-20 text-center"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                opacity: [0.8, 1, 0.8]
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 3,
                ease: "easeInOut"
              }}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 px-8 py-4 rounded-full border border-white/10 backdrop-blur-sm"
            >
              <Sparkles className="w-5 h-5 text-blue-400" />
              <span className="text-gray-300">AI: Neural Network • Status: Searching...</span>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 2,
                  ease: "linear"
                }}
              >
                <Zap className="w-5 h-5 text-yellow-400" />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      
    </div>
  );
}