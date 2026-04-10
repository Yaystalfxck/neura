"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  DollarSign,
  TrendingUp,
  Copy,
  Share2,
  Award,
  Wallet,
  History,
  ArrowUpRight,
  CheckCircle,
  Gift,
  Crown,
  Star,
  Zap,
  RefreshCw,
  AlertCircle,
  Banknote,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { toast } from 'sonner';

export default function PartnersPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referralLink, setReferralLink] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'referrals' | 'payouts' | 'payout'>('overview');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('bank_transfer');
  const [cryptoWallet, setCryptoWallet] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Signal bonus functions
  const signalTiers = [
    { min: 3, bonus: 1 },
    { min: 5, bonus: 2 },
    { min: 10, bonus: 4 },
    { min: 20, bonus: 7 },
    { min: 50, bonus: 15 },
  ];

  const getSignalBonus = (referrals: number) => {
    let bonus = 0;
    for (const tier of signalTiers) {
      if (referrals >= tier.min) bonus = tier.bonus;
    }
    return bonus;
  };

  const getNextSignalBonus = (referrals: number) => {
    for (const tier of signalTiers) {
      if (referrals < tier.min) return tier.bonus;
    }
    return signalTiers[signalTiers.length - 1].bonus;
  };

  const getNextTierNeeded = (referrals: number) => {
    for (const tier of signalTiers) {
      if (referrals < tier.min) {
        const needed = tier.min - referrals;
        return language === 'en' 
          ? `${needed} more to +${tier.bonus} signals/day`
          : `Еще ${needed} до +${tier.bonus} сигналов/день`;
      }
    }
    return language === 'en' ? 'Maximum bonus achieved!' : 'Максимальный бонус достигнут!';
  };

  const getNextTierProgress = (referrals: number) => {
    let prevMin = 0;
    for (const tier of signalTiers) {
      if (referrals < tier.min) {
        return Math.min(100, ((referrals - prevMin) / (tier.min - prevMin)) * 100);
      }
      prevMin = tier.min;
    }
    return 100;
  };

  // Загрузка данных
  useEffect(() => {
    if (!user) return;
    loadPartnerData();
  }, [user]);

  const loadPartnerData = async () => {
    try {
      setLoading(true);


      const [linkRes, statsRes, referralsRes, payoutsRes] = await Promise.all([
        fetch('/api/partner/referral-link'),
        fetch('/api/partner/stats'),
        fetch('/api/partner/referrals'),
        fetch('/api/partner/payouts')
      ]);

      const linkData = await linkRes.json();
      const statsData = await statsRes.json();
      const referralsData = await referralsRes.json();
      const payoutsData = await payoutsRes.json();


      if (linkData.success) setReferralLink(linkData.link);
      if (statsData.success) {
        setStats(statsData.stats);
      } else {
        console.error('❌ Stats API error:', statsData)
      }
      if (referralsData.success) setReferrals(referralsData.referrals);
      if (payoutsData.success) setPayouts(payoutsData.payouts);

    } catch (error) {
      console.error('Error loading partner data:', error);
      toast.error(language === 'en' ? 'Error loading data' : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPartnerData();
    setRefreshing(false);
    toast.success(language === 'en' ? 'Data refreshed' : 'Данные обновлены');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(language === 'en' ? 'Copied to clipboard' : 'Скопировано в буфер обмена');
    } catch (error) {
      toast.error(language === 'en' ? 'Copy error' : 'Ошибка копирования');
    }
  };

  const shareLink = () => {
    if (navigator.share && referralLink) {
      navigator.share({
        title: language === 'en' ? 'Neura Trading - Partner Program' : 'Neura Trading - Партнерская программа',
        text: language === 'en' ? 'Earn up to 15% with every friend!' : 'Зарабатывай до 15% с каждым другом!',
        url: referralLink.url
      }).catch(console.error);
    } else {
      copyToClipboard(referralLink?.url || '');
    }
  };

  const handlePayoutRequest = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) < 100) {
      toast.error(t("partnersExtended.minPayout100"));
      return;
    }

    // Проверка для crypto метода
    if (payoutMethod === 'crypto' && !cryptoWallet.trim()) {
      toast.error(language === 'en' ? 'Please enter your crypto wallet address' : 'Введите адрес криптокошелька');
      return;
    }

    try {
      setRequestingPayout(true);

      const response = await fetch('/api/partner/request-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payoutAmount),
          method: payoutMethod,
          details: payoutMethod === 'crypto' ? cryptoWallet : payoutMethod === 'bank_transfer' ? cryptoWallet : ''
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(t("partnersExtended.payoutRequestCreated").replace('${amount}', payoutAmount));
        setPayoutAmount('');
        setCryptoWallet('');
        await loadPartnerData();
      } else {
        toast.error(result.detail || t("partnersExtended.payoutRequestError"));
      }
    } catch (error) {
      toast.error(t("partnersExtended.payoutRequestError"));
    } finally {
      setRequestingPayout(false);
    }
  };

  const getRankIcon = (rank: string) => {
    switch (rank) {
      case 'Diamond': return <Crown className="w-8 h-8 text-purple-500" />;
      case 'Platinum': return <Star className="w-8 h-8 text-blue-400" />;
      case 'Gold': return <Award className="w-8 h-8 text-yellow-500" />;
      case 'Silver': return <Award className="w-8 h-8 text-gray-400" />;
      default: return <Award className="w-8 h-8 text-amber-600" />;
    }
  };

  const getRankProgress = (rank: string) => {
    const progress = {
      'Bronze': 20,
      'Silver': 40,
      'Gold': 60,
      'Platinum': 80,
      'Diamond': 100
    };
    return progress[rank as keyof typeof progress] || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">{t("partnersExtended.loadingPartnerProgram")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white py-20 px-4">
      <div className="container mx-auto max-w-6xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex-1">
            <h1 className="text-3xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {t("partnersExtended.partnerProgram")}
            </h1>
            <p className="text-sm md:text-xl text-gray-400 hidden md:block">
              {t("partnersExtended.earnUpTo")} {stats?.commission_rate || 5}% {t("partnersExtended.withEveryFriend")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="border-white/20 hover:border-white/40 md:w-auto w-10 h-10 p-0 md:p-2"
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            {/* Mobile Menu Button */}
            <Button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              variant="outline"
              size="sm"
              className="md:hidden border-white/20 hover:border-white/40 w-10 h-10 p-0"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {showMobileMenu && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mb-6 overflow-hidden"
            >
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="text-sm text-gray-400">
                  {t("partnersExtended.earnUpTo")} <span className="text-white font-bold">{stats?.commission_rate || 5}%</span> {t("partnersExtended.withEveryFriend")}
                </div>
                <div className="pt-3 border-t border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Ваш ранг</div>
                  <div className="flex items-center gap-2">
                    {getRankIcon(stats?.referral_rank || 'Bronze')}
                    <span className="font-semibold">{stats?.referral_rank || 'Bronze'}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current Rank Card */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-white/10 rounded-2xl p-8 mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                {getRankIcon(stats.referral_rank)}
                <div>
                  <h3 className="text-2xl font-bold">{stats.referral_rank} Partner</h3>
                  <p className="text-gray-400">
                    {t("partnersExtended.nextRank")} <span className="text-white font-semibold">{stats.next_rank}</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-400">{stats.commission_rate}%</div>
                <p className="text-gray-400">{t("partnersExtended.yourCommission")}</p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>{t("partnersExtended.progressTo")} {stats.next_rank}</span>
                <span>{getRankProgress(stats.referral_rank)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${getRankProgress(stats.referral_rank)}%` }}
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Signal Bonus Card */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-700/30 rounded-2xl p-6 mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Zap className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-300">
                  {t('partnersExtended.signalBonus')}
                </h3>
                <p className="text-sm text-gray-400">
                  {t('partnersExtended.signalBonusDesc')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Current bonus */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">{t('partnersExtended.currentBonus')}</div>
                <div className="text-2xl font-bold text-green-400">
                  +{getSignalBonus(stats?.total_referrals || 0)} {t('partnersExtended.signalsPerDay')}
                </div>
              </div>

              {/* Referrals count */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">{t('partnersExtended.yourReferrals')}</div>
                <div className="text-2xl font-bold text-white">
                  {stats?.total_referrals || 0}
                </div>
                <div className="text-xs text-gray-500">
                  {stats?.active_referrals || 0} {t('partnersExtended.active')}
                </div>
              </div>

              {/* Next tier */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">{t('partnersExtended.nextBonus')}</div>
                <div className="text-2xl font-bold text-purple-400">
                  +{getNextSignalBonus(stats?.total_referrals || 0)} {t('partnersExtended.signalsPerDay')}
                </div>
                <div className="text-xs text-gray-500">
                  {getNextTierNeeded(stats?.total_referrals || 0)}
                </div>
              </div>
            </div>

            {/* Progress to next tier */}
            {stats && getNextTierProgress(stats?.total_referrals || 0) > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>{t('partnersExtended.progressToNextBonus')}</span>
                  <span>{getNextTierProgress(stats?.total_referrals || 0)}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${getNextTierProgress(stats?.total_referrals || 0)}%` }}
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Stats Grid - Mobile Responsive */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8">
          <StatCard
            icon={Users}
            label={t("partners.referrals")}
            value={stats?.total_referrals || 0}
            subValue={`${stats?.active_referrals || 0} ${t("partnersExtended.active")}`}
            color="blue"
            mobile
          />
          <StatCard
            icon={DollarSign}
            label={t("partners.earnings")}
            value={`$${(stats?.total_commission || 0).toFixed(2)}`}
            subValue={t("partnersExtended.total")}
            color="yellow"
            mobile
          />
          <StatCard
            icon={Wallet}
            label={t("partners.payout")}
            value={`$${(stats?.pending_commission || 0).toFixed(2)}`}
            subValue={t("partnersExtended.available")}
            color="green"
            mobile
          />
          <StatCard
            icon={TrendingUp}
            label={t("partnersExtended.paid")}
            value={`$${(stats?.paid_commission || 0).toFixed(2)}`}
            subValue={t("partnersExtended.received")}
            color="purple"
            mobile
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-white/10 overflow-x-auto">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={Share2}
            label={t("partnersExtended.referralLink")}
          />
          <TabButton
            active={activeTab === 'referrals'}
            onClick={() => setActiveTab('referrals')}
            icon={Users}
            label={`${t("partnersExtended.referrals")} (${referrals.length})`}
          />
          <TabButton
            active={activeTab === 'payouts'}
            onClick={() => setActiveTab('payouts')}
            icon={History}
            label={t("partnersExtended.payoutHistory")}
          />
          <TabButton
            active={activeTab === 'payout'}
            onClick={() => setActiveTab('payout')}
            icon={Banknote}
            label={t("partnersExtended.payout")}
          />
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <ReferralLinkTab
              key="overview"
              referralLink={referralLink}
              onCopy={copyToClipboard}
              onShare={shareLink}
            />
          )}
          {activeTab === 'referrals' && (
            <ReferralsTab
              key="referrals"
              referrals={referrals}
            />
          )}
          {activeTab === 'payouts' && (
            <PayoutsTab
              key="payouts"
              payouts={payouts}
            />
          )}
          {activeTab === 'payout' && (
            <PayoutTab
              key="payout"
              pendingAmount={stats?.pending_commission || 0}
              payoutAmount={payoutAmount}
              setPayoutAmount={setPayoutAmount}
              payoutMethod={payoutMethod}
              setPayoutMethod={setPayoutMethod}
              cryptoWallet={cryptoWallet}
              setCryptoWallet={setCryptoWallet}
              onRequestPayout={handlePayoutRequest}
              requestingPayout={requestingPayout}
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

// Sub-components

function StatCard({ icon: Icon, label, value, subValue, color, mobile = false }: any) {
  const { language } = useLanguage();

  const colors = {
    blue: 'text-blue-400 bg-blue-500/10',
    green: 'text-green-400 bg-green-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
    purple: 'text-purple-400 bg-purple-500/10'
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-xl ${
        mobile ? 'p-3 md:p-6' : 'p-6'
      }`}
    >
      <div className={`items-center gap-2 ${mobile ? 'flex-col text-center' : 'flex gap-3'} mb-2 md:mb-3`}>
        <div className={`p-2 rounded-lg ${colors[color as keyof typeof colors]} ${mobile ? 'mx-auto' : ''}`}>
          <Icon className={`w-5 h-5 md:w-6 md:h-6`} />
        </div>
        <span className={`text-gray-400 ${mobile ? 'text-xs' : 'text-sm'}`}>{label}</span>
      </div>
      <div className={`font-bold ${mobile ? 'text-lg md:text-2xl' : 'text-2xl'} mb-1`}>{value}</div>
      <div className={`text-gray-500 ${mobile ? 'text-xs' : 'text-sm'}`}>{subValue}</div>
    </motion.div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 font-medium transition-all whitespace-nowrap ${
        active
          ? 'text-white border-b-2 border-blue-500'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

function ReferralLinkTab({ referralLink, onCopy, onShare }: any) {
  const { t, language } = useLanguage();
  
  if (!referralLink) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Gift className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>{t("partnersExtended.noReferralLink")}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Link Card */}
      <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-2xl p-8">
        <h3 className="text-xl font-bold mb-4">{t("partnersExtended.yourReferralLink")}</h3>

        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={referralLink.url}
            readOnly
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm truncate"
          />
          <Button
            onClick={() => onCopy(referralLink.url)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Copy className="w-5 h-5" />
          </Button>
          <Button
            onClick={onShare}
            variant="outline"
            className="border-white/20 hover:border-white/40"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label={t("partnersExtended.clicks")} value={referralLink.clicks} color="blue" />
          <StatBox label={t("partnersExtended.unique")} value={referralLink.unique_clicks} color="green" />
          <StatBox label={t("partnersExtended.registrations")} value={referralLink.registrations} color="yellow" />
          <StatBox label={t("partnersExtended.conversions")} value={referralLink.conversions} color="purple" />
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-white/10 rounded-2xl p-8">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-400" />
          {t("partnersExtended.howItWorks")}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Step
            number={1}
            title={t("partnersExtended.inviteFriend")}
            description={t("partnersExtended.inviteFriendDesc")}
          />
          <Step
            number={2}
            title={t("partnersExtended.friendRegisters")}
            description={t("partnersExtended.friendRegistersDesc")}
          />
          <Step
            number={3}
            title={t("partnersExtended.getCommission")}
            description={t("partnersExtended.getCommissionDesc")}
          />
        </div>
      </div>
    </motion.div>
  );
}

function StatBox({ label, value, color }: any) {
  const colors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400'
  };
  
  return (
    <div className="text-center p-4 bg-black/30 rounded-lg">
      <div className={`text-2xl font-bold ${colors[color as keyof typeof colors]}`}>{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function Step({ number, title, description }: any) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h4 className="font-semibold mb-2">{title}</h4>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}

function ReferralsTab({ referrals }: any) {
  const { t, language } = useLanguage();

  if (!referrals || referrals.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>{t("partnersExtended.youHaveNoReferrals")}</p>
        <p className="text-sm mt-2">{t("partnersExtended.inviteFriendsViaLink")}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-2xl overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-black/30">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold">{t("partnersExtended.referrer")}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">{t("partnersExtended.date")}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">{t("partnersExtended.status")}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">{t("partnersExtended.deposit")}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">{t("partnersExtended.commission")}</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((ref: any, idx: number) => (
              <tr key={ref.id} className={idx % 2 === 0 ? 'bg-black/20' : ''}>
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium">{ref.name}</div>
                    <div className="text-sm text-gray-400">{ref.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {new Date(ref.joined_at).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    ref.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {ref.status === 'active' ? t("partnersExtended.active") : t("partnersExtended.inactive")}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium">
                  ${ref.total_deposit?.toFixed(2) || '0.00'}
                </td>
                <td className="px-6 py-4 font-medium text-green-400">
                  ${ref.commission_earned?.toFixed(2) || '0.00'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function PayoutsTab({ payouts }: any) {
  const { t, language } = useLanguage();

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: t("partnersExtended.pending"),
      processing: t("partnersExtended.processing"),
      completed: t("partnersExtended.paid"),
      cancelled: t("partnersExtended.cancelled"),
      failed: t("partnersExtended.failed")
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      processing: 'bg-blue-500/20 text-blue-400',
      completed: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-gray-500/20 text-gray-400',
      failed: 'bg-red-500/20 text-red-400'
    };
    return colors[status] || colors.pending;
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      bank_transfer: t("partnersExtended.bankTransfer"),
      crypto: t("partnersExtended.crypto"),
      card: t("partnersExtended.card")
    };
    return labels[method] || method;
  };

  if (!payouts || payouts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>{t("partnersExtended.payoutHistoryEmpty")}</p>
        <p className="text-sm mt-2">{t("partnersExtended.whenYouRequestPayout")}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-2xl overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-black/30">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold">{t("partnersExtended.date")}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">{t("partnersExtended.method")}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">{t("partnersExtended.status")}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">{t("partnersExtended.details")}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">{t("partnersExtended.amount")}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">{t("partnersExtended.processedAt")}</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout: any, idx: number) => (
              <tr key={payout.id} className={idx % 2 === 0 ? 'bg-black/20' : ''}>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {new Date(payout.created_at).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                    {getMethodLabel(payout.method)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(payout.status)}`}>
                    {getStatusLabel(payout.status)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {payout.details || '-'}
                </td>
                <td className="px-6 py-4 font-bold text-green-400">
                  ${payout.amount?.toFixed(2) || '0.00'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {payout.processed_at 
                    ? new Date(payout.processed_at).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')
                    : '-'
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function PayoutTab({
  pendingAmount,
  payoutAmount,
  setPayoutAmount,
  payoutMethod,
  setPayoutMethod,
  cryptoWallet,
  setCryptoWallet,
  onRequestPayout,
  requestingPayout
}: any) {
  const { t, language } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Available Amount */}
      <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-2xl p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">{t("partnersExtended.availableForPayout")}</h3>
            <p className="text-gray-400 text-sm">{t("partnersExtended.minPayoutAmount")}</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-green-400">${pendingAmount?.toFixed(2) || '0.00'}</div>
          </div>
        </div>
      </div>

      {/* Payout Form */}
      <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-2xl p-8">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Banknote className="w-6 h-6 text-blue-400" />
          {t("partnersExtended.payoutRequestTitle")}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              {t("partnersExtended.payoutAmountLabel")}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="100"
                min="100"
                max={pendingAmount}
                className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-4 py-3 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              {t("partnersExtended.payoutMethodLabel")}
            </label>
            <select
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
            >
              <option value="bank_transfer">{t("partnersExtended.bankTransfer")}</option>
              <option value="crypto">{t("partnersExtended.crypto")}</option>
              <option value="pocketoption">{t("partnersExtended.pocketoption")}</option>
            </select>
          </div>

          {payoutMethod === 'crypto' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                {language === 'en' ? 'Crypto Wallet Address (USDT TRC20)' : 'Адрес криптокошелька (USDT TRC20)'}
              </label>
              <input
                type="text"
                value={cryptoWallet}
                onChange={(e) => setCryptoWallet(e.target.value)}
                placeholder="TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white font-mono"
              />
              <p className="text-xs text-gray-500 mt-2">
                {language === 'en' 
                  ? 'Enter your USDT TRC20 wallet address. Make sure it is correct.'
                  : 'Введите адрес вашего USDT TRC20 кошелька. Убедитесь, что он верный.'}
              </p>
            </div>
          )}

          {payoutMethod === 'bank_transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                {language === 'en' ? 'Bank Account Details' : 'Банковские реквизиты'}
              </label>
              <input
                type="text"
                value={cryptoWallet}
                onChange={(e) => setCryptoWallet(e.target.value)}
                placeholder={language === 'en' ? 'Account number or IBAN' : 'Номер счета или IBAN'}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
              />
            </div>
          )}

          <Button
            onClick={onRequestPayout}
            disabled={requestingPayout || !payoutAmount || parseFloat(payoutAmount) < 100 || (payoutMethod === 'crypto' && !cryptoWallet)}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {requestingPayout ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                {t("partnersExtended.processing")}
              </>
            ) : (
              <>
                <Banknote className="w-5 h-5 mr-2" />
                {t("partnersExtended.requestPayoutBtn")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-semibold text-blue-400 mb-2">{t("partnersExtended.payoutInfoTitle")}</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• {t("partnersExtended.minPayoutAmount")}</li>
              <li>• {t("partnersExtended.processingTime")}</li>
              <li>• {t("partnersExtended.payoutProcessingDays")}</li>
              <li>• {t("partnersExtended.cryptoWalletAddress")}</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
