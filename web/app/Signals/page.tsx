"use client";
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, Zap, Brain, Clock, Filter, Globe, Cpu, BarChart, AlertCircle } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';

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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Заголовок */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6">
            <TrendingUp className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold mb-4">{t("signals.title")}</h1>
          <p className="text-gray-400 text-lg">
            {t("signals.subtitle")}
          </p>
        </div>

        {/* Показ ошибок */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-xl">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" />
              <div>
                <div className="font-medium text-red-300">{t("common.error")}</div>
                <div className="text-sm text-red-400">{error}</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Выбор рынка */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {t("signals.marketSelection")}
                </div>
              </label>
              <div className="space-y-2">
                {markets.map((marketItem) => {
                  const Icon = marketItem.icon;
                  return (
                    <div
                      key={marketItem.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-blue-500/50 ${
                        market === marketItem.value 
                          ? 'border-blue-500 bg-blue-500/10' 
                          : 'border-gray-700 bg-gray-900/50'
                      }`}
                      onClick={() => setMarket(marketItem.value)}
                    >
                      <Icon className={`w-5 h-5 ${
                        market === marketItem.value ? 'text-blue-400' : 'text-gray-400'
                      }`} />
                      <div>
                        <div className="font-medium">{marketItem.label}</div>
                        <div className="text-xs text-gray-400">{marketItem.desc}</div>
                      </div>
                      <div className={`ml-auto w-3 h-3 rounded-full ${
                        market === marketItem.value ? 'bg-blue-500' : 'bg-gray-700'
                      }`} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Таймфрейм */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {t("signals.timeframe")}
                </div>
              </label>
              <div className="space-y-2">
                {timeframes.map((tf) => (
                  <div
                    key={tf.value}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-purple-500/50 ${
                      timeframe === tf.value 
                        ? 'border-purple-500 bg-purple-500/10' 
                        : 'border-gray-700 bg-gray-900/50'
                    }`}
                    onClick={() => setTimeframe(tf.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{tf.label}</div>
                      <div className={`w-3 h-3 rounded-full ${
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  {t("signals.aiType")}
                </div>
              </label>
              <div className="space-y-2">
                {aiTypes.map((ai) => {
                  const Icon = ai.icon;
                  return (
                    <div
                      key={ai.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-green-500/50 ${
                        aiType === ai.value 
                          ? 'border-green-500 bg-green-500/10' 
                          : 'border-gray-700 bg-gray-900/50'
                      }`}
                      onClick={() => setAiType(ai.value)}
                    >
                      <Icon className={`w-5 h-5 ${
                        aiType === ai.value ? 'text-green-400' : 'text-gray-400'
                      }`} />
                      <div className="flex-1">
                        <div className="font-medium">{ai.label}</div>
                        <div className="text-xs text-gray-400">{ai.desc}</div>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${
                        aiType === ai.value ? 'bg-green-500' : 'bg-gray-700'
                      }`} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Информация о выбранных параметрах */}
          <div className="mb-6 p-4 bg-gray-900/30 rounded-lg border border-gray-700">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <div className="text-sm text-gray-400">{t("signals.selectedParams")}</div>
                <div className="font-semibold">
                  {markets.find(m => m.value === market)?.label} •
                  {timeframes.find(t => t.value === timeframe)?.label} •
                  {aiTypes.find(a => a.value === aiType)?.label}
                </div>
              </div>
              <div className="text-sm text-gray-400">
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
              className={`bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-12 py-6 text-lg font-semibold rounded-xl transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                  {t("signals.analyzing")}
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  {user?.role !== 'admin' && signalsUsed >= signalsLimit
                    ? t("signals.limitExhausted")
                    : t("signals.findSignal")}
                </>
              )}
            </Button>
            {isLoading && (
              <p className="mt-3 text-sm text-gray-400">
                {t("signals.loadingData")}
              </p>
            )}
            {user?.role !== 'admin' && signalsUsed >= signalsLimit && (
              <p className="mt-3 text-sm text-yellow-400">
                ⚠️ {t("signals.limitExhaustedDesc")}
              </p>
            )}
          </div>
        </div>

        {/* Остальной контент (без изменений) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <BarChart className="w-5 h-5 text-green-400" />
              {t("signals.market")}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {t("signals.marketDesc")}
            </p>
            <div className="text-xs text-green-400">• {t("signals.marketFeature1")}</div>
            <div className="text-xs text-green-400">• {t("signals.marketFeature2")}</div>
            <div className="text-xs text-green-400">• {t("signals.marketFeature3")}</div>
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              {t("signals.demo")}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {t("signals.demoDesc")}
            </p>
            <div className="text-xs text-purple-400">• {t("signals.demoFeature1")}</div>
            <div className="text-xs text-purple-400">• {t("signals.demoFeature2")}</div>
            <div className="text-xs text-purple-400">• {t("signals.demoFeature3")}</div>
          </div>
        </div>

        {/* Информация о процессе */}
        <div className="mt-8 p-6 bg-blue-900/10 border border-blue-700 rounded-xl">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-300">
            🔄 {t("signals.howItWorks")}
          </h3>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-300">
            <li>{t("signals.step1")}</li>
            <li>{t("signals.step2")}</li>
            <li>{t("signals.step3")}</li>
            <li>{t("signals.step4")}</li>
            <li>{t("signals.step5")}</li>
          </ol>
        </div>

        {/* Статистика */}
        <div className="mt-12 text-center text-gray-400">
          <p className="text-sm">
            {t("signals.aiAnalysisDesc")}
          </p>
          <div className="flex flex-wrap justify-center gap-6 mt-6 text-sm">
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