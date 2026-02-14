"use client";
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Target,
  Shield,
  Zap,
  Brain,
  Filter,
  Clock,
  Globe,
  BarChart,
  Cpu,
  CheckCircle,
  AlertCircle,
  History,
  Star,
  Copy,
  Download,
  Check
} from 'lucide-react';

export default function SignalFound() {
  return (
    <ProtectedRoute>
      <SignalFoundPage/>
    </ProtectedRoute>
  );
}

function SignalFoundPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isLoading, setIsLoading] = useState(true);
  const [signalData, setSignalData] = useState<any>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  
  const signalParam = searchParams.get('signal');
  const marketParam = searchParams.get('market');
  const timeframeParam = searchParams.get('timeframe');
  const aiParam = searchParams.get('ai');
  const summaryParam = searchParams.get('summary');

  // ✅ Функция адаптации сигнала под единый формат
  const adaptSignalFormat = (signal: any) => {
    if (!signal) return signal;
    
    // Если сигнал уже в правильном формате (BUY/SELL)
    if (signal.direction === 'BUY' || signal.direction === 'SELL') {
      return {
        ...signal,
        take_profit: signal.take_profit || (signal.direction === 'BUY' 
          ? (parseFloat(signal.entry_price || '1.085') * 1.004).toFixed(5)
          : (parseFloat(signal.entry_price || '1.085') * 0.996).toFixed(5)),
        stop_loss: signal.stop_loss || (signal.direction === 'BUY'
          ? (parseFloat(signal.entry_price || '1.085') * 0.998).toFixed(5)
          : (parseFloat(signal.entry_price || '1.085') * 1.002).toFixed(5)),
        provider: signal.provider || 'Unknown',
        signal_id: signal.signal_id || `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        generated_at: signal.generated_at || new Date().toISOString()
      };
    }
    
    // Если сигнал в формате ML (CALL/PUT)
    if (signal.direction === 'CALL' || signal.direction === 'PUT') {
      const direction = signal.direction === 'CALL' ? 'BUY' : 'SELL';
      const currentPrice = signal.current_price || parseFloat(signal.entry_price) || 1.085;
      
      return {
        pair: signal.pair || 'EUR/USD',
        direction: direction,
        expiration: signal.expiration || `${signal.expiry || 5} минут`,
        confidence: signal.confidence?.includes('%') ? signal.confidence : `${signal.confidence || 75}%`,
        entry_price: currentPrice.toFixed(5),
        take_profit: direction === 'BUY'
          ? (currentPrice * 1.004).toFixed(5)
          : (currentPrice * 0.996).toFixed(5),
        stop_loss: direction === 'BUY'
          ? (currentPrice * 0.998).toFixed(5)
          : (currentPrice * 1.002).toFixed(5),
        probability: signal.probability || { call: 50, put: 50 },
        expiry_minutes: signal.expiry || 5,
        signal_strength: signal.signal_strength || 
          (parseInt(signal.confidence) > 75 ? 'strong' : 
           parseInt(signal.confidence) > 65 ? 'moderate' : 'weak'),
        provider: signal.provider || 'ML Model',
        signal_id: signal.signal_id || `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        generated_at: signal.generated_at || new Date().toISOString(),
        reasoning: signal.reasoning || `${signal.pair}: ${direction === 'BUY' ? 'ПОКУПКА' : 'ПРОДАЖА'} с уверенностью ${signal.confidence || 75}%`,
        market_data: signal.market_data || null
      };
    }
    
    return signal;
  };

  // ✅ Функция сохранения сигнала в историю
  const saveSignalToHistory = (signal: any) => {
    try {
      // 1. Сохраняем в sessionStorage (текущая сессия)
      const sessionKey = `signal_${Date.now()}`;
      sessionStorage.setItem(sessionKey, JSON.stringify(signal));
      
      // 2. Сохраняем в localStorage (постоянная история)
      const history = JSON.parse(localStorage.getItem('neura_signals_history') || '[]');
      
      // Проверяем, нет ли уже такого сигнала
      const exists = history.some((s: any) => s.signal_id === signal.signal_id);
      
      if (!exists) {
        // Добавляем сигнал в историю
        const signalWithMeta = {
          ...signal,
          id: history.length + 1,
          status: 'active',
          saved_at: new Date().toISOString(),
          viewed_at: new Date().toISOString()
        };
        
        history.unshift(signalWithMeta);
        
        // Ограничиваем историю 100 сигналами
        if (history.length > 100) {
          history.pop();
        }
        
        localStorage.setItem('neura_signals_history', JSON.stringify(history));
        console.log('✅ Сигнал сохранен в историю:', signal.signal_id);
        
        // Показываем уведомление
        showToastMessage('Сигнал сохранен в историю', 'success');
        setIsSaved(true);
        
        return true;
      } else {
        console.log('ℹ️ Сигнал уже существует в истории');
        return false;
      }
    } catch (error) {
      console.error('❌ Ошибка сохранения сигнала:', error);
      return false;
    }
  };

  // ✅ Функция проверки, находится ли сигнал в избранном
  const checkIsFavorite = (signalId: string) => {
    try {
      const favorites = JSON.parse(localStorage.getItem('neura_favorite_signals') || '[]');
      return favorites.includes(signalId);
    } catch {
      return false;
    }
  };

  // ✅ Функция добавления/удаления из избранного
  const toggleFavorite = (signalId: string) => {
    try {
      const favorites = JSON.parse(localStorage.getItem('neura_favorite_signals') || '[]');
      
      if (favorites.includes(signalId)) {
        const newFavorites = favorites.filter((id: string) => id !== signalId);
        localStorage.setItem('neura_favorite_signals', JSON.stringify(newFavorites));
        setIsFavorite(false);
        showToastMessage('Сигнал удален из избранного', 'info');
      } else {
        favorites.push(signalId);
        localStorage.setItem('neura_favorite_signals', JSON.stringify(favorites));
        setIsFavorite(true);
        showToastMessage('Сигнал добавлен в избранное', 'success');
      }
    } catch (error) {
      console.error('Ошибка при изменении избранного:', error);
    }
  };

  // ✅ Функция показа уведомлений
  const showToastMessage = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // ✅ Функция копирования сигнала
  const copySignal = (signal: any) => {
    const signalCopy = {
      ...signal,
      copied_at: new Date().toISOString()
    };
    
    navigator.clipboard.writeText(JSON.stringify(signalCopy, null, 2));
    showToastMessage('Сигнал скопирован в буфер обмена', 'success');
  };

  // ✅ Функция экспорта сигнала
  const exportSignal = (signal: any) => {
    const dataStr = JSON.stringify(signal, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `signal_${signal.signal_id}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showToastMessage('Сигнал экспортирован', 'success');
  };

  useEffect(() => {
    const loadSignalData = () => {
      setIsLoading(true);
      try {
        if (signalParam) {
          const decodedSignal = decodeURIComponent(signalParam);
          const signal = JSON.parse(decodedSignal);
          
          // ✅ Адаптируем формат
          const adaptedSignal = adaptSignalFormat(signal);
          setSignalData(adaptedSignal);
          
          // ✅ СОХРАНЯЕМ СИГНАЛ В ИСТОРИЮ
          saveSignalToHistory(adaptedSignal);
          
          // ✅ Проверяем, в избранном ли сигнал
          setIsFavorite(checkIsFavorite(adaptedSignal.signal_id));
        }

        if (summaryParam) {
          const decodedSummary = decodeURIComponent(summaryParam);
          const summary = JSON.parse(decodedSummary);
          setMarketData(summary);
        }

        if (!signalParam) {
          fetchSignalFromAPI();
        }

      } catch (err) {
        console.error('Ошибка парсинга данных:', err);
        setError('Не удалось загрузить данные сигнала');
      } finally {
        setIsLoading(false);
      }
    };

    const fetchSignalFromAPI = async () => {
      try {
        const response = await fetch('/api/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            market: marketParam || 'market',
            timeframe: timeframeParam?.replace(' минут', '') || '5',
            aiType: aiParam || 'fast_ai'
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          // ✅ Адаптируем формат
          const adaptedSignal = adaptSignalFormat(result.signal);
          setSignalData(adaptedSignal);
          setMarketData(result.market_analysis || result.market_data_summary);
          
          // ✅ СОХРАНЯЕМ СИГНАЛ В ИСТОРИЮ
          saveSignalToHistory(adaptedSignal);
          
          // ✅ Проверяем, в избранном ли сигнал
          setIsFavorite(checkIsFavorite(adaptedSignal.signal_id));
        } else {
          setError(result.error || 'Ошибка получения сигнала');
        }
      } catch (err) {
        setError('Ошибка соединения с сервером');
      }
    };

    loadSignalData();
  }, [signalParam, summaryParam, marketParam, timeframeParam, aiParam]);

  const getAIIcon = (provider: string) => {
    if (!provider) return <Brain className="w-5 h-5 text-purple-500" />;
    if (provider.includes('Gemini')) return <Zap className="w-5 h-5 text-yellow-500" />;
    if (provider.includes('DeepSeek')) return <Filter className="w-5 h-5 text-blue-500" />;
    if (provider.includes('OpenAI')) return <Brain className="w-5 h-5 text-green-500" />;
    if (provider.includes('ML')) return <Cpu className="w-5 h-5 text-cyan-500" />;
    if (provider.includes('RSI')) return <BarChart className="w-5 h-5 text-orange-500" />;
    return <Brain className="w-5 h-5 text-purple-500" />;
  };

  const getMarketName = (market: string) => {
    const markets: Record<string, { name: string, icon: any, color: string }> = {
      'otc': { name: 'OTC Рынок', icon: Globe, color: 'text-blue-400' },
      'market': { name: 'Маркет', icon: BarChart, color: 'text-green-400' },
      'demo': { name: 'Демо', icon: Cpu, color: 'text-purple-400' }
    };
    return markets[market || 'demo'] || { name: market || 'Демо', icon: Globe, color: 'text-gray-400' };
  };

  const calculateRiskReward = (entry: string, takeProfit: string, stopLoss: string, direction: string) => {
    const entryNum = parseFloat(entry) || 1.085;
    const tpNum = parseFloat(takeProfit) || (direction === 'BUY' ? entryNum * 1.004 : entryNum * 0.996);
    const slNum = parseFloat(stopLoss) || (direction === 'BUY' ? entryNum * 0.998 : entryNum * 1.002);
    
    if (direction === 'BUY') {
      const reward = tpNum - entryNum;
      const risk = entryNum - slNum;
      return reward > 0 && risk > 0 ? (reward / risk).toFixed(2) : '2.0';
    } else {
      const reward = entryNum - tpNum;
      const risk = slNum - entryNum;
      return reward > 0 && risk > 0 ? (reward / risk).toFixed(2) : '2.0';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-blue-500/30 rounded-full"></div>
            <div className="absolute top-0 left-0 w-24 h-24 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            <Brain className="w-12 h-12 text-blue-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h2 className="text-2xl font-bold mt-8 mb-2">ИИ анализирует данные...</h2>
          <p className="text-gray-400 mb-4">Генерация оптимального торгового сигнала</p>
        </div>
      </div>
    );
  }

  if (error || !signalData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <AlertCircle className="w-20 h-20 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4 text-red-300">Ошибка загрузки</h2>
          <p className="text-gray-400 mb-8">
            {error || 'Не удалось загрузить данные сигнала'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => router.push('/search')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться к поиску
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="border-gray-700 hover:bg-gray-800"
            >
              Попробовать снова
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const marketInfo = getMarketName(marketParam || 'market');
  const MarketIcon = marketInfo.icon;
  const riskReward = calculateRiskReward(
    signalData.entry_price,
    signalData.take_profit,
    signalData.stop_loss,
    signalData.direction
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Toast уведомление */}
      {showToast && (
        <div className="fixed top-24 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border ${
            toastType === 'success' ? 'bg-green-900/90 border-green-700' :
            toastType === 'error' ? 'bg-red-900/90 border-red-700' :
            'bg-blue-900/90 border-blue-700'
          } backdrop-blur-sm`}>
            {toastType === 'success' ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : toastType === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-400" />
            ) : (
              <History className="w-5 h-5 text-blue-400" />
            )}
            <span className="text-white">{toastMessage}</span>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/search')}
              className="text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Новый поиск
            </Button>
            
            {/* Кнопка перехода в историю */}
            <Button
              variant="ghost"
              onClick={() => router.push('/my-signals')}
              className="text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <History className="w-4 h-4 mr-2" />
              История
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg">
              <MarketIcon className={`w-4 h-4 ${marketInfo.color}`} />
              <span className="text-sm">{marketInfo.name}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-sm">{timeframeParam || signalData.expiration || '5 минут'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg">
              {getAIIcon(signalData.provider)}
              <span className="text-sm">{signalData.provider || 'ML Model'}</span>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Индикатор сохранения */}
          {isSaved && (
            <div className="mb-4 p-3 bg-green-900/30 border border-green-700/30 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-300">
                Сигнал сохранен в историю. Вы можете найти его в разделе <button 
                  onClick={() => router.push('/my-signals')}
                  className="underline hover:text-green-200 font-medium"
                >"Мои сигналы"</button>
              </span>
            </div>
          )}

          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Торговый сигнал сгенерирован
            </h1>
            <p className="text-gray-400">
              Анализ завершен • {new Date(signalData.generated_at || Date.now()).toLocaleString('ru-RU')}
            </p>
          </div>

          <div className={`rounded-2xl p-6 md:p-8 mb-8 relative ${
            signalData.direction === 'BUY' 
              ? 'bg-gradient-to-br from-green-900/20 to-emerald-900/10 border border-green-700/30' 
              : 'bg-gradient-to-br from-red-900/20 to-rose-900/10 border border-red-700/30'
          }`}>
            {/* Кнопки действий */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleFavorite(signalData.signal_id)}
                className={`border-gray-700 ${
                  isFavorite 
                    ? 'text-yellow-400 hover:text-yellow-300 border-yellow-700/50' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400' : ''}`} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copySignal(signalData)}
                className="border-gray-700 text-gray-400 hover:text-white"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportSignal(signalData)}
                className="border-gray-700 text-gray-400 hover:text-white"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                  {signalData.direction === 'BUY' ? (
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center">
                      <TrendingDown className="w-8 h-8 text-white" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold">
                      {signalData.direction === 'BUY' ? '📈 ПОКУПАТЬ' : '📉 ПРОДАВАТЬ'}
                    </h2>
                    <div className="text-lg md:text-xl font-semibold">{signalData.pair}</div>
                  </div>
                </div>
                
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/50">
                  <div className={`w-3 h-3 rounded-full ${
                    parseInt(signalData.confidence) >= 75 ? 'bg-green-500' :
                    parseInt(signalData.confidence) >= 65 ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`}></div>
                  <span className="font-semibold">{signalData.confidence || '75%'} уверенность</span>
                </div>
              </div>

              <div className="bg-black/30 rounded-xl p-6 min-w-[200px]">
                <div className="text-center">
                  <div className="text-sm text-gray-400 mb-2">Время экспирации</div>
                  <div className="text-2xl font-bold flex items-center justify-center gap-2">
                    <Clock className="w-6 h-6 text-yellow-400" />
                    {signalData.expiration}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Рекомендуемое время удержания позиции
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-900/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Цена входа</div>
                    <div className="text-xl font-bold">{signalData.entry_price}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">Рекомендуемая цена открытия позиции</div>
              </div>

              <div className="bg-gray-900/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Тейк-профит</div>
                    <div className="text-xl font-bold text-green-400">{signalData.take_profit}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {signalData.direction === 'BUY' ? 'Целевая цена для фиксации прибыли' : 'Целевая цена для закрытия позиции'}
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-red-900/30 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Стоп-лосс</div>
                    <div className="text-xl font-bold text-red-400">{signalData.stop_loss}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">Уровень защиты от убытков</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-900/30 rounded-xl p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  Риск/Доход
                </h3>
                <div className="text-3xl font-bold mb-2">1 : {riskReward}</div>
                <div className="text-sm text-gray-400">
                  На каждый рискованный доллар можно заработать {riskReward} долларов
                </div>
              </div>

              <div className="bg-gray-900/30 rounded-xl p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  ID сигнала
                </h3>
                <div className="text-sm font-mono text-gray-300 mb-2 break-all">{signalData.signal_id}</div>
                <div className="text-xs text-gray-500">
                  Уникальный идентификатор для отслеживания
                </div>
              </div>
            </div>

            <div className="bg-black/30 rounded-xl p-6 mb-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                Обоснование сигнала
              </h3>
              <div className="text-gray-300 leading-relaxed">
                {signalData.reasoning || 'Модель проанализировала рыночные данные и выявила благоприятные условия для входа в позицию.'}
              </div>
            </div>

            {signalData.market_data && (
              <div className="bg-gray-900/20 rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-blue-400" />
                  Рыночные данные на момент анализа
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Текущая цена</div>
                    <div className="text-lg font-semibold">{signalData.market_data.current_price || signalData.entry_price}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Тренд</div>
                    <div className={`text-lg font-semibold ${
                      signalData.market_data.trend === 'bullish' || signalData.market_data.trend === 'oversold' ? 'text-green-400' :
                      signalData.market_data.trend === 'bearish' || signalData.market_data.trend === 'overbought' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {signalData.market_data.trend === 'bullish' ? 'Восходящий' :
                       signalData.market_data.trend === 'bearish' ? 'Нисходящий' :
                       signalData.market_data.trend === 'oversold' ? 'Перепродан' :
                       signalData.market_data.trend === 'overbought' ? 'Перекуплен' : 'Нейтральный'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Поддержка</div>
                    <div className="text-lg font-semibold">{signalData.market_data.support}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Сопротивление</div>
                    <div className="text-lg font-semibold">{signalData.market_data.resistance}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => router.push('/search')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-3 text-lg"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Искать новый сигнал
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/my-signals')}
              className="border-gray-700 hover:bg-gray-800 px-8 py-3 text-lg"
            >
              <History className="w-4 h-4 mr-2" />
              Перейти в историю
            </Button>
          </div>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-300">
                Торговля на финансовых рынках сопряжена с риском. Это не инвестиционная рекомендация.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}