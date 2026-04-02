"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface OTCSignal {
  id: number;
  symbol: string;
  signal_type: 'call' | 'put';
  strength: 'strong' | 'medium' | 'weak';
  confidence: number;
  current_price: number;
  rsi?: number;
  macd?: number;
  trend_short?: string;
  pattern_detected?: string;
  notes?: string;
  status: 'active' | 'completed' | 'cancelled';
  result?: 'win' | 'loss' | 'draw';
  created_at: string;
  expires_at?: string;
}

interface OTCSignalsProps {
  className?: string;
}

export const OTCSignals: React.FC<OTCSignalsProps> = ({ className }) => {
  const router = useRouter();
  const [signals, setSignals] = useState<OTCSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'call' | 'put'>('all');
  const [selectedSignal, setSelectedSignal] = useState<OTCSignal | null>(null);

  // Загрузка сигналов
  const loadSignals = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/otc?status=active&limit=20');
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error:', errorData);
        
        if (response.status === 401) {
          // Не авторизован - показываем сообщение
          setSignals([]);
          return;
        }
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSignals(data.signals || []);
      } else {
        console.error('Error loading signals:', data.error);
        setSignals([]);
      }
    } catch (error) {
      console.error('Error loading OTC signals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignals();
    const interval = setInterval(loadSignals, 30000); // Обновление каждые 30 секунд
    return () => clearInterval(interval);
  }, []);

  // Фильтрация сигналов
  const filteredSignals = signals.filter(signal => {
    if (filter === 'all') return true;
    return signal.signal_type === filter;
  });

  // Получение иконки сигнала
  const getSignalIcon = (signal: OTCSignal) => {
    if (signal.signal_type === 'call') {
      return <ArrowUpRight className="w-6 h-6 text-green-500" />;
    }
    return <ArrowDownRight className="w-6 h-6 text-red-500" />;
  };

  // Получение цвета силы сигнала
  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return 'text-green-500 bg-green-500/10 border-green-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'weak': return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
      default: return 'text-gray-500';
    }
  };

  // Получение статуса
  const getStatusBadge = (signal: OTCSignal) => {
    if (signal.result) {
      if (signal.result === 'win') {
        return (
          <div className="flex items-center gap-1 text-green-500">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Win</span>
          </div>
        );
      }
      if (signal.result === 'loss') {
        return (
          <div className="flex items-center gap-1 text-red-500">
            <XCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Loss</span>
          </div>
        );
      }
    }
    
    if (signal.status === 'active') {
      return (
        <div className="flex items-center gap-1 text-blue-500">
          <Activity className="w-4 h-4" />
          <span className="text-xs font-medium">Active</span>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">OTC Сигналы</h2>
            <p className="text-sm text-gray-400">
              {filteredSignals.length} активных сигналов
            </p>
          </div>
        </div>

        <Button
          onClick={loadSignals}
          size="sm"
          variant="outline"
          className="border-gray-700 hover:border-gray-600"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Обновить
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          onClick={() => setFilter('all')}
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          className={cn(
            "flex-1",
            filter === 'all' 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'border-gray-700 hover:border-gray-600'
          )}
        >
          Все
        </Button>
        <Button
          onClick={() => setFilter('call')}
          size="sm"
          variant={filter === 'call' ? 'default' : 'outline'}
          className={cn(
            "flex-1",
            filter === 'call' 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'border-gray-700 hover:border-gray-600'
          )}
        >
          <ArrowUpRight className="w-4 h-4 mr-2" />
          Call
        </Button>
        <Button
          onClick={() => setFilter('put')}
          size="sm"
          variant={filter === 'put' ? 'default' : 'outline'}
          className={cn(
            "flex-1",
            filter === 'put' 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'border-gray-700 hover:border-gray-600'
          )}
        >
          <ArrowDownRight className="w-4 h-4 mr-2" />
          Put
        </Button>
      </div>

      {/* Signals List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
            <p>Загрузка сигналов...</p>
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Сигналов пока нет</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredSignals.map((signal) => (
              <motion.div
                key={signal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onClick={() => setSelectedSignal(signal)}
                className="bg-gradient-to-r from-gray-900/50 to-black/50 border border-white/10 rounded-xl p-4 hover:border-blue-500/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  {/* Left: Symbol & Signal */}
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-lg border",
                      signal.signal_type === 'call' 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-red-500/10 border-red-500/30'
                    )}>
                      {getSignalIcon(signal)}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white">{signal.symbol}</h3>
                        {getStatusBadge(signal)}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium border",
                          getStrengthColor(signal.strength)
                        )}>
                          {signal.strength === 'strong' && 'Сильный'}
                          {signal.strength === 'medium' && 'Средний'}
                          {signal.strength === 'weak' && 'Слабый'}
                        </span>
                        <span>Уверенность: {signal.confidence}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Indicators */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">
                      {signal.current_price.toFixed(5)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {signal.rsi && (
                        <span>RSI: {signal.rsi.toFixed(1)}</span>
                      )}
                      {signal.trend_short && (
                        <span className={cn(
                          signal.trend_short === 'up' ? 'text-green-400' : 'text-red-400'
                        )}>
                          {signal.trend_short === 'up' ? '↑' : '↓'} {signal.trend_short}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar for confidence */}
                <div className="mt-3">
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${signal.confidence}%` }}
                      transition={{ duration: 0.5 }}
                      className={cn(
                        "h-full rounded-full",
                        signal.confidence >= 80 ? 'bg-green-500' :
                        signal.confidence >= 60 ? 'bg-yellow-500' :
                        'bg-red-500'
                      )}
                    />
                  </div>
                </div>

                {/* Additional info */}
                {(signal.pattern_detected || signal.notes) && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <BarChart3 className="w-3 h-3" />
                      {signal.pattern_detected && (
                        <span>Паттерн: {signal.pattern_detected}</span>
                      )}
                      {signal.notes && (
                        <span>• {signal.notes}</span>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Signal Detail Modal */}
      {selectedSignal && (
        <SignalDetailModal
          signal={selectedSignal}
          onClose={() => setSelectedSignal(null)}
        />
      )}
    </div>
  );
};

// Modal component for signal details
const SignalDetailModal: React.FC<{
  signal: OTCSignal;
  onClose: () => void;
}> = ({ signal, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-gray-800 p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-3 rounded-lg",
              signal.signal_type === 'call' 
                ? 'bg-green-500/20' 
                : 'bg-red-500/20'
            )}>
              {signal.signal_type === 'call' ? (
                <ArrowUpRight className="w-6 h-6 text-green-500" />
              ) : (
                <ArrowDownRight className="w-6 h-6 text-red-500" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{signal.symbol}</h3>
              <p className="text-sm text-gray-400">
                {signal.signal_type.toUpperCase()} Signal
              </p>
            </div>
          </div>
          <Button
            onClick={onClose}
            size="sm"
            variant="outline"
            className="border-gray-700"
          >
            <XCircle className="w-5 h-5" />
          </Button>
        </div>

        {/* Main Info */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Цена входа</div>
              <div className="text-lg font-bold text-white">
                {signal.current_price.toFixed(5)}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Уверенность</div>
              <div className="text-lg font-bold text-white">
                {signal.confidence}%
              </div>
            </div>
          </div>

          {/* Indicators */}
          <div className="bg-gray-800/30 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-300">Индикаторы</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-gray-400 text-xs">RSI</div>
                <div className="font-medium text-white">
                  {signal.rsi?.toFixed(1) || '-'}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">MACD</div>
                <div className="font-medium text-white">
                  {signal.macd?.toFixed(4) || '-'}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Тренд</div>
                <div className={cn(
                  "font-medium",
                  signal.trend_short === 'up' ? 'text-green-400' :
                  signal.trend_short === 'down' ? 'text-red-400' :
                  'text-gray-400'
                )}>
                  {signal.trend_short || '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Pattern */}
          {signal.pattern_detected && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-400">
                  Паттерн: {signal.pattern_detected}
                </span>
              </div>
            </div>
          )}

          {/* Time info */}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>
              Создан: {new Date(signal.created_at).toLocaleString('ru-RU')}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                // Logic for following the signal
                onClose();
              }}
            >
              Следовать сигналу
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-gray-700"
              onClick={onClose}
            >
              Закрыть
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
