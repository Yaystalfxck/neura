"use client";

import { useEffect, useRef } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

/**
 * Компонент для синхронизации баланса с PocketOption
 * Синхронизирует баланс с Pocket Option API при:
 * 1. Входе на сайт
 * 2. Обновлении страницы
 */
export const BalanceSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, syncBalance, isAuthenticated } = useAuth();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const hasSyncedRef = useRef(false);
  const SYNC_INTERVAL = 5 * 60 * 1000; // 5 минут

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    // Проверяем, не синхронизировали ли уже недавно
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;

    // Если прошло меньше 5 минут - не синхронизируем
    if (timeSinceLastSync < SYNC_INTERVAL && lastSyncTimeRef.current > 0) {
      console.log(`⏭️ Пропуск синхронизации (прошло ${(timeSinceLastSync / 1000).toFixed(0)}с из 300с)`);
      return;
    }

    // Первая синхронизация при входе
    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true;
      console.log('🔄 Первая синхронизация баланса с Pocket Option API...');
      syncBalance?.();
      lastSyncTimeRef.current = now;
    }

    // Автосинхронизация каждые 5 минут
    syncTimeoutRef.current = setInterval(() => {
      const currentTime = Date.now();
      const timeSinceLast = currentTime - lastSyncTimeRef.current;
      
      if (timeSinceLast >= SYNC_INTERVAL) {
        console.log('🔄 Автоматическая синхронизация баланса...');
        syncBalance?.();
        lastSyncTimeRef.current = currentTime;
      }
    }, SYNC_INTERVAL);

    // Очистка
    return () => {
      if (syncTimeoutRef.current) {
        clearInterval(syncTimeoutRef.current);
      }
    };
  }, [isAuthenticated, user, syncBalance]);

  return <>{children}</>;
};

/**
 * Хук для ручной синхронизации баланса
 */
export const useBalanceSync = () => {
  const { syncBalance, user, isAuthenticated } = useAuth();

  const triggerSync = async () => {
    if (!isAuthenticated || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      await syncBalance?.();
      return { success: true };
    } catch (error) {
      console.error('Balance sync error:', error);
      return { success: false, error: 'Sync failed' };
    }
  };

  return {
    triggerSync,
    isSyncing: false,
  };
};
