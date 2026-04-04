'use client';

import React from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ru' : 'en');
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 border border-white/10 hover:border-white/20 transition-all"
      title={language === 'en' ? 'Switch to Russian' : 'Переключить на английский'}
    >
      <Globe className="w-4 h-4 text-gray-400" />
      <span className="text-sm font-medium text-gray-300">
        {language === 'en' ? 'English' : 'Русский'}
      </span>
    </motion.button>
  );
}
