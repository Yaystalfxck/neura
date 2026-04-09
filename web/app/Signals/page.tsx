"use client";
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, Zap, Brain, Clock, Filter, Globe, Cpu, BarChart, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { SignalLoadingAnimation } from '@/components/SignalLoadingAnimation';
import { TradingBackground } from '@/components/TradingBackground';
import { SignalLimitModal } from '@/components/SignalLimitModal';

export default function SignalFound() {
  return (
    <ProtectedRoute>
      <SearchPage/>
    </ProtectedRoute>
  );
}

function SearchPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();

  const [market, setMarket] = useState('otc');
  const [timeframe, setTimeframe] = useState('5');
  const [aiType, setAiType] = useState('neural_ai');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signalsUsed, setSignalsUsed] = useState<number>(0);
  const [signalsLimit, setSignalsLimit] = useState<number>(1);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [nextTierBalance, setNextTierBalance] = useState<number>(25);
  
  // Флаги для предотвращения множественных запросов
  const initialLoadDone = useRef(false);

  // Загрузка лимитов сигналов
  useEffect(() => {
    if (!user) return;
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadSignalLimits();
    }
  }, [user]);

  const loadSignalLimits = async () => {
    try {
      const response = await fetch('/api/user/signal-limits', {
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setSignalsUsed(data.used_today || data.used || 0);
        setSignalsLimit(data.daily_limit || data.limit || 1);
        setNextTierBalance(data.next_limit_balance || data.next_tier_balance || 25);
      }
    } catch (error) {
      console.error('Error loading signal limits:', error);
    }
  };

  const checkSignalAvailability = (): { available: boolean; reason?: string } => {
    // Админ всегда может получать сигналы
    if (user?.role === 'admin') {
      return { available: true };
    }

    // Проверяем лимит сигналов
    if (signalsUsed >= signalsLimit) {
      return { 
        available: false, 
        reason: `Вы исчерпали лимит сигналов на сегодня (${signalsLimit}/${signalsLimit})` 
      };
    }

    return { available: true };
  };

  const handleSearch = async () => {
    // Проверяем доступность сигнала
    const availability = checkSignalAvailability();
    if (!availability.available) {
      // Показываем модальное окно вместо ошибки
      setShowLimitModal(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {

      const response = await fetch('/api/signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          market: market,  // otc, demo, market
          timeframe: parseInt(timeframe),  // Число минут
          strategy: aiType,  // fast_ai, manual_ai, neural_ai
          min_payout: 80,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.detail || result.error || t("signals.findSignalError");
        throw new Error(errorMsg);
      }

      if (result.success) {

        // Обновляем счетчик использованных сигналов
        setSignalsUsed(prev => prev + 1);
        
        // Обновляем баланс из ответа
        if (result.balance !== undefined) {
        }

        // Кодируем сигнал в base64 (с поддержкой Unicode)
        const signalJson = JSON.stringify(result.signal);
        const signalBase64 = btoa(unescape(encodeURIComponent(signalJson)));
        
        const summaryJson = JSON.stringify(result.market_data_summary || {});
        const summaryBase64 = btoa(unescape(encodeURIComponent(summaryJson)));

        const queryString = new URLSearchParams({
          signal: signalBase64,
          market: market,
          timeframe: `${timeframe} минут`,
          ai: aiType,
          summary: summaryBase64
        }).toString();

        router.push(`/signal-found?${queryString}`);
      } else {
        setError(result.error || t("signals.findSignalError"));
      }
    } catch (error) {
      console.error('❌ Ошибка в handleSearch:', error);
      setError(error instanceof Error ? error.message : t("signals.findSignalError"));
    } finally {
      setIsLoading(false);
    }
  };

  const markets = [
    {
      value: 'otc',
      label: t("signals.otc"),
      desc: t("signals.otcDesc"),
      icon: Globe
    },
    {
      value: 'demo',
      label: t("signals.demo"),
      desc: t("signals.demoMode"),
      icon: Cpu
    },
    {
      value: 'market',
      label: t("signals.exchange"),
      desc: t("signals.exchangeDesc"),
      icon: BarChart
    }
  ];

  const timeframes = [
    { value: '1', label: t("signals.tf1min"), desc: t("signals.tfScalping") },
    { value: '3', label: t("signals.tf3min"), desc: t("signals.tfSuperShort") },
    { value: '5', label: t("signals.tf5min"), desc: t("signals.tfShort") },
    { value: '10', label: t("signals.tf10min"), desc: t("signals.tfMedium") },
    { value: '15', label: t("signals.tf15min"), desc: t("signals.tfLong") },
  ];

  const aiTypes = [
    { value: 'fast_ai', label: 'Fast AI', desc: t("signals.aiFast"), icon: Zap },
    { value: 'manual_ai', label: 'Manual AI', desc: t("signals.aiManual"), icon: Filter },
    { value: 'neural_ai', label: 'Neural AI', desc: t("signals.aiNeural"), icon: Brain },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white relative">
      {/* Trading фон */}
      <TradingBackground variant="search" />
      
      <div className="relative z-10 container mx-auto px-3 sm:px-6 py-4 sm:py-8 md:py-12 max-w-5xl">
        {/* Заголовок */}
        <div className="text-center mb-6 sm:mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl mb-4 sm:mb-6 shadow-lg shadow-purple-500/25"
          >
            <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 px-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {t("signals.title")}
          </h1>
          <p className="text-gray-400 text-sm sm:text-base md:text-lg px-2 max-w-2xl mx-auto">
            {t("signals.subtitle")}
          </p>
        </div>

        {/* Показ ошибок */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-900/30 backdrop-blur-sm border border-red-500/50 rounded-xl"
          >
            <div className="flex items-center">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 mr-2 flex-shrink-0" />
              <div>
                <div className="font-medium text-red-300 text-sm sm:text-base">{t("common.error")}</div>
                <div className="text-xs sm:text-sm text-red-400">{error}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Главная карточка */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl shadow-black/50 p-4 sm:p-6 md:p-8 mb-6 sm:mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Выбор рынка */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
                  {t("signals.marketSelection")}
                </div>
              </label>
              <div className="space-y-2">
                {markets.map((marketItem) => {
                  const Icon = marketItem.icon;
                  return (
                    <motion.div
                      key={marketItem.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl border cursor-pointer transition-all ${
                        market === marketItem.value
                          ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/10'
                          : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                      }`}
                      onClick={() => setMarket(marketItem.value)}
                    >
                      <div className={`p-1.5 rounded-lg ${
                        market === marketItem.value ? 'bg-blue-500/30' : 'bg-gray-700/30'
                      }`}>
                        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${
                          market === marketItem.value ? 'text-blue-400' : 'text-gray-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{marketItem.label}</div>
                        <div className="text-xs text-gray-400 truncate">{marketItem.desc}</div>
                      </div>
                      <motion.div
                        className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                          market === marketItem.value ? 'bg-blue-500' : 'bg-gray-700'
                        }`}
                        animate={market === marketItem.value ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Таймфрейм */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                  {t("signals.timeframe")}
                </div>
              </label>
              <div className="space-y-2">
                {timeframes.map((tf) => (
                  <motion.div
                    key={tf.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-2 sm:p-3 rounded-xl border cursor-pointer transition-all ${
                      timeframe === tf.value
                        ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/10'
                        : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                    }`}
                    onClick={() => setTimeframe(tf.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{tf.label}</div>
                      <motion.div
                        className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                          timeframe === tf.value ? 'bg-purple-500' : 'bg-gray-700'
                        }`}
                        animate={timeframe === tf.value ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      />
                    </div>
                    <div className="text-xs text-gray-400">{tf.desc}</div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Тип AI */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-3 h-3 sm:w-4 sm:h-4" />
                  {t("signals.aiType")}
                </div>
              </label>
              <div className="space-y-2">
                {aiTypes.map((ai) => {
                  const Icon = ai.icon;
                  return (
                    <motion.div
                      key={ai.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl border cursor-pointer transition-all ${
                        aiType === ai.value
                          ? 'border-green-500 bg-green-500/20 shadow-lg shadow-green-500/10'
                          : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                      }`}
                      onClick={() => setAiType(ai.value)}
                    >
                      <div className={`p-1.5 rounded-lg ${
                        aiType === ai.value ? 'bg-green-500/30' : 'bg-gray-700/30'
                      }`}>
                        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${
                          aiType === ai.value ? 'text-green-400' : 'text-gray-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{ai.label}</div>
                        <div className="text-xs text-gray-400 truncate">{ai.desc}</div>
                      </div>
                      <motion.div
                        className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                          aiType === ai.value ? 'bg-green-500' : 'bg-gray-700'
                        }`}
                        animate={aiType === ai.value ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Информация о выбранных параметрах */}
          <motion.div
            className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
              <div className="text-center sm:text-left">
                <div className="text-xs sm:text-sm text-gray-400">{t("signals.selectedParams")}</div>
                <div className="font-semibold text-sm sm:text-base bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {markets.find(m => m.value === market)?.label} •
                  {timeframes.find(t => t.value === timeframe)?.label} •
                  {aiTypes.find(a => a.value === aiType)?.label}
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-400">
                {t("signals.analysisTime")}:
                <span className="ml-2 font-semibold text-blue-400">
                  {aiTypes.find(a => a.value === aiType)?.desc.match(/\((\d+)/)?.[1] || '10'} {t("common.minutes")}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Кнопка поиска */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              onClick={handleSearch}
              disabled={isLoading || (user?.role !== 'admin' && signalsUsed >= signalsLimit)}
              size="lg"
              className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 px-8 sm:px-12 py-4 sm:py-6 text-base sm:text-lg font-semibold rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 w-full sm:w-auto group"
            >
              <span className="relative z-10 flex items-center justify-center">
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-t-2 border-b-2 border-white mr-2"></div>
                    <span className="text-sm sm:text-base">{t("signals.analyzing")}</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    {user?.role !== 'admin' && signalsUsed >= signalsLimit
                      ? t("signals.limitExhausted")
                      : t("signals.findSignal")}
                  </>
                )}
              </span>
              {!isLoading && (
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              )}
            </Button>
            {user?.role !== 'admin' && signalsUsed >= signalsLimit && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-xs sm:text-sm text-yellow-400 px-2"
              >
                ⚠️ {t("signals.limitExhaustedDesc")}
              </motion.p>
            )}
          </motion.div>
        </motion.div>

        {/* Полноэкранная анимация загрузки */}
        {isLoading && (
          <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
              <SignalLoadingAnimation
                market={market}
                timeframe={timeframe}
                aiType={aiType}
              />
            </div>
          </div>
        )}

        {/* Модальное окно лимита сигналов */}
        <SignalLimitModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          signalsUsed={signalsUsed}
          signalsLimit={signalsLimit}
          nextTierBalance={nextTierBalance}
          currentBalance={user?.balance || 0}
        />

        {/* Информационные карточки */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"
        >
          <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/10 backdrop-blur-sm border border-green-700/30 rounded-2xl p-4 sm:p-6 hover:border-green-500/50 transition-colors">
            <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <BarChart className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
              </div>
              {t("signals.market")}
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4">
              {t("signals.marketDesc")}
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-400">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                {t("signals.marketFeature1")}
              </div>
              <div className="flex items-center gap-2 text-xs text-green-400">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                {t("signals.marketFeature2")}
              </div>
              <div className="flex items-center gap-2 text-xs text-green-400">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                {t("signals.marketFeature3")}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/10 backdrop-blur-sm border border-purple-700/30 rounded-2xl p-4 sm:p-6 hover:border-purple-500/50 transition-colors">
            <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              </div>
              {t("signals.demo")}
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4">
              {t("signals.demoDesc")}
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-purple-400">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                {t("signals.demoFeature1")}
              </div>
              <div className="flex items-center gap-2 text-xs text-purple-400">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                {t("signals.demoFeature2")}
              </div>
              <div className="flex items-center gap-2 text-xs text-purple-400">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                {t("signals.demoFeature3")}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Информация о процессе */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gradient-to-br from-blue-900/20 to-indigo-900/10 backdrop-blur-sm border border-blue-700/30 rounded-2xl"
        >
          <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2 text-blue-300">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              🔄
            </div>
            {t("signals.howItWorks")}
          </h3>
          <ol className="list-decimal pl-4 sm:pl-5 space-y-2 text-xs sm:text-sm text-gray-300">
            <li>{t("signals.step1")}</li>
            <li>{t("signals.step2")}</li>
            <li>{t("signals.step3")}</li>
            <li>{t("signals.step4")}</li>
            <li>{t("signals.step5")}</li>
          </ol>
        </motion.div>

        {/* Статистика */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 sm:mt-12 text-center text-gray-400"
        >
          <p className="text-xs sm:text-sm px-2">
            {t("signals.aiAnalysisDesc")}
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-4 sm:mt-6 text-xs sm:text-sm">
            {[
              { color: 'green', text: t("signals.accuracy") },
              { color: 'blue', text: t("signals.timeframes") },
              { color: 'purple', text: t("signals.aiAnalysis") },
              { color: 'yellow', text: t("signals.updateTime") },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-2 h-2 bg-${item.color}-500 rounded-full`} />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}