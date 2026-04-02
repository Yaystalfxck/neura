"use client";

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Users,
  MessageCircle,
  Wallet,
  BarChart3,
  Settings,
  Shield,
  Crown,
  Headphones
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminNavProps {
  userRole?: string;
  darkMode?: boolean;
}

export function AdminNav({ userRole, darkMode = true, onNavigate }: AdminNavProps & { onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  // Определяем доступные разделы в зависимости от роли
  const getAvailableSections = () => {
    if (userRole === 'admin') {
      return [
        { id: 'users', label: 'Пользователи', shortLabel: 'Польз', icon: Users, path: '/admin/users' },
        { id: 'support', label: 'Поддержка', shortLabel: 'Подд', icon: MessageCircle, path: '/admin/support' },
        { id: 'payouts', label: 'Выплаты', shortLabel: 'Выпл', icon: Wallet, path: '/admin/payouts' },
        { id: 'statistics', label: 'Статистика', shortLabel: 'Стат', icon: BarChart3, path: '/admin/statistics' },
        { id: 'settings', label: 'Настройки', shortLabel: 'Настр', icon: Settings, path: '/admin/settings' },
      ];
    } else if (userRole === 'support') {
      return [
        { id: 'support', label: 'Поддержка', shortLabel: 'Подд', icon: MessageCircle, path: '/admin/support' },
      ];
    }
    return [];
  };

  const sections = getAvailableSections();

  const handleNav = (path: string) => {
    router.push(path);
    if (onNavigate) onNavigate();
  };

  return (
    <nav className="space-y-2">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = pathname === section.path;
        
        return (
          <Button
            key={section.id}
            onClick={() => handleNav(section.path)}
            variant={isActive ? 'default' : 'ghost'}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all justify-start ${
              isActive
                ? darkMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-500 text-white'
                : darkMode 
                  ? 'hover:bg-gray-800 text-gray-400 hover:text-white' 
                  : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="hidden lg:inline whitespace-nowrap">{section.label}</span>
            <span className="lg:hidden text-xs whitespace-nowrap">{section.shortLabel}</span>
            {section.id === 'support' && userRole === 'support' && (
              <span className="ml-auto flex-shrink-0">
                <Headphones className="w-4 h-4" />
              </span>
            )}
            {userRole === 'admin' && section.id !== 'support' && (
              <span className="ml-auto hidden lg:inline flex-shrink-0">
                <Crown className="w-4 h-4 opacity-50" />
              </span>
            )}
          </Button>
        );
      })}
    </nav>
  );
}
