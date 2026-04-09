"use client";
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, TrendingUp, TrendingDown, Target, Clock, Globe, BarChart, Cpu, Shield,
  CheckCircle, AlertCircle, History, Star, Copy, Download, Check, Brain
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/app/contexts/LanguageContext';

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
  const [signalData, setSignalData] = useState<any>(null);
  const [expirationInfo, setExpirationInfo] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const signalParam = searchParams.get('signal');
  const marketParam = searchParams.get('market');
  const timeframeParam = searchParams.get('timeframe');
  const aiParam = searchParams.get('ai');

  useEffect(() => {
    if (signalParam) {
      try {
        const decodedSignal = decodeURIComponent(escape(atob(signalParam)));
        const parsed = JSON.parse(decodedSignal);
        setExpirationInfo({
          expiration: parsed.expiration,
          expiry_minutes: parsed.expiry_minutes,
          expiry_time: parsed.expiry_time
        });
        setSignalData(parsed);
      } catch (e) {
        console.error('❌ Ошибка парсинга сигнала:', e);
        setSignalData(null);
      }
    }
    setIsLoading(false);
  }, [signalParam]);

  // Сохранение в историю
  useEffect(() => {
    if (signalData) {
      saveSignalToHistory(signalData);
      setIsFavorite(checkIsFavorite(signalData.signal_id));
    }
  }, [signalData]);

  const saveSignalToHistory = (signal: any) => {
    try {
      const history = JSON.parse(localStorage.getItem('neura_signals_history') || '[]');
      const exists = history.some((s: any) => s.signal_id === signal.signal_id);
      
      if (!exists) {
        history.unshift({
          ...signal,
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
  };

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
    const dataStr = JSON.stringify(signalData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `signal_${signalData.signal_id}.json`);
    linkElement.click();
    showToastMessage(t('signalFoundExtended.signalExported'), 'success');
  };

  const getMarketName = (market: string) => {
    const markets: Record<string, { name: string; icon: any; color: string }> = {
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
  const MarketIcon = marketInfo.icon;
  const isBuy = signalData.direction === 'BUY';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white relative overflow-hidden">
      {/* Фоновая анимация с найденным сигналом */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${isBuy ? 'bg-green-500/10' : 'bg-red-500/10'}`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: Math.random() * 120 + 40,
              height: Math.random() * 120 + 40,
            }}
            animate={{
              y: [0, -40, 0],
              opacity: [0.05, 0.2, 0.05],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: Math.random() * 6 + 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
        
        {/* Анимированные линии тренда */}
        <motion.div
          className="absolute w-full h-px"
          style={{
            top: '30%',
            background: isBuy
              ? 'linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.3), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.3), transparent)',
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute w-full h-px"
          style={{
            top: '60%',
            background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.2), transparent)',
          }}
          animate={{ x: ['100%', '-100%'] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        />
      </div>
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

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/Signals')} className="text-gray-400 hover:text-white hover:bg-gray-800">
              <ArrowLeft className="w-4 h-4 mr-2" />{t('signalFoundExtended.newSearch')}
            </Button>
            <Button variant="ghost" onClick={() => router.push('/my-signals')} className="text-gray-400 hover:text-white hover:bg-gray-800">
              <History className="w-4 h-4 mr-2" />{t('signalFoundExtended.history')}
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
              <BarChart className="w-4 h-4 text-cyan-400" />
              <span className="text-sm">{signalData.provider || 'AI'}</span>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {t('signalFoundExtended.signalGenerated')}
            </h1>
            <p className="text-gray-400">
              {t('signalFoundExtended.analysisComplete')} • {new Date(signalData.generated_at || Date.now()).toLocaleString('ru-RU')}
            </p>
          </div>

          {/* Основной сигнал */}
          <div className={`rounded-2xl p-6 md:p-8 mb-8 relative ${
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

            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    isBuy ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'
                  }`}>
                    {isBuy ? <TrendingUp className="w-8 h-8 text-white" /> : <TrendingDown className="w-8 h-8 text-white" />}
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold">
                      {isBuy ? t('signalFoundExtended.buying') : t('signalFoundExtended.selling')}
                    </h2>
                    <div className="text-lg md:text-xl font-semibold">{signalData.pair}</div>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/50">
                  <div className={`w-3 h-3 rounded-full ${
                    parseInt(signalData.confidence) >= 75 ? 'bg-green-500' :
                    parseInt(signalData.confidence) >= 65 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}></div>
                  <span className="font-semibold">{signalData.confidence || '75%'} {t('signalFoundExtended.confidence')}</span>
                </div>
              </div>

              <div className="bg-black/30 rounded-xl p-6 min-w-[200px]">
                <div className="text-center">
                  <div className="text-sm text-gray-400 mb-2">{t('signalFoundExtended.expirationTime')}</div>
                  <div className="text-2xl font-bold flex items-center justify-center gap-2">
                    <Clock className="w-6 h-6 text-yellow-400" />
                    {formatExpiration(signalData.expiration)}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">{t('signalFoundExtended.recommendedHoldTime')}</div>
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
                <li>• {t('signalFoundExtended.holdTime')} <span className="text-yellow-400 font-medium">{formatExpiration(signalData.expiration)}</span></li>
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
