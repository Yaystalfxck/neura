"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Users, Clock, Target, ChevronRight, Download, Share2, Pause, Home } from "lucide-react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { LoginDialog } from "@/components/modals/LoginDialog";
import { RegisterDialog } from "@/components/modals/RegisterDialog";

export default function GuidePage() {
  const router = useRouter();
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(930); // 15:30 в секундах
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Обработчик времени видео
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Установка продолжительности видео
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 930);
      setIsVideoLoaded(true);
    }
  }, []);

  // Воспроизведение/пауза видео с правильной обработкой промисов
  const handlePlayVideo = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (videoRef.current.paused) {
        // Отменить предыдущий промис если есть
        if (playPromiseRef.current) {
          playPromiseRef.current.catch(() => {});
          playPromiseRef.current = null;
        }

        // Сбросить время если видео закончилось
        if (videoRef.current.currentTime >= videoRef.current.duration) {
          videoRef.current.currentTime = 0;
        }
        
        playPromiseRef.current = videoRef.current.play();
        
        if (playPromiseRef.current !== undefined) {
          await playPromiseRef.current;
          setIsPlaying(true);
          playPromiseRef.current = null;
        }
      } else {
        // Если есть активный промис, ждем его завершения
        if (playPromiseRef.current) {
          try {
            await playPromiseRef.current;
          } catch (err) {
            // Игнорируем ошибки от прерванного воспроизведения
          }
          playPromiseRef.current = null;
        }
        
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error("Ошибка воспроизведения видео:", error);
      setIsPlaying(false);
      playPromiseRef.current = null;
      
      // Показать сообщение пользователю
      toast.error("Не удалось воспроизвести видео", {
        description: "Попробуйте обновить страницу или использовать другой браузер",
      });
    }
  }, []);

  // Клик по прогресс-бару
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && videoRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const clickValue = (x / width) * duration;
      
      // Если видео воспроизводится, сначала приостановим промис
      if (!videoRef.current.paused && playPromiseRef.current) {
        playPromiseRef.current.catch(() => {});
        playPromiseRef.current = null;
      }
      
      videoRef.current.currentTime = clickValue;
      setCurrentTime(clickValue);
    }
  };

  // Форматирование времени
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Расчет прогресса
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Скачать видео
  const handleDownload = () => {
    // Используем абсолютный путь к видео в папке public
    const videoUrl = "/videos/guide.mp4";
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = "neura-guide.mp4";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Видео-руководство добавлено в загрузки", {
      description: "Файл: neura-guide.mp4",
    });
  };

  // Поделиться видео
  const handleShare = async () => {
    const shareData = {
      title: "Neura - Полное руководство",
      text: "Посмотрите полное руководство по работе с платформой Neura",
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Ошибка при использовании Web Share API:', err);
      }
    } else {
      // Копировать ссылку в буфер обмена
      navigator.clipboard.writeText(window.location.href);
      toast.success("Ссылка скопирована в буфер обмена", {
        description: "Поделитесь ею с друзьями",
      });
    }
  };

  // Навигация на главную
  const handleGoHome = () => {
    router.push("/");
  };

  // Открыть регистрацию
  const handleOpenRegister = () => {
    setIsRegisterDialogOpen(true);
  };

  // Открыть авторизацию
  const handleOpenLogin = () => {
    setIsLoginDialogOpen(true);
  };

  // Инициализация видео с учетом Strict Mode
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    let isMounted = true;

    // Функция для обработки готовности видео
    const handleCanPlay = () => {
      if (isMounted) {
        setIsVideoLoaded(true);
      }
    };

    // Обработчик окончания видео
    const handleEnded = () => {
      if (isMounted) {
        setIsPlaying(false);
      }
    };

    // Обработчик паузы
    const handlePause = () => {
      if (isMounted) {
        setIsPlaying(false);
      }
    };

    // Обработчик воспроизведения
    const handlePlay = () => {
      if (isMounted) {
        setIsPlaying(true);
      }
    };

    // Добавляем обработчики событий
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('ended', handleEnded);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('play', handlePlay);

    // Принудительно загружаем видео
    videoElement.load();

    // Очистка при размонтировании
    return () => {
      isMounted = false;
      
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('ended', handleEnded);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('play', handlePlay);
      
      // Останавливаем видео при размонтировании
      if (!videoElement.paused) {
        videoElement.pause();
      }
      
      // Отменяем промис воспроизведения
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {});
        playPromiseRef.current = null;
      }
    };
  }, [handleLoadedMetadata, handleTimeUpdate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        {/* Анимированные фоновые элементы */}
        <motion.div 
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.3, scale: 1 }}
          transition={{ duration: 2 }}
          className="absolute top-20 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.2, scale: 1 }}
          transition={{ duration: 2, delay: 0.3 }}
          className="absolute bottom-10 right-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"
        />

        <div className="container mx-auto max-w-6xl relative z-10">
          {/* Заголовок */}
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <motion.h1 
              animate={{ 
                textShadow: [
                  "0 0 20px rgba(59, 130, 246, 0.5)",
                  "0 0 40px rgba(59, 130, 246, 0.8)",
                  "0 0 20px rgba(59, 130, 246, 0.5)"
                ]
              }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tighter bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
            >
              Guide
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto"
            >
              Полное руководство по работе с платформой Neura. 
              Изучите все возможности за считанные минуты.
            </motion.p>
          </motion.div>

          {/* Кнопки */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-col sm:flex-row justify-center items-center gap-6 mb-20"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                size="lg" 
                onClick={handleOpenRegister}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-10 py-6 text-lg rounded-xl font-semibold shadow-lg shadow-blue-500/30"
              >
                Регистрация <ArrowRight className="ml-2" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                size="lg" 
                variant="outline"
                onClick={handleGoHome}
                className="border-2 border-white/50 hover:border-white hover:bg-white/10 px-10 py-6 text-lg rounded-xl font-semibold backdrop-blur-sm"
              >
                <Home className="mr-2" />
                На главную
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Video Section */}
      <AnimatedSection>
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, margin: "-100px" }}
            className="relative group"
          >
            {/* Основной видео-контейнер */}
            <motion.div 
              whileHover={{ boxShadow: "0 40px 80px rgba(59, 130, 246, 0.3)" }}
              className="bg-gradient-to-br from-gray-900/50 via-black/50 to-gray-900/50 border-2 border-white/10 rounded-2xl p-4 md:p-8 overflow-hidden"
            >
              {/* Видео контейнер */}
              <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl overflow-hidden">
                {/* Видео элемент */}
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover ${isVideoLoaded ? 'block' : 'hidden'}`}
                  poster="/video-poster.jpg"
                  controls={false}
                  preload="metadata"
                  playsInline
                  muted={false}
                >
                  <source src="/videos/guide.mp4" type="video/mp4" />
                  Ваш браузер не поддерживает видео.
                </video>

                {/* Кнопка воспроизведения поверх видео */}
                {(!isPlaying || !isVideoLoaded) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0.7 }}
                      whileHover={{ opacity: 1 }}
                      className="text-center"
                    >
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handlePlayVideo();
                        }}
                        className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-6 shadow-2xl shadow-blue-500/50"
                      >
                        {isPlaying ? (
                          <Pause className="w-12 h-12 md:w-16 md:h-16" fill="white" />
                        ) : (
                          <Play className="w-12 h-12 md:w-16 md:h-16 ml-2" fill="white" />
                        )}
                      </motion.button>
                      <p className="text-xl text-gray-300 font-medium">
                        {isPlaying ? "Пауза" : "Нажмите для воспроизведения"}
                      </p>
                      <p className="text-gray-500 text-sm mt-2">Длительность: 15:30</p>
                    </motion.div>
                  </div>
                )}

                {/* Кнопка паузы при воспроизведении */}
                {isPlaying && isVideoLoaded && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ opacity: 1, scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePlayVideo();
                    }}
                    className="absolute top-4 right-4 w-12 h-12 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-black/70 transition-colors"
                  >
                    <Pause className="w-6 h-6" fill="white" />
                  </motion.button>
                )}
              </div>

              {/* Видео информация */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="mt-6"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Полное руководство по Neura</h3>
                    <div className="flex items-center gap-4 text-gray-400">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                      <span>•</span>
                      <span>Опубликовано: 13 января 2026</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleDownload}
                      className="p-3 bg-gray-800/50 rounded-lg hover:bg-blue-600/30 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      <span className="hidden sm:inline">Скачать</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleShare}
                      className="p-3 bg-gray-800/50 rounded-lg hover:bg-purple-600/30 transition-colors flex items-center gap-2"
                    >
                      <Share2 className="w-5 h-5" />
                      <span className="hidden sm:inline">Поделиться</span>
                    </motion.button>
                  </div>
                </div>

                {/* Прогресс-бар */}
                <div className="mt-6" ref={progressRef} onClick={handleProgressClick}>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden cursor-pointer">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.1 }}
                      className="h-full bg-gradient-to-r from-blue-600 to-purple-600 relative"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute right-0 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg"
                      />
                    </motion.div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 mt-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Описание видео */}
              <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                className="mt-8 pt-8 border-t border-gray-800"
              >
                <h4 className="text-xl font-bold mb-4">Что вы узнаете из этого видео:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    "Регистрация и настройка аккаунта",
                    "Навигация по интерфейсу платформы",
                    "Использование сигналов и индикаторов",
                    "Управление рисками и настройка стоп-лоссов",
                    "Анализ графиков в реальном времени",
                    "Экспорт данных и генерация отчетов"
                  ].map((item, index) => (
                    <motion.div
                      key={item}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      whileHover={{ x: 5 }}
                      className="flex items-center gap-3 text-gray-300"
                    >
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center"
                      >
                        <ChevronRight className="w-3 h-3 text-blue-400" />
                      </motion.div>
                      {item}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Декоративные элементы вокруг видео */}
            <motion.div
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                scale: { duration: 2, repeat: Infinity }
              }}
              className="absolute -top-4 -left-4 w-8 h-8 border-t-2 border-l-2 border-blue-400/50 rounded-tl-xl"
            />
            <motion.div
              animate={{ 
                rotate: -360,
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                scale: { duration: 2, repeat: Infinity, delay: 1 }
              }}
              className="absolute -bottom-4 -right-4 w-8 h-8 border-b-2 border-r-2 border-purple-400/50 rounded-br-xl"
            />
          </motion.div>
        </div>
      </AnimatedSection>

      {/* Дополнительные инструкции */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-gray-900/30">
        <div className="container mx-auto max-w-6xl">
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-4"
          >
            ПОШАГОВОЕ <span className="text-blue-400">РУКОВОДСТВО</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-xl text-gray-400 text-center mb-12"
          >
            Изучите платформу от А до Я
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { 
                number: "01", 
                title: "Регистрация", 
                steps: [
                  "Перейдите на главную страницу",
                  "Нажмите кнопку 'Регистрация'",
                  "Заполните форму данными",
                  "Подтвердите email"
                ] 
              },
              { 
                number: "02", 
                title: "Настройка", 
                steps: [
                  "Заполните профиль",
                  "Настройте уведомления",
                  "Выберите валютные пары",
                  "Установите таймфреймы"
                ] 
              },
              { 
                number: "03", 
                title: "Торговля", 
                steps: [
                  "Изучите сигналы",
                  "Проанализируйте графики",
                  "Установите стоп-лосс",
                  "Откройте первую сделку"
                ] 
              },
              { 
                number: "04", 
                title: "Анализ", 
                steps: [
                  "Следите за статистикой",
                  "Корректируйте стратегию",
                  "Используйте индикаторы",
                  "Ведите дневник"
                ] 
              },
              { 
                number: "05", 
                title: "Оптимизация", 
                steps: [
                  "Анализируйте результаты",
                  "Тестируйте стратегии",
                  "Используйте риск-менеджмент",
                  "Автоматизируйте процессы"
                ] 
              },
              { 
                number: "06", 
                title: "Поддержка", 
                steps: [
                  "Читайте FAQ",
                  "Используйте чат",
                  "Посещайте вебинары",
                  "Оставляйте отзывы"
                ] 
              },
            ].map((section, index) => (
              <motion.div
                key={section.number}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ 
                  y: -10, 
                  boxShadow: "0 20px 40px rgba(59, 130, 246, 0.2)" 
                }}
                className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-2xl p-6 hover:border-blue-500/30 transition-all"
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
                  transition={{ repeat: Infinity, duration: 3, delay: index * 0.5 }}
                  className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-xl font-bold mb-4"
                >
                  {section.number}
                </motion.div>
                
                <h3 className="text-xl font-bold mb-4 text-blue-400">{section.title}</h3>
                
                <ul className="space-y-3">
                  {section.steps.map((step, stepIndex) => (
                    <motion.li
                      key={stepIndex}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: stepIndex * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-center gap-3 text-gray-300 text-sm"
                    >
                      <motion.div
                        whileHover={{ rotate: 90 }}
                        className="w-2 h-2 bg-blue-400 rounded-full"
                      />
                      {step}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <AnimatedSection>
        <div className="container mx-auto max-w-4xl px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 border border-white/10 rounded-2xl p-8 md:p-12 text-center relative overflow-hidden"
          >
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
              Готовы начать обучение?
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto relative z-10"
            >
              Посмотрите полное видео-руководство и станьте экспертом в использовании Neura уже сегодня!
            </motion.p>
            
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative z-10 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button 
                size="lg"
                onClick={(e) => {
                  e.preventDefault();
                  handlePlayVideo();
                }}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-6 text-lg rounded-xl font-semibold shadow-lg shadow-blue-500/30"
              >
                {isPlaying ? <Pause className="mr-2" /> : <Play className="mr-2" />}
                {isPlaying ? "Пауза" : "Смотреть руководство"}
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={handleOpenRegister}
                className="border-2 border-white/50 hover:border-white hover:bg-white/10 px-8 py-6 text-lg rounded-xl font-semibold backdrop-blur-sm"
              >
                Регистрация
              </Button>
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
      className="py-20"
    >
      {children}
    </motion.section>
  );
}