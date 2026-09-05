"use client";
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, TrendingUp, TrendingDown, Target, Globe, BarChart, Cpu, Shield,
  CheckCircle, AlertCircle, History, Star, Copy, Download, Check, Brain, XCircle, Clock
} from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { TradingBackground } from '@/components/TradingBackground';

type SignalResultState = 'pending' | 'win' | 'loss' | 'draw';

type SignalPayload = {
  signal_id: string;
  db_signal_id?: number;
  direction: 'BUY' | 'SELL';
  pair: string;
  expiration: string;
  expiry_minutes?: number;
  expiry_time?: string;
  expiry_timestamp?: string;
  provider?: string;
  market?: string;
  entry_price: string;
  take_profit: string;
  stop_loss: string;
  signal_strength?: string;
  success_confidence?: number;
  reasoning: string;
  market_data?: {
    current_price?: string;
    trend?: string;
    rsi?: number;
  };
  resolved_result?: SignalResultState;
  resolved_profit_loss?: number | null;
  completed_at?: string;
};

type StoredSignalHistoryItem = SignalPayload & {
  id: number;
  status: string;
  saved_at: string;
  viewed_at: string;
};

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
  const { t, language } = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [signalData, setSignalData] = useState<SignalPayload | null>(null);
  const [expirationInfo, setExpirationInfo] = useState<{
    expiration?: string;
    expiry_minutes?: number;
    expiry_time?: string;
    expiry_timestamp?: string;
  } | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [signalResult, setSignalResult] = useState<SignalResultState>('pending');
  const [signalProfitLoss, setSignalProfitLoss] = useState<number | null>(null);
  const [isCheckingResult, setIsCheckingResult] = useState(false);
  const [showResultAnimation, setShowResultAnimation] = useState(false);
  
  // Countdown states
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [entryDeadline, setEntryDeadline] = useState<string>('');
  const [entryTimeLeft, setEntryTimeLeft] = useState<string>('');
  const [entryProgressPercent, setEntryProgressPercent] = useState<number>(100);
  
  // Ref для хранения времени экспирации (не сбрасывается при ререндере)
  const expiryTimeRef = useRef<number>(0);
  // Ref для отслеживания, был ли уже вызов проверки после экспирации
  const expiryCheckTriggeredRef = useRef<boolean>(false);

  const signalParam = searchParams.get('signal');
  const marketParam = searchParams.get('market');
  const timeframeParam = searchParams.get('timeframe');

  useEffect(() => {
    if (signalParam) {
      try {
        const decodedSignal = decodeURIComponent(escape(atob(signalParam)));
        const parsed = JSON.parse(decodedSignal);
        setExpirationInfo({
          expiration: parsed.expiration,
          expiry_minutes: parsed.expiry_minutes,
          expiry_time: parsed.expiry_time,
          expiry_timestamp: parsed.expiry_timestamp
        });
        setSignalData(parsed);
        setSignalResult('pending');
        setSignalProfitLoss(null);
        // Сбрасываем ref для нового сигнала
        expiryTimeRef.current = 0;
      } catch (e) {
        console.error('❌ Ошибка парсинга сигнала:', e);
        setSignalData(null);
      }
    }
    setIsLoading(false);
  }, [signalParam]);

  // Countdown timer logic
  useEffect(() => {
    if (!signalData || !expirationInfo?.expiry_minutes) return;

    const now = Date.now();
    const expiryMinutes = expirationInfo.expiry_minutes;

    // Если время ещё не установлено или сигнал новый - пересчитываем
    if (expiryTimeRef.current === 0 || expiryTimeRef.current < now) {
      // Проверяем есть ли готовый expiry_timestamp в будущем
      if (expirationInfo?.expiry_timestamp) {
        const timestamp = new Date(expirationInfo.expiry_timestamp).getTime();
        if (timestamp > now) {
          expiryTimeRef.current = timestamp;
        } else {
          // Timestamp в прошлом - считаем от текущего момента
          expiryTimeRef.current = now + expiryMinutes * 60 * 1000;
        }
      } else {
        // Считаем от текущего момента: сейчас + expiry_minutes
        expiryTimeRef.current = now + expiryMinutes * 60 * 1000;
      }
    }

    // Рассчитываем время входа (первая 1/3 от длительности сигнала)
    const signalDuration = expiryMinutes * 60 * 1000; // в мс
    const entryStartTime = expiryTimeRef.current - signalDuration;
    const entryDeadlineTime = entryStartTime + (signalDuration / 3);
    const entryDuration = entryDeadlineTime - entryStartTime;

    const updateCountdown = async () => {
      const now = Date.now();

      // Форматируем время экспирации в ЧЧ:ММ UTC+0
      const expiryDate = new Date(expiryTimeRef.current);
      const expiryHours = expiryDate.getUTCHours().toString().padStart(2, '0');
      const expiryMinutesStr = expiryDate.getUTCMinutes().toString().padStart(2, '0');
      setTimeRemaining(`${expiryHours}:${expiryMinutesStr}`);

      // Прогресс для времени входа (первая 1/3 от длительности сигнала)
      const entryTimeElapsed = now - entryStartTime;
      const entryProgress = Math.max(0, Math.min(100, ((entryDuration - entryTimeElapsed) / entryDuration) * 100));

      if (now >= entryDeadlineTime) {
        setEntryTimeLeft('00:00');
        setEntryDeadline('Время входа истекло');
        setEntryProgressPercent(0);
      } else {
        // Осталось времени для входа
        const entryTimeDiff = entryDeadlineTime - now;
        const entryMinutes = Math.floor(entryTimeDiff / 60000);
        const entrySeconds = Math.floor((entryTimeDiff % 60000) / 1000);
        const formatted = `${entryMinutes.toString().padStart(2, '0')}:${entrySeconds.toString().padStart(2, '0')}`;
        setEntryTimeLeft(formatted);

        // Время до которого можно войти (UTC+0)
        const deadlineDate = new Date(entryDeadlineTime);
        const deadlineHours = deadlineDate.getUTCHours().toString().padStart(2, '0');
        const deadlineMinutes = deadlineDate.getUTCMinutes().toString().padStart(2, '0');
        setEntryDeadline(`${deadlineHours}:${deadlineMinutes}`);

        // Процент для прогресс-бара
        setEntryProgressPercent(entryProgress);
      }

      // Проверяем, если сигнал экспирировал - сразу запускаем проверку результата через Pocket Option async
      if (now >= expiryTimeRef.current && signalResult === 'pending' && !expiryCheckTriggeredRef.current) {
        expiryCheckTriggeredRef.current = true;
        setTimeRemaining('00:00');
        
        // Сразу вызываем проверку результата через API Pocket Option
        await checkSignalResultImmediately();
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [signalData, expirationInfo]);

  // Функция для мгновенной проверки результата сигнала через Pocket Option API
  const checkSignalResultImmediately = async () => {
    const dbSignalId = signalData?.db_signal_id;
    if (!dbSignalId) return;

    try {
      setIsCheckingResult(true);
      
      // Делаем несколько попыток с интервалом, так как результат может появиться не сразу
      let attempts = 0;
      const maxAttempts = 12; // 12 попычек с интервалом 5 секунд = 1 минута
      const attemptInterval = 5000; // 5 секунд между попытками

      const checkAttempt = async () => {
        attempts++;
        
        const response = await fetch(`/api/po/signal/${dbSignalId}`, {
          credentials: 'include',
          cache: 'no-store',
        });

        const data = await response.json();
        
        if (!response.ok || !data.success || !data.signal) {
          return false;
        }

        const nextResult = (data.signal.result || 'pending') as SignalResultState;
        const nextProfitLoss = typeof data.signal.profit_loss === 'number' ? data.signal.profit_loss : null;

        // Обновляем состояние результата
        setSignalResult(nextResult);
        setSignalProfitLoss(nextProfitLoss);

        // Если результат получен - обновляем данные и сохраняем в историю
        if (nextResult !== 'pending') {
          // Показываем анимацию результата
          setShowResultAnimation(true);
          
          setSignalData((prev) => prev ? {
            ...prev,
            resolved_result: nextResult,
            resolved_profit_loss: nextProfitLoss,
            completed_at: data.signal.completed_at,
          } : prev);

          // Сохраняем в localStorage
          try {
            const history: StoredSignalHistoryItem[] = JSON.parse(localStorage.getItem('neura_signals_history') || '[]');
            const updated = history.map((item) =>
              item.signal_id === signalData.signal_id
                ? {
                    ...item,
                    status: nextResult,
                    resolved_result: nextResult,
                    resolved_profit_loss: nextProfitLoss,
                    completed_at: data.signal.completed_at,
                  }
                : item
            );
            localStorage.setItem('neura_signals_history', JSON.stringify(updated));
          } catch (error) {
            console.error('❌ Ошибка обновления истории сигнала:', error);
          }

          // Показываем уведомление о результате
          if (nextResult === 'win') {
            showToastMessage(
              language === 'ru' 
                ? `🎉 WIN! +${nextProfitLoss?.toFixed(2) || ''}` 
                : `🎉 WIN! +${nextProfitLoss?.toFixed(2) || ''}`,
              'success'
            );
          } else if (nextResult === 'loss') {
            showToastMessage(
              language === 'ru' 
                ? `❌ LOSS ${nextProfitLoss?.toFixed(2) || ''}` 
                : `❌ LOSS ${nextProfitLoss?.toFixed(2) || ''}`,
              'error'
            );
          }

          // Скрываем анимацию через 5 секунд
          setTimeout(() => {
            setShowResultAnimation(false);
          }, 5000);

          return true;
        }

        return false;
      };

      // Первая попытка сразу
      const result = await checkAttempt();
      
      // Если результат не получен - продолжаем попытки
      if (!result) {
        const intervalId = setInterval(async () => {
          if (attempts >= maxAttempts) {
            clearInterval(intervalId);
            return;
          }
          
          const success = await checkAttempt();
          if (success) {
            clearInterval(intervalId);
          }
        }, attemptInterval);
      }
    } catch (error) {
      console.error('❌ Ошибка проверки результата сигнала:', error);
    } finally {
      setIsCheckingResult(false);
    }
  };

  useEffect(() => {
    const dbSignalId = signalData?.db_signal_id;
    if (!dbSignalId) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchSignalResult = async () => {
      try {
        setIsCheckingResult(true);
        const response = await fetch(`/api/po/signal/${dbSignalId}`, {
          credentials: 'include',
          cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok || !data.success || !data.signal || cancelled) {
          return;
        }

        const nextResult = (data.signal.result || 'pending') as SignalResultState;
        setSignalResult(nextResult);
        setSignalProfitLoss(typeof data.signal.profit_loss === 'number' ? data.signal.profit_loss : null);

        if (nextResult !== 'pending') {
          setSignalData((prev) => prev ? {
            ...prev,
            resolved_result: nextResult,
            resolved_profit_loss: data.signal.profit_loss,
            completed_at: data.signal.completed_at,
          } : prev);

          try {
            const history: StoredSignalHistoryItem[] = JSON.parse(localStorage.getItem('neura_signals_history') || '[]');
            const updated = history.map((item) =>
              item.signal_id === signalData.signal_id
                ? {
                    ...item,
                    status: nextResult,
                    resolved_result: nextResult,
                    resolved_profit_loss: data.signal.profit_loss,
                    completed_at: data.signal.completed_at,
                  }
                : item
            );
            localStorage.setItem('neura_signals_history', JSON.stringify(updated));
          } catch (error) {
            console.error('❌ Ошибка обновления истории сигнала:', error);
          }

          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      } catch (error) {
        console.error('❌ Ошибка проверки результата сигнала:', error);
      } finally {
        if (!cancelled) {
          setIsCheckingResult(false);
        }
      }
    };

    void fetchSignalResult();
    intervalId = setInterval(fetchSignalResult, 5000);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [signalData?.db_signal_id, signalData?.signal_id]);

  // Сохранение в историю
  useEffect(() => {
    if (!signalData) {
      return;
    }

    try {
      const history: StoredSignalHistoryItem[] = JSON.parse(localStorage.getItem('neura_signals_history') || '[]');
      const exists = history.some((s) => s.signal_id === signalData.signal_id);

      if (!exists) {
        history.unshift({
          ...signalData,
          id: history.length + 1,
          status: 'active',
          saved_at: new Date().toISOString(),
          viewed_at: new Date().toISOString()
        });

        if (history.length > 100) history.pop();
        localStorage.setItem('neura_signals_history', JSON.stringify(history));
        showToastMessage(t('signalFoundExtended.signalSaved'), 'success');
      }
    } catch (error) {
      console.error('❌ Ошибка сохранения:', error);
    }

    setIsFavorite(checkIsFavorite(signalData.signal_id));
  }, [signalData, t]);

  const checkIsFavorite = (signalId: string) => {
    try {
      const favorites = JSON.parse(localStorage.getItem('neura_favorite_signals') || '[]');
      return favorites.includes(signalId);
    } catch {
      return false;
    }
  };

  const toggleFavorite = (signalId: string) => {
    try {
      const favorites = JSON.parse(localStorage.getItem('neura_favorite_signals') || '[]');
      
      if (favorites.includes(signalId)) {
        localStorage.setItem('neura_favorite_signals', JSON.stringify(favorites.filter((id: string) => id !== signalId)));
        setIsFavorite(false);
        showToastMessage(t('signalFoundExtended.signalRemoved'), 'info');
      } else {
        favorites.push(signalId);
        localStorage.setItem('neura_favorite_signals', JSON.stringify(favorites));
        setIsFavorite(true);
        showToastMessage(t('signalFoundExtended.signalAddedFavorite'), 'success');
      }
    } catch (error) {
      console.error('Ошибка:', error);
    }
  };

  const showToastMessage = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const copySignal = () => {
    navigator.clipboard.writeText(JSON.stringify(signalData, null, 2));
    showToastMessage(t('signalFoundExtended.copiedClipboard'), 'success');
  };

  const exportSignal = () => {
    if (!signalData) return;
    const dataStr = JSON.stringify(signalData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `signal_${signalData.signal_id}.json`);
    linkElement.click();
    showToastMessage(t('signalFoundExtended.signalExported'), 'success');
  };

  const getMarketName = (market: string) => {
    const markets: Record<string, { name: string; icon: typeof Globe; color: string }> = {
      'otc': { name: t('signalFoundExtended.otcMarket'), icon: Globe, color: 'text-blue-400' },
      'demo': { name: t('signalFoundExtended.demo'), icon: Cpu, color: 'text-purple-400' },
      'market': { name: t('signalFoundExtended.market'), icon: BarChart, color: 'text-green-400' }
    };
    return markets[market || 'demo'] || { name: market, icon: Globe, color: 'text-gray-400' };
  };

  const formatExpiration = (expiration: string) => {
    const match = expiration.match(/(\d+)\s*(минут|минута|minute|minutes)?/i);
    if (match) {
      const num = parseInt(match[1]);
      if (language === 'ru') {
        const form = num === 1 ? 'минута' : num >= 2 && num <= 4 ? 'минуты' : 'минут';
        return `${num} ${form}`;
      }
      return `${num} ${num === 1 ? 'minute' : 'minutes'}`;
    }
    return expiration;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-blue-500/30 rounded-full"></div>
            <div className="absolute top-0 left-0 w-24 h-24 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-2xl font-bold mt-8 mb-2">{t('signalFoundExtended.aiAnalyzing')}</h2>
          <p className="text-gray-400">{t('signalFoundExtended.generatingOptimal')}</p>
        </div>
      </div>
    );
  }

  if (!signalData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <AlertCircle className="w-20 h-20 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4 text-red-300">{t('signalFoundExtended.errorLoading')}</h2>
          <p className="text-gray-400 mb-8">{t('signalFoundExtended.failedLoadSignal')}</p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => router.push('/Signals')} className="bg-gradient-to-r from-blue-600 to-purple-600">
              <ArrowLeft className="w-4 h-4 mr-2" />{t('signalFoundExtended.backToSearch')}
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()} className="border-gray-700">
              {t('signalFoundExtended.tryAgain')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const marketInfo = getMarketName(marketParam || signalData.market || 'demo');
  const isBuy = signalData.direction === 'BUY';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white relative">
      {/* Trading фон */}
      <TradingBackground variant="signal" signalType={isBuy ? 'BUY' : 'SELL'} />
      
      {/* Полноэкранная анимация результата */}
      {showResultAnimation && signalResult !== 'pending' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className={`absolute inset-0 ${
            signalResult === 'win' 
              ? 'bg-green-500/10' 
              : signalResult === 'loss' 
              ? 'bg-red-500/10' 
              : 'bg-yellow-500/10'
          } animate-pulse`} />
          <div className={`relative transform scale-100 animate-bounce`}>
            <div className={`text-center p-12 rounded-3xl backdrop-blur-xl border-4 ${
              signalResult === 'win'
                ? 'bg-green-900/80 border-green-500 shadow-2xl shadow-green-500/50'
                : signalResult === 'loss'
                ? 'bg-red-900/80 border-red-500 shadow-2xl shadow-red-500/50'
                : 'bg-yellow-900/80 border-yellow-500 shadow-2xl shadow-yellow-500/50'
            }`}>
              {signalResult === 'win' && (
                <>
                  <CheckCircle className="w-32 h-32 text-green-400 mx-auto mb-6 animate-pulse" />
                  <div className="text-6xl font-bold text-green-400 mb-4">WIN</div>
                  {signalProfitLoss !== null && (
                    <div className="text-4xl font-bold text-green-300">
                      +{signalProfitLoss.toFixed(2)}
                    </div>
                  )}
                </>
              )}
              {signalResult === 'loss' && (
                <>
                  <XCircle className="w-32 h-32 text-red-400 mx-auto mb-6 animate-pulse" />
                  <div className="text-6xl font-bold text-red-400 mb-4">LOSS</div>
                  {signalProfitLoss !== null && (
                    <div className="text-4xl font-bold text-red-300">
                      {signalProfitLoss.toFixed(2)}
                    </div>
                  )}
                </>
              )}
              {signalResult === 'draw' && (
                <>
                  <AlertCircle className="w-32 h-32 text-yellow-400 mx-auto mb-6" />
                  <div className="text-6xl font-bold text-yellow-400 mb-4">DRAW</div>
                  {signalProfitLoss !== null && (
                    <div className="text-4xl font-bold text-yellow-300">
                      {signalProfitLoss.toFixed(2)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {showToast && (
        <div className="fixed top-24 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border ${
            toastType === 'success' ? 'bg-green-900/90 border-green-700' :
            toastType === 'error' ? 'bg-red-900/90 border-red-700' : 'bg-blue-900/90 border-blue-700'
          } backdrop-blur-sm`}>
            {toastType === 'success' ? <Check className="w-5 h-5 text-green-400" /> :
             toastType === 'error' ? <AlertCircle className="w-5 h-5 text-red-400" /> :
             <History className="w-5 h-5 text-blue-400" />}
            <span className="text-white">{toastMessage}</span>
          </div>
        </div>
      )}

      <div className="relative z-10 min-h-screen flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-4xl mx-auto">
          {/* Кнопки навигации */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push('/Signals')}
              className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl px-6 py-2 border border-gray-700/50 hover:border-gray-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {language === 'ru' ? 'Новый поиск' : 'New Search'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/my-signals')}
              className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl px-6 py-2 border border-gray-700/50 hover:border-gray-600"
            >
              <History className="w-4 h-4 mr-2" />
              {language === 'ru' ? 'История' : 'History'}
            </Button>
          </div>

          {/* Заголовок */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {language === 'ru' ? 'Сигнал сгенерирован' : 'Signal Generated'}
            </h1>
            <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
              <div className="px-3 py-1.5 bg-gray-800/50 rounded-lg">
                <span className="font-medium">{marketInfo.name}</span>
              </div>
              <div className="px-3 py-1.5 bg-gray-800/50 rounded-lg">
                <span className="font-medium">{timeframeParam || signalData.expiration || '5 min'}</span>
              </div>
              <div className="px-3 py-1.5 bg-gray-800/50 rounded-lg">
                <span className="font-medium">{signalData.provider || 'AI'}</span>
              </div>
            </div>
          </div>

          {/* Результат сигнала - WIN/LOSE/DRAW */}
          <div className={`rounded-2xl border px-5 py-4 mb-6 backdrop-blur-sm transition-all duration-500 ${
            signalResult === 'win'
              ? 'bg-green-900/30 border-green-500/60 shadow-lg shadow-green-500/20'
              : signalResult === 'loss'
              ? 'bg-red-900/30 border-red-500/60 shadow-lg shadow-red-500/20'
              : signalResult === 'draw'
              ? 'bg-yellow-900/30 border-yellow-500/60 shadow-lg shadow-yellow-500/20'
              : 'bg-gray-900/40 border-gray-700/40'
          }`}>
            <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
              <div className="flex items-center gap-3">
                {signalResult === 'win' && (
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 animate-pulse">
                    <CheckCircle className="w-7 h-7 text-green-400" />
                  </div>
                )}
                {signalResult === 'loss' && (
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 animate-pulse">
                    <XCircle className="w-7 h-7 text-red-400" />
                  </div>
                )}
                {signalResult === 'draw' && (
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500/20">
                    <AlertCircle className="w-7 h-7 text-yellow-400" />
                  </div>
                )}
                {signalResult === 'pending' && !isCheckingResult && (
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-700/30">
                    <Clock className="w-7 h-7 text-gray-400" />
                  </div>
                )}
                {isCheckingResult && signalResult === 'pending' && (
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20">
                    <div className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                    {language === 'ru' ? 'Статус сигнала' : 'Signal status'}
                  </div>
                  <div className={`text-2xl font-bold ${
                    signalResult === 'win'
                      ? 'text-green-400'
                      : signalResult === 'loss'
                      ? 'text-red-400'
                      : signalResult === 'draw'
                      ? 'text-yellow-400'
                      : 'text-white'
                  }`}>
                    {signalResult === 'win' ? '✓ WIN' :
                     signalResult === 'loss' ? '✗ LOSS' :
                     signalResult === 'draw' ? '⚠ DRAW' :
                     (isCheckingResult
                       ? (language === 'ru' ? 'Проверяем результат...' : 'Checking result...')
                       : (language === 'ru' ? 'Ожидаем экспирацию...' : 'Waiting for expiry...'))}
                  </div>
                </div>
              </div>
              {signalProfitLoss !== null && signalResult !== 'pending' && (
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                    {language === 'ru' ? 'Результат' : 'P/L'}
                  </div>
                  <div className={`text-3xl font-bold ${signalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {signalProfitLoss >= 0 ? '+' : ''}{signalProfitLoss.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Основной сигнал */}
          <div className={`rounded-2xl p-6 md:p-8 mb-6 relative ${
            isBuy ? 'bg-gradient-to-br from-green-900/20 to-emerald-900/10 border border-green-700/30'
                 : 'bg-gradient-to-br from-red-900/20 to-rose-900/10 border border-red-700/30'
          }`}>
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleFavorite(signalData.signal_id)}
                className={`border-gray-700 ${isFavorite ? 'text-yellow-400 border-yellow-700/50' : 'text-gray-400'}`}>
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400' : ''}`} />
              </Button>
              <Button size="sm" variant="outline" onClick={copySignal} className="border-gray-700 text-gray-400">
                <Copy className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={exportSignal} className="border-gray-700 text-gray-400">
                <Download className="w-4 h-4" />
              </Button>
            </div>

            {/* Тип сигнала и основная информация */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl ${
                  isBuy 
                    ? 'bg-gradient-to-br from-green-400 to-emerald-600 shadow-green-500/30' 
                    : 'bg-gradient-to-br from-red-400 to-rose-600 shadow-red-500/30'
                }`}>
                  {isBuy ? <TrendingUp className="w-10 h-10 text-white" /> : <TrendingDown className="w-10 h-10 text-white" />}
                </div>
                <div className="text-left">
                  <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    {isBuy ? (language === 'ru' ? 'ПОКУПКА' : 'BUY') : (language === 'ru' ? 'ПРОДАЖА' : 'SELL')}
                  </h2>
                  <div className="text-xl font-semibold text-gray-300">{signalData.pair}</div>
                </div>
              </div>

              {/* Уверенность успешности сигнала */}
              {signalData.success_confidence && (
                <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800/40 border border-gray-700/30">
                  <div className={`w-2 h-2 rounded-full ${
                    signalData.success_confidence >= 75 ? 'bg-green-400' :
                    signalData.success_confidence >= 65 ? 'bg-yellow-400' : 'bg-orange-400'
                  }`} />
                  <span className="text-sm text-gray-300">
                    {language === 'ru' ? 'Успешность' : 'Success rate'}:
                    <span className="font-semibold text-white ml-1">{signalData.success_confidence}%</span>
                  </span>
                </div>
              )}
            </div>

            {/* Время экспирации и входа */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 max-w-xl mx-auto">
              {/* Экспирация */}
              <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/40">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
                    {language === 'ru' ? 'Экспирация (UTC+0)' : 'Expires (UTC+0)'}
                  </div>
                  <div className="text-3xl font-bold text-yellow-400 mb-1 font-mono tracking-wider">
                    {timeRemaining || '--:--'}
                  </div>
                  {signalData.expiry_minutes && (
                    <div className="text-xs text-gray-500">
                      {signalData.expiry_minutes} {language === 'ru' ? 'минут' : 'min'}
                    </div>
                  )}
                </div>
              </div>

              {/* Вход */}
              <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/40">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
                    {language === 'ru' ? 'Вход до (UTC+0)' : 'Entry by (UTC+0)'}
                  </div>
                  <div className={`text-3xl font-bold mb-2 font-mono tracking-wider ${
                    entryDeadline === 'Время входа истекло'
                      ? 'text-red-400'
                      : 'text-green-400'
                  }`}>
                    {entryDeadline || '--:--'}
                  </div>
                  
                  {/* Прогресс-бар */}
                  <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                        entryProgressPercent > 60 ? 'bg-green-500' :
                        entryProgressPercent > 40 ? 'bg-green-500/80' :
                        entryProgressPercent > 20 ? 'bg-yellow-500' :
                        entryProgressPercent > 0 ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${entryProgressPercent}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    {entryTimeLeft === '00:00' || entryDeadline === 'Время входа истекло'
                      ? (language === 'ru' ? 'Время входа прошло' : 'Entry time passed')
                      : `${entryTimeLeft} ${language === 'ru' ? 'осталось' : 'left'}`
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Цены */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-900/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">{t('signalFoundExtended.entryPrice')}</div>
                    <div className="text-xl font-bold">{signalData.entry_price}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">{t('signalFoundExtended.recommendedOpenPrice')}</div>
              </div>

              <div className="bg-gray-900/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">{t('signalFoundExtended.takeProfit')}</div>
                    <div className="text-xl font-bold text-green-400">{signalData.take_profit}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">{t('signalFoundExtended.targetExitPrice')}</div>
              </div>

              <div className="bg-gray-900/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-red-900/30 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">{t('signalFoundExtended.stopLoss')}</div>
                    <div className="text-xl font-bold text-red-400">{signalData.stop_loss}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">{t('signalFoundExtended.exitIfGoesAgainst')}</div>
              </div>
            </div>

            {/* Обоснование */}
            <div className="bg-gray-800/30 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold">{t('signalFoundExtended.aiAnalysis')}</h3>
              </div>
              <p className="text-gray-300">{signalData.reasoning}</p>
              
              {signalData.market_data && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{t('signalFoundExtended.currentPrice')}</div>
                    <div className="font-semibold">{signalData.market_data.current_price}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{t('signalFoundExtended.trend')}</div>
                    <div className="font-semibold">
                      {signalData.market_data.trend === 'bullish' ? t('signalFoundExtended.bullish') :
                       signalData.market_data.trend === 'bearish' ? t('signalFoundExtended.bearish') :
                       signalData.market_data.trend}
                    </div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">RSI</div>
                    <div className="font-semibold">{signalData.market_data.rsi || 'N/A'}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{t('signalFoundExtended.signalStrength')}</div>
                    <div className="font-semibold">
                      {signalData.signal_strength === 'strong' ? t('signalFoundExtended.strong') :
                       signalData.signal_strength === 'moderate' ? t('signalFoundExtended.moderate') :
                       signalData.signal_strength === 'weak' ? t('signalFoundExtended.weak') :
                       signalData.signal_strength}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Рекомендации */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-900/10 border border-green-700/30 rounded-xl p-6">
              <h3 className="font-semibold mb-3 text-green-300 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                {t('signalFoundExtended.recommendations')}
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• {t('signalFoundExtended.openAtPrice')} <span className="text-white font-medium">{signalData.entry_price}</span></li>
                <li>• {t('signalFoundExtended.closeAtProfit')} <span className="text-green-400 font-medium">{signalData.take_profit}</span></li>
                <li>• {t('signalFoundExtended.closeAtLoss')} <span className="text-red-400 font-medium">{signalData.stop_loss}</span></li>
                <li>• {t('signalFoundExtended.holdTime')} <span className="text-yellow-400 font-medium">{timeRemaining || formatExpiration(signalData.expiration)}</span></li>
                {entryDeadline && entryTimeLeft !== '00:00' && (
                  <li>• 🎯 {t('signalFoundExtended.entryDeadline')} <span className="text-blue-400 font-medium">до {entryDeadline}</span> <span className="text-gray-500">({entryTimeLeft})</span></li>
                )}
              </ul>
            </div>

            <div className="bg-blue-900/10 border border-blue-700/30 rounded-xl p-6">
              <h3 className="font-semibold mb-3 text-blue-300 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t('signalFoundExtended.riskManagement')}
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• {t('signalFoundExtended.useStopLoss')}</li>
                <li>• {t('signalFoundExtended.dontRiskMore')} <span className="text-white font-medium">2-5%</span> {t('signalFoundExtended.ofDeposit')}</li>
                <li>• {t('signalFoundExtended.followPlan')}</li>
                <li>• {t('signalFoundExtended.monitorMarket')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
