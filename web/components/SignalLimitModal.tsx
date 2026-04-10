"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, CreditCard, TrendingUp, AlertCircle, Check, ArrowRight, Star, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface SignalLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  signalsUsed: number;
  signalsLimit: number;
  nextTierBalance?: number;
  currentBalance?: number;
  referralsCount?: number;
  referralBonus?: number;
  referralTiers?: Array<{min_referrals: number; bonus: number}>;
}

export const SignalLimitModal: React.FC<SignalLimitModalProps> = ({
  isOpen,
  onClose,
  signalsUsed,
  signalsLimit,
  nextTierBalance,
  currentBalance = 0,
  referralsCount = 0,
  referralBonus = 0,
  referralTiers = [],
}) => {
  const { t } = useLanguage();
  const requiredTopUp = nextTierBalance ? Math.max(0, nextTierBalance - currentBalance) : 0;

  const plans = [
    {
      name: t('signals.limitModalBasic'),
      price: '$10',
      balance: '$50',
      signals: t('signals.limitModalBasicSignals'),
      icon: TrendingUp,
      color: 'from-blue-500 to-cyan-500',
      popular: false,
    },
    {
      name: t('signals.limitModalPro'),
      price: '$25',
      balance: '$150',
      signals: t('signals.limitModalProSignals'),
      icon: Star,
      color: 'from-purple-500 to-pink-500',
      popular: true,
    },
    {
      name: t('signals.limitModalPremium'),
      price: '$50',
      balance: '$250',
      signals: t('signals.limitModalPremiumSignals'),
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
                <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl mb-4 shadow-lg shadow-purple-500/25">
                  <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {t('signals.limitModalTitle')}
                </h2>
                <p className="text-gray-400 text-sm">
                  {t('signals.limitModalSubtitle').replace('{used}', String(signalsUsed)).replace('{limit}', String(signalsLimit))}
                </p>
              </motion.div>

              {/* Current balance info */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3 mb-6"
              >
                {/* Balance */}
                <div className="bg-gradient-to-r from-gray-800/50 to-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <CreditCard className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">{t('signals.limitModalYourBalance')}</div>
                        <div className="text-lg font-bold text-white">${currentBalance.toFixed(2)}</div>
                      </div>
                    </div>
                    {nextTierBalance && (
                      <div className="text-right">
                        <div className="text-xs text-gray-400">{t('signals.limitModalNextTier')}</div>
                        <div className="text-lg font-bold text-purple-400">${nextTierBalance}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Referrals bonus */}
                {referralsCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-xl p-4 border border-green-700/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <TrendingUp className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">{t('signals.limitModalReferrals')}</div>
                          <div className="text-lg font-bold text-green-400">+{referralBonus} {t('signals.limitModalSignals')}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">{t('signals.limitModalInvited')}</div>
                        <div className="text-lg font-bold text-white">{referralsCount}</div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Next referral tier progress */}
                {referralTiers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-xl p-4 border border-purple-700/30"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-purple-300">{t('signals.limitModalNextBonus')}</div>
                      {referralTiers.find(t => referralsCount < t.min_referrals) && (
                        <div className="text-xs text-purple-400">
                          {t('signals.limitModalMoreNeeded').replace('{count}', String(referralTiers.find(t => referralsCount < t.min_referrals)!.min_referrals - referralsCount))}
                        </div>
                      )}
                    </div>
                    {referralTiers.map((tier, i) => {
                      const isCompleted = referralsCount >= tier.min_referrals;
                      const isNext = !isCompleted && (i === 0 || referralsCount >= referralTiers[i-1].min_referrals);

                      return (
                        <div key={i} className="flex items-center gap-2 mb-2 last:mb-0">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                            isCompleted ? 'bg-green-500/30 text-green-400' :
                            isNext ? 'bg-purple-500/30 text-purple-400 animate-pulse' :
                            'bg-gray-700/50 text-gray-500'
                          }`}>
                            {isCompleted ? '✓' : tier.min_referrals}
                          </div>
                          <div className="flex-1">
                            <div className={`text-xs ${
                              isCompleted ? 'text-green-400' : isNext ? 'text-purple-300' : 'text-gray-500'
                            }`}>
                              {t('signals.limitModalReferralsSignal')
                                .replace('{count}', String(tier.min_referrals))
                                .replace('{bonus}', String(tier.bonus))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>

              {/* Plans */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-3 mb-6"
              >
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  {t('signals.limitModalAvailablePlans')}
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
                          ? 'border-purple-500/50 bg-gradient-to-r from-purple-900/20 to-blue-900/20'
                          : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-2 right-3 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-[10px] font-bold text-white">
                          {t('signals.limitModalPopular')}
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
                  className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold py-5 sm:py-6 rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25"
                  onClick={() => {
                    // Redirect to top-up page
                    window.location.href = '/profile?tab=balance';
                  }}
                >
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  {t('signals.limitModalTopUp')}
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                </Button>

                <button
                  onClick={onClose}
                  className="w-full py-3 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {t('signals.limitModalClose')}
                </button>
              </motion.div>

              {/* Additional info */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-4 p-3 bg-purple-900/10 border border-purple-700/30 rounded-lg"
              >
                <p className="text-xs text-gray-400 text-center">
                  {t('signals.limitModalHint')}
                </p>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
