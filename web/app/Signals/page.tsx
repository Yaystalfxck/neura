"use client";
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, Zap, Brain, Clock, Filter, Globe, Cpu, BarChart, AlertCircle, DollarSign, RefreshCw } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';

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
  
  const [market, setMarket] = useState('market');
  const [timeframe, setTimeframe] = useState('5');
  const [aiType, setAiType] = useState('neural_ai');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [signalsUsed, setSignalsUsed] = useState<number>(0);
  const [signalsLimit, setSignalsLimit] = useState<number>(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showBalanceInfo, setShowBalanceInfo] = useState(false);
  
  // Флаги для предотвращения множественных запросов
  const initialLoadDone = useRef(false);
  const lastSyncTime = useRef<number>(0);
  const syncInProgress = useRef(false);

  // Загрузка данных пользователя и баланса (только один раз при монтировании)
  useEffect(() => {
    if (!user) return;
    
    // Загружаем данные только один раз
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadInitialData();
    }
  }, [user]);

  const loadInitialData = async () => {
    try {
      // Сначала загружаем лимиты (они содержат баланс из БД)
      await loadSignalLimits();
      
      // Затем синхронизируем с PocketOption (но не чаще чем раз в 5 минут)
      const now = Date.now();
      if (now - lastSyncTime.current > 5 * 60 * 1000) {
        await syncPocketOptionBalance();
        lastSyncTime.current = now;
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const syncPocketOptionBalance = async () => {
    if (!user) return;
    
    // Защита от параллельных запросов
    if (syncInProgress.current) return;
    
    setIsSyncing(true);
    syncInProgress.current = true;
    
    try {
      const response = await fetch('/api/user/sync-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          pocketOptionId: user.pocketOptionId 
        }),
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        setUserBalance(data.balance || 0);
        // Обновляем время последней успешной синхронизации
        lastSyncTime.current = Date.now();
      }
    } catch (error) {
      console.error('Error syncing balance:', error);
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  };

  const loadSignalLimits = async () => {
    try {
      const response = await fetch('/api/user/signal-limits', {
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSignalsUsed(data.used || 0);
        setSignalsLimit(data.limit || 1);
        setUserBalance(data.balance || 0);
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

  const getNextLevelInfo = () => {
    if (user?.role === 'admin') {
      return { nextLevel: '∞', need: 0 };
    }

    if (userBalance >= 200) {
      return { nextLevel: 5, need: 0 }; // Максимум
    } else if (userBalance >= 100) {
      return { nextLevel: 5, need: 200 - userBalance };
    } else if (userBalance >= 50) {
      return { nextLevel: 4, need: 100 - userBalance };
    } else if (userBalance >= 25) {
      return { nextLevel: 3, need: 50 - userBalance };
    } else {
      return { nextLevel: 2, need: 25 - userBalance };
    }
  };

  const handleSearch = async () => {
    // Проверяем доступность сигнала
    const availability = checkSignalAvailability();
    if (!availability.available) {
      setError(availability.reason || 'Сигналы недоступны');
      return;
    }

    setIsLoading(true);
    setError(null);
  
    try {
      console.log('📡 Отправка запроса:', { market, timeframe, aiType });
      
      const response = await fetch('/api/signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          market: market,
          timeframe: timeframe,
          aiType: aiType,
          userId: user?.id
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка сервера');
      }
      
      if (result.success) {
        console.log('✅ Сигнал получен:', result.signal);
        
        // Обновляем счетчик использованных сигналов
        setSignalsUsed(prev => prev + 1);
        
        // Если в ответе есть баланс, обновляем его
        if (result.balance !== undefined) {
          setUserBalance(result.balance);
        }
        
        const queryString = new URLSearchParams({
          signal: encodeURIComponent(JSON.stringify(result.signal)),
          market: market,
          timeframe: `${timeframe} минут`,
          ai: aiType,
          summary: encodeURIComponent(JSON.stringify(result.market_data_summary || {}))
        }).toString();
        
        router.push(`/signal-found?${queryString}`);
      } else {
        setError(result.error || 'Неизвестная ошибка');
        alert(`Ошибка: ${result.error || 'Не удалось получить сигнал'}`);
      }
    } catch (error) {
      console.error('❌ Ошибка в handleSearch:', error);
      setError('Произошла ошибка при получении сигнала');
    } finally {
      setIsLoading(false);
    }
  };

  const markets = [
    { 
      value: 'market', 
      label: 'Маркет', 
      desc: 'Биржевой рынок',
      icon: BarChart
    },
    { 
      value: 'demo', 
      label: 'Демо', 
      desc: 'Тестовый режим',
      icon: Cpu
    }
  ];

  const timeframes = [
    { value: '1', label: '1 минута', desc: 'Скальпинг' },
    { value: '3', label: '3 минуты', desc: 'Супер-краткосрочный' },
    { value: '5', label: '5 минут', desc: 'Краткосрочный' },
    { value: '10', label: '10 минут', desc: 'Среднесрочный' },
    { value: '15', label: '15 минут', desc: 'Долгосрочный' },
  ];

  const aiTypes = [
    { value: 'fast_ai', label: 'Fast AI', desc: 'Быстрый анализ (3 мин)', icon: Zap },
    { value: 'manual_ai', label: 'Manual AI', desc: 'Ручной анализ (5 мин)', icon: Filter },
    { value: 'neural_ai', label: 'Neural AI', desc: 'Глубокий анализ (10 мин)', icon: Brain },
  ];

  const nextLevel = getNextLevelInfo();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Баланс и лимиты */}
        <div className="mb-8 p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Ваш баланс (PocketOption)</div>
                <div className="text-2xl font-bold text-green-400">
                  ${userBalance.toFixed(2)}
                  <button 
                    onClick={syncPocketOptionBalance}
                    disabled={isSyncing}
                    className="ml-3 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 inline ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm text-gray-400">Доступно сигналов</div>
                <div className="text-2xl font-bold text-blue-400">
                  {user?.role === 'admin' ? '∞' : `${signalsLimit - signalsUsed}/${signalsLimit}`}
                </div>
              </div>
              <button
                onClick={() => setShowBalanceInfo(!showBalanceInfo)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <AlertCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Информация о лимитах */}
          {showBalanceInfo && (
            <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
              <h4 className="font-semibold mb-3">Как увеличить лимит сигналов:</h4>
              <div className="space-y-2 text-sm">
                <div className={`flex justify-between p-2 rounded ${userBalance >= 0 ? 'bg-green-500/10' : ''}`}>
                  <span>Баланс от 0$</span>
                  <span className="font-medium">1 сигнал/день</span>
                </div>
                <div className={`flex justify-between p-2 rounded ${userBalance >= 25 ? 'bg-green-500/10' : ''}`}>
                  <span>Баланс от 25$</span>
                  <span className="font-medium">2 сигнала/день</span>
                </div>
                <div className={`flex justify-between p-2 rounded ${userBalance >= 50 ? 'bg-green-500/10' : ''}`}>
                  <span>Баланс от 50$</span>
                  <span className="font-medium">3 сигнала/день</span>
                </div>
                <div className={`flex justify-between p-2 rounded ${userBalance >= 100 ? 'bg-green-500/10' : ''}`}>
                  <span>Баланс от 100$</span>
                  <span className="font-medium">4 сигнала/день</span>
                </div>
                <div className={`flex justify-between p-2 rounded ${userBalance >= 200 ? 'bg-green-500/10' : ''}`}>
                  <span>Баланс от 200$</span>
                  <span className="font-medium">5 сигналов/день</span>
                </div>
                {user?.role === 'admin' && (
                  <div className="flex justify-between p-2 rounded bg-purple-500/10">
                    <span>Администратор</span>
                    <span className="font-medium">Безлимитно</span>
                  </div>
                )}
              </div>
              
              {user?.role !== 'admin' && nextLevel.need > 0 && (
                <div className="mt-3 p-3 bg-blue-500/10 rounded-lg">
                  <p className="text-sm">
                    До следующего уровня ({nextLevel.nextLevel} сигналов) нужно пополнить баланс на 
                    <span className="font-bold text-green-400"> ${nextLevel.need.toFixed(2)}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Индикатор использования */}
          {user?.role !== 'admin' && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Использовано сегодня:</span>
                <span className="font-medium">{signalsUsed}/{signalsLimit}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${(signalsUsed / signalsLimit) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Предупреждение о лимите */}
        {user?.role !== 'admin' && signalsUsed >= signalsLimit && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-300">Лимит сигналов исчерпан</p>
                <p className="text-sm text-yellow-400/80">
                  Вы использовали все доступные сигналы на сегодня. 
                  Новые сигналы будут доступны завтра или после пополнения баланса.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6">
            <TrendingUp className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold mb-4">AI Forex Signal Finder</h1>
          <p className="text-gray-400 text-lg">
            Найдите лучшие торговые сигналы с помощью искусственного интеллекта
          </p>
        </div>

        {/* Показ ошибок */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-xl">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" />
              <div>
                <div className="font-medium text-red-300">Ошибка:</div>
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
                  Выбор рынка
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
                  Таймфрейм
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
                  Тип AI анализа
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
                <div className="text-sm text-gray-400">Выбранные параметры:</div>
                <div className="font-semibold">
                  {markets.find(m => m.value === market)?.label} • 
                  {timeframes.find(t => t.value === timeframe)?.label} • 
                  {aiTypes.find(a => a.value === aiType)?.label}
                </div>
              </div>
              <div className="text-sm text-gray-400">
                Примерное время анализа: 
                <span className="ml-2 font-semibold text-blue-400">
                  {aiTypes.find(a => a.value === aiType)?.desc.match(/\((\d+)/)?.[1] || '10'} мин
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
                  ИИ анализирует рынок...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  {user?.role !== 'admin' && signalsUsed >= signalsLimit 
                    ? 'Лимит исчерпан' 
                    : 'Найти торговый сигнал'}
                </>
              )}
            </Button>
            {isLoading && (
              <p className="mt-3 text-sm text-gray-400">
                Получаем данные с TradingView, анализируем... Это может занять до 30 секунд
              </p>
            )}
            {user?.role !== 'admin' && signalsUsed >= signalsLimit && (
              <p className="mt-3 text-sm text-yellow-400">
                ⚠️ Лимит сигналов на сегодня исчерпан. Завтра будет доступно {signalsLimit} сигналов.
              </p>
            )}
          </div>
        </div>

        {/* Остальной контент (без изменений) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <BarChart className="w-5 h-5 text-green-400" />
              Маркет
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Биржевой рынок с централизованными торгами и клирингом
            </p>
            <div className="text-xs text-green-400">• Биржевые торги</div>
            <div className="text-xs text-green-400">• Центральный клиринг</div>
            <div className="text-xs text-green-400">• Прозрачные цены</div>
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              Демо
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Тестовый режим для обучения и тестирования стратегий
            </p>
            <div className="text-xs text-purple-400">• Виртуальные средства</div>
            <div className="text-xs text-purple-400">• Исторические данные</div>
            <div className="text-xs text-purple-400">• Без рисков</div>
          </div>
        </div>

        {/* Рекомендации по таймфреймам */}
        <div className="mt-8 bg-gray-800/20 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            Рекомендации по выбору таймфрейма
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {timeframes.map((tf) => (
              <div key={tf.value} className="text-center">
                <div className={`text-lg font-bold mb-1 ${
                  timeframe === tf.value ? 'text-yellow-400' : 'text-gray-300'
                }`}>
                  {tf.label}
                </div>
                <div className="text-xs text-gray-400">{tf.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-gray-500 text-center">
            ✅ Поддерживаются таймфреймы: 1, 3, 5, 10, 15 минут
          </div>
        </div>

        {/* Информация о процессе */}
        <div className="mt-8 p-6 bg-blue-900/10 border border-blue-700 rounded-xl">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-300">
            🔄 Как работает система?
          </h3>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-300">
            <li>Вы выбираете параметры (рынок, таймфрейм, тип ИИ)</li>
            <li>Система получает актуальные данные с TradingView</li>
            <li>ИИ анализирует данные и определяет лучшую торговую пару</li>
            <li>Формируется сигнал с направлением, временем экспирации и обоснованием</li>
            <li>Результат отображается на странице с детальной информацией</li>
          </ol>
        </div>

        {/* Статистика */}
        <div className="mt-12 text-center text-gray-400">
          <p className="text-sm">
            Система использует продвинутый ИИ анализ на выбранных вами параметрах
          </p>
          <div className="flex flex-wrap justify-center gap-6 mt-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Точность: 85%+</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Таймфреймы: 1-15 мин</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>ИИ анализ</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>Обновление: 5 мин</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}