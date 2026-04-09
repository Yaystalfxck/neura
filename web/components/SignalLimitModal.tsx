"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, CreditCard, TrendingUp, AlertCircle, Check, ArrowRight, Star, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SignalLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  signalsUsed: number;
  signalsLimit: number;
  nextTierBalance?: number;
  currentBalance?: number;
}

export const SignalLimitModal: React.FC<SignalLimitModalProps> = ({
  isOpen,
  onClose,
  signalsUsed,
  signalsLimit,
  nextTierBalance,
  currentBalance = 0,
}) => {
  const requiredTopUp = nextTierBalance ? Math.max(0, nextTierBalance - currentBalance) : 0;

  const plans = [
    {
      name: 'Базовый',
      price: '$10',
      balance: '$50',
      signals: '3 сигнала/день',
      icon: TrendingUp,
      color: 'from-blue-500 to-cyan-500',
      popular: false,
    },
    {
      name: 'Про',
      price: '$25',
      balance: '$150',
      signals: '4 сигнала/день',
      icon: Star,
      color: 'from-purple-500 to-pink-500',
      popular: true,
    },
    {
      name: 'Премиум',
      price: '$50',
      balance: '$250',
      signals: '5 сигналов/день',
      icon: Crown,
      color: 'from-amber-500 to-orange-500',
      popular: false,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl sm:rounded-3xl border border-gray-700/50 shadow-2xl shadow-purple-500/10"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 transition-colors z-10"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>

            <div className="p-4 sm:p-6">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center mb-6"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mb-4 shadow-lg shadow-amber-500/25">
                  <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Лимит сигналов исчерпан
                </h2>
                <p className="text-gray-400 text-sm">
                  Вы использовали <span className="text-amber-400 font-semibold">{signalsUsed}</span> из{' '}
                  <span className="text-amber-400 font-semibold">{signalsLimit}</span> сигналов сегодня
                </p>
              </motion.div>

              {/* Current balance info */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-r from-gray-800/50 to-gray-800/30 rounded-xl p-4 mb-6 border border-gray-700/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <CreditCard className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Ваш баланс</div>
                      <div className="text-lg font-bold text-white">${currentBalance.toFixed(2)}</div>
                    </div>
                  </div>
                  {nextTierBalance && (
                    <div className="text-right">
                      <div className="text-xs text-gray-400">До следующего лимита</div>
                      <div className="text-lg font-bold text-amber-400">${nextTierBalance}</div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Plans */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-3 mb-6"
              >
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Доступные тарифы
                </h3>
                
                {plans.map((plan, index) => {
                  const Icon = plan.icon;
                  return (
                    <motion.div
                      key={plan.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className={`relative p-3 sm:p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${
                        plan.popular
                          ? 'border-purple-500/50 bg-gradient-to-r from-purple-900/20 to-pink-900/20'
                          : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-2 right-3 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-[10px] font-bold text-white">
                          ПОПУЛЯРНЫЙ
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${plan.color}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{plan.name}</div>
                          <div className="text-xs text-gray-400">{plan.signals}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm">{plan.price}</div>
                          <div className="text-xs text-gray-400">→ {plan.balance}</div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <Button
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-5 sm:py-6 rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/25"
                  onClick={() => {
                    // Redirect to top-up page
                    window.location.href = '/profile?tab=balance';
                  }}
                >
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Пополнить баланс
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                </Button>
                
                <button
                  onClick={onClose}
                  className="w-full py-3 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Закрыть
                </button>
              </motion.div>

              {/* Additional info */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-4 p-3 bg-blue-900/10 border border-blue-700/30 rounded-lg"
              >
                <p className="text-xs text-gray-400 text-center">
                  💡 Лимиты обновляются ежедневно в 00:00 UTC. Или пополните баланс для увеличения лимита.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
