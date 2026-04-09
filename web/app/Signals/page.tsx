"use client";
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, Zap, Brain, Clock, Filter, Globe, Cpu, BarChart, AlertCircle } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { SignalLoadingAnimation } from '@/components/SignalLoadingAnimation';
import { TradingBackground } from '@/components/TradingBackground';

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
        setSignalsUsed(data.used || 0);
        setSignalsLimit(data.limit || 1);
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
      setError(availability.reason || t("signals.limitExhausted"));
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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white relative">
      {/* Trading фон */}
      <TradingBackground variant="search" />
      
      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-12 max-w-4xl">
        {/* Заголовок */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4 sm:mb-6">
            <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-2">{t("signals.title")}</h1>
          <p className="text-gray-400 text-sm sm:text-lg px-2">
            {t("signals.subtitle")}
          </p>
        </div>

        {/* Показ ошибок */}
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-900/20 border border-red-700 rounded-xl">
            <div className="flex items-center">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 mr-2 flex-shrink-0" />
              <div>
                <div className="font-medium text-red-300 text-sm sm:text-base">{t("common.error")}</div>
                <div className="text-xs sm:text-sm text-red-400">{error}</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
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
                    <div
                      key={marketItem.value}
                      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border cursor-pointer transition-all hover:border-blue-500/50 ${
                        market === marketItem.value
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 bg-gray-900/50'
                      }`}
                      onClick={() => setMarket(marketItem.value)}
                    >
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        market === marketItem.value ? 'text-blue-400' : 'text-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{marketItem.label}</div>
                        <div className="text-xs text-gray-400 truncate">{marketItem.desc}</div>
                      </div>
                      <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                        market === marketItem.value ? 'bg-blue-500' : 'bg-gray-700'
                      }`} />
                    </div>
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
                  <div
                    key={tf.value}
                    className={`p-2 sm:p-3 rounded-lg border cursor-pointer transition-all hover:border-purple-500/50 ${
                      timeframe === tf.value
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700 bg-gray-900/50'
                    }`}
                    onClick={() => setTimeframe(tf.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{tf.label}</div>
                      <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                        timeframe === tf.value ? 'bg-purple-500' : 'bg-gray-700'
                      }`} />
                    </div>
                    <div className="text-xs text-gray-400">{tf.desc}</div>
                  </div>
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
                    <div
                      key={ai.value}
                      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border cursor-pointer transition-all hover:border-green-500/50 ${
                        aiType === ai.value
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-gray-700 bg-gray-900/50'
                      }`}
                      onClick={() => setAiType(ai.value)}
                    >
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        aiType === ai.value ? 'text-green-400' : 'text-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{ai.label}</div>
                        <div className="text-xs text-gray-400 truncate">{ai.desc}</div>
                      </div>
                      <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                        aiType === ai.value ? 'bg-green-500' : 'bg-gray-700'
                      }`} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Информация о выбранных параметрах */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-900/30 rounded-lg border border-gray-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
              <div className="text-center sm:text-left">
                <div className="text-xs sm:text-sm text-gray-400">{t("signals.selectedParams")}</div>
                <div className="font-semibold text-sm sm:text-base">
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
          </div>

          {/* Кнопка поиска */}
          <div className="text-center">
            <Button
              onClick={handleSearch}
              disabled={isLoading || (user?.role !== 'admin' && signalsUsed >= signalsLimit)}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 sm:px-12 py-4 sm:py-6 text-base sm:text-lg font-semibold rounded-xl transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed w-full sm:w-auto"
            >
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
            </Button>
            {user?.role !== 'admin' && signalsUsed >= signalsLimit && (
              <p className="mt-3 text-xs sm:text-sm text-yellow-400 px-2">
                ⚠️ {t("signals.limitExhaustedDesc")}
              </p>
            )}
          </div>
        </div>

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

        {/* Остальной контент */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
              <BarChart className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
              {t("signals.market")}
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4">
              {t("signals.marketDesc")}
            </p>
            <div className="text-xs text-green-400">• {t("signals.marketFeature1")}</div>
            <div className="text-xs text-green-400">• {t("signals.marketFeature2")}</div>
            <div className="text-xs text-green-400">• {t("signals.marketFeature3")}</div>
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              {t("signals.demo")}
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4">
              {t("signals.demoDesc")}
            </p>
            <div className="text-xs text-purple-400">• {t("signals.demoFeature1")}</div>
            <div className="text-xs text-purple-400">• {t("signals.demoFeature2")}</div>
            <div className="text-xs text-purple-400">• {t("signals.demoFeature3")}</div>
          </div>
        </div>

        {/* Информация о процессе */}
        <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-blue-900/10 border border-blue-700 rounded-xl">
          <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2 text-blue-300">
            🔄 {t("signals.howItWorks")}
          </h3>
          <ol className="list-decimal pl-4 sm:pl-5 space-y-2 text-xs sm:text-sm text-gray-300">
            <li>{t("signals.step1")}</li>
            <li>{t("signals.step2")}</li>
            <li>{t("signals.step3")}</li>
            <li>{t("signals.step4")}</li>
            <li>{t("signals.step5")}</li>
          </ol>
        </div>

        {/* Статистика */}
        <div className="mt-8 sm:mt-12 text-center text-gray-400">
          <p className="text-xs sm:text-sm px-2">
            {t("signals.aiAnalysisDesc")}
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-4 sm:mt-6 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{t("signals.accuracy")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>{t("signals.timeframes")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>{t("signals.aiAnalysis")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>{t("signals.updateTime")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}