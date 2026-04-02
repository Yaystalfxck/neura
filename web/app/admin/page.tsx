"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  Users,
  MessageCircle,
  Wallet,
  BarChart3,
  Settings,
  Shield,
  Crown,
  Headphones,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      // Перенаправляем в зависимости от роли
      if (user.role === 'admin') {
        router.push('/admin/users');
      } else if (user.role === 'support') {
        router.push('/admin/support');
      } else {
        router.push('/');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-6 text-gray-400 text-lg">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Определяем доступные разделы
  const getAvailableSections = () => {
    if (user?.role === 'admin') {
      return [
        { id: 'users', label: 'Пользователи', description: 'Управление пользователями и ролями', icon: Users, path: '/admin/users', color: 'from-blue-500 to-cyan-500' },
        { id: 'support', label: 'Поддержка', description: 'Тикеты и обращения пользователей', icon: MessageCircle, path: '/admin/support', color: 'from-green-500 to-emerald-500' },
        { id: 'payouts', label: 'Выплаты', description: 'Заявки на вывод средств', icon: Wallet, path: '/admin/payouts', color: 'from-yellow-500 to-orange-500' },
        { id: 'statistics', label: 'Статистика', description: 'Аналитика и отчеты', icon: BarChart3, path: '/admin/statistics', color: 'from-purple-500 to-pink-500' },
        { id: 'settings', label: 'Настройки', description: 'Конфигурация системы', icon: Settings, path: '/admin/settings', color: 'from-gray-500 to-gray-600' },
      ];
    } else if (user?.role === 'support') {
      return [
        { id: 'support', label: 'Поддержка', description: 'Тикеты и обращения пользователей', icon: MessageCircle, path: '/admin/support', color: 'from-green-500 to-emerald-500' },
      ];
    }
    return [];
  };

  const sections = getAvailableSections();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2">Admin Panel</h1>
          <p className="text-gray-400">
            {user?.role === 'admin' ? 'Панель администратора' : user?.role === 'support' ? 'Панель поддержки' : 'Доступ запрещен'}
          </p>
          {user && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-full border border-gray-700">
              {user?.role === 'admin' && <Crown className="w-4 h-4 text-purple-400" />}
              {user?.role === 'support' && <Headphones className="w-4 h-4 text-blue-400" />}
              <span className="text-sm">{user.email}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                user?.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                {user?.role?.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => {
            const Icon = section.icon;
            
            return (
              <div
                key={section.id}
                onClick={() => router.push(section.path)}
                className="group relative bg-gradient-to-br from-gray-900/50 to-black/50 border border-gray-800 rounded-2xl p-6 cursor-pointer hover:border-gray-600 transition-all hover:scale-[1.02] overflow-hidden"
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${section.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                
                <div className="relative">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${section.color} mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2">{section.label}</h3>
                  <p className="text-gray-400 text-sm mb-4">{section.description}</p>
                  
                  <div className="flex items-center text-sm text-gray-500 group-hover:text-gray-300 transition-colors">
                    <span>Открыть</span>
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Stats (только для admin) */}
        {user?.role === 'admin' && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-500/30 rounded-xl p-6">
              <Users className="w-6 h-6 text-blue-400 mb-3" />
              <div className="text-2xl font-bold">-</div>
              <div className="text-sm text-gray-400">Пользователей</div>
            </div>
            <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-xl p-6">
              <MessageCircle className="w-6 h-6 text-green-400 mb-3" />
              <div className="text-2xl font-bold">-</div>
              <div className="text-sm text-gray-400">Тикетов</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/30 rounded-xl p-6">
              <Wallet className="w-6 h-6 text-yellow-400 mb-3" />
              <div className="text-2xl font-bold">-</div>
              <div className="text-sm text-gray-400">Выплат</div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-xl p-6">
              <BarChart3 className="w-6 h-6 text-purple-400 mb-3" />
              <div className="text-2xl font-bold">-</div>
              <div className="text-sm text-gray-400">Статистика</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
