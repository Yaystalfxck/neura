"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, Activity, TrendingUp, BarChart3, Cpu, Globe, Target, ArrowRight, Search, Radar, Scan, Waves, Sparkles } from 'lucide-react';

interface SignalLoadingAnimationProps {
  market: string;
  timeframe: string;
  aiType: string;
}

const analysisSteps = [
  { icon: Brain, text: "Запуск нейронной сети...", textEn: "Initializing neural network..." },
  { icon: Zap, text: "Анализ рыночных данных...", textEn: "Analyzing market data..." },
  { icon: Activity, text: "Расчет индикаторов...", textEn: "Calculating indicators..." },
  { icon: TrendingUp, text: "Определение тренда...", textEn: "Detecting trends..." },
  { icon: BarChart3, text: "Анализ объемов...", textEn: "Analyzing volumes..." },
  { icon: Target, text: "Поиск точек входа...", textEn: "Finding entry points..." },
  { icon: Cpu, text: "Обработка ML модели...", textEn: "Processing ML model..." },
  { icon: Globe, text: "Сканирование рынка...", textEn: "Scanning markets..." },
  { icon: Radar, text: "Обнаружение паттернов...", textEn: "Detecting patterns..." },
  { icon: Scan, text: "Верификация сигнала...", textEn: "Verifying signal..." },
];

export const SignalLoadingAnimation: React.FC<SignalLoadingAnimationProps> = ({
  market,
  timeframe,
  aiType
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; speed: number }>>([]);
  const [waveOffset, setWaveOffset] = useState(0);

  // Генерация частиц
  useEffect(() => {
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      speed: Math.random() * 2 + 1,
    }));
    setParticles(newParticles);
  }, []);

  // Анимация шагов анализа
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % analysisSteps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Анимация волны
  useEffect(() => {
    const interval = setInterval(() => {
      setWaveOffset((prev) => prev + 0.1);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = analysisSteps[currentStep].icon;

  return (
    <div className="relative overflow-hidden">
      {/* Фоновые частицы */}
      <div className="absolute inset-0">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full bg-blue-500/30"
            style={{
              left: `${particle.x}%`,
              width: particle.size,
              height: particle.size,
            }}
            animate={{
              y: [`${particle.y}%`, `${particle.y - 20}%`, `${particle.y}%`],
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: particle.speed * 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Волновой эффект */}
      <div className="absolute inset-0 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute w-full"
            style={{
              bottom: `${20 + i * 15}%`,
              height: 2,
              background: `linear-gradient(90deg, transparent, rgba(59, 130, 246, ${0.3 - i * 0.1}), transparent)`,
            }}
            animate={{
              x: ['-100%', '100%'],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      {/* Центральный контент */}
      <div className="relative z-10 py-8">
        {/* Анимированный круг */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            {/* Внешнее кольцо */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-blue-500/30"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* Среднее кольцо */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-purple-500/40"
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.6, 0, 0.6],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.3,
              }}
            />

            {/* Внутреннее кольцо с вращением */}
            <motion.div
              className="w-32 h-32 rounded-full border-2 border-green-500/50 flex items-center justify-center"
              animate={{
                rotate: 360,
                borderColor: ['rgba(34, 197, 94, 0.5)', 'rgba(59, 130, 246, 0.5)', 'rgba(168, 85, 247, 0.5)', 'rgba(34, 197, 94, 0.5)'],
              }}
              transition={{
                rotate: {
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                },
                borderColor: {
                  duration: 4,
                  repeat: Infinity,
                },
              }}
            >
              {/* Иконка текущего шага */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <CurrentIcon className="w-12 h-12 text-white" />
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Текст текущего шага */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center mb-8"
          >
            <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
              {analysisSteps[currentStep].text}
            </h3>
            <p className="text-gray-400 text-sm">
              {analysisSteps[currentStep].textEn}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Индикатор прогресса */}
        <div className="flex justify-center gap-2 mb-6">
          {analysisSteps.map((_, i) => (
            <motion.div
              key={i}
              className="w-8 h-1 rounded-full"
              animate={{
                backgroundColor: i <= currentStep ? 'rgba(59, 130, 246, 0.8)' : 'rgba(55, 65, 81, 0.5)',
                scale: i === currentStep ? 1.2 : 1,
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {/* Параметры анализа */}
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
          <motion.div
            className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700"
            animate={{
              borderColor: currentStep % 3 === 0 ? 'rgba(59, 130, 246, 0.5)' : 'rgba(55, 65, 81, 0.5)',
            }}
          >
            <div className="text-xs text-gray-400 mb-1">Рынок</div>
            <div className="font-semibold text-sm">{market === 'otc' ? 'OTC' : market === 'demo' ? 'Demo' : 'Market'}</div>
          </motion.div>
          <motion.div
            className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700"
            animate={{
              borderColor: currentStep % 3 === 1 ? 'rgba(168, 85, 247, 0.5)' : 'rgba(55, 65, 81, 0.5)',
            }}
          >
            <div className="text-xs text-gray-400 mb-1">Таймфрейм</div>
            <div className="font-semibold text-sm">{timeframe} мин</div>
          </motion.div>
          <motion.div
            className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700"
            animate={{
              borderColor: currentStep % 3 === 2 ? 'rgba(34, 197, 94, 0.5)' : 'rgba(55, 65, 81, 0.5)',
            }}
          >
            <div className="text-xs text-gray-400 mb-1">AI Модель</div>
            <div className="font-semibold text-sm">{aiType.replace('_ai', '').toUpperCase()}</div>
          </motion.div>
        </div>

        {/* Анимированные линии сканирования */}
        <div className="relative h-16 max-w-md mx-auto overflow-hidden">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-full h-px"
              style={{
                top: `${i * 33}%`,
                background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.6), transparent)',
              }}
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
                delay: i * 0.3,
              }}
            />
          ))}
          
          {/* Пульсирующие точки */}
          <div className="absolute inset-0 flex items-center justify-center">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-blue-500 rounded-full"
                style={{
                  left: `${20 + i * 15}%`,
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  backgroundColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(168, 85, 247, 1)',
                    'rgba(34, 197, 94, 1)',
                  ],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </div>

        {/* Нижний текст */}
        <div className="text-center mt-8">
          <motion.p
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
            className="text-sm text-gray-400"
          >
            🔍 Анализ рынков в реальном времени...
          </motion.p>
        </div>
      </div>
    </div>
  );
};
