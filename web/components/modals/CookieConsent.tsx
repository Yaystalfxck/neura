"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Cookie } from 'lucide-react';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Проверяем, скрывал ли пользователь баннер
    const hideCookieBanner = localStorage.getItem('hide-cookie-banner');
    
    if (!hideCookieBanner) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAction = (action: 'accept' | 'reject' | 'hide') => {
    if (action === 'hide') {
      // Сохраняем выбор не показывать снова
      localStorage.setItem('hide-cookie-banner', 'true');
    } else {
      localStorage.setItem('cookie-consent', action);
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ duration: 0.3 }}
      className="fixed bottom-4 right-4 z-[100] w-80 bg-gradient-to-br from-gray-900/95 to-black/95 backdrop-blur-sm border border-gray-800 rounded-xl shadow-2xl p-4"
    >
      {/* Кнопка закрытия */}
      <button
        onClick={() => handleAction('hide')}
        className="absolute -top-2 -right-2 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
      >
        <X className="w-3 h-3 text-gray-400" />
      </button>

      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Cookie className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">
            Использование куки
          </h3>
          <p className="text-xs text-gray-400">
            Мы используем куки для работы сайта. Продолжая использовать сайт, вы соглашаетесь с их использованием.
          </p>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button
          onClick={() => handleAction('reject')}
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-8 border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white"
        >
          Отклонить
        </Button>
        <Button
          onClick={() => handleAction('accept')}
          size="sm"
          className="flex-1 text-xs h-8 bg-blue-600 hover:bg-blue-700"
        >
          Принять
        </Button>
      </div>
      
      <div className="mt-3 text-center">
        <button
          onClick={() => handleAction('hide')}
          className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
        >
          Не показывать снова
        </button>
      </div>
    </motion.div>
  );
}