// app/contexts/ReferralContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

interface ReferralContextType {
  referralCode: string | null;
  hasTrackedClick: boolean;
}

const ReferralContext = createContext<ReferralContextType | undefined>(undefined);

// Глобальный флаг для предотвращения двойного трекинга
let hasTrackedGlobally = false;
const trackedCodes = new Set<string>();

export function ReferralProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [hasTrackedClick, setHasTrackedClick] = useState(false);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    // Получаем ref параметр из URL
    const ref = searchParams?.get('ref');
    
    if (ref && !hasTrackedClick && !hasTrackedRef.current && !hasTrackedGlobally) {
      // Проверяем, не отслеживали ли уже этот код
      if (trackedCodes.has(ref)) {
        return;
      }

      setReferralCode(ref);
      
      // Помечаем как отслеженный
      hasTrackedRef.current = true;
      hasTrackedGlobally = true;
      trackedCodes.add(ref);
      
      // Сохраняем в localStorage для будущего использования
      localStorage.setItem('referral_code', ref);
      localStorage.setItem('referral_click_time', new Date().toISOString());
      
      // Отправляем на backend для трекинга
      trackReferralClick(ref);
      
      setHasTrackedClick(true);
    }
  }, [searchParams, hasTrackedClick]);

  return (
    <ReferralContext.Provider value={{ referralCode, hasTrackedClick }}>
      {children}
    </ReferralContext.Provider>
  );
}

export function useReferral() {
  const context = useContext(ReferralContext);
  if (context === undefined) {
    throw new Error('useReferral must be used within a ReferralProvider');
  }
  return context;
}

// Функция для отслеживания клика
async function trackReferralClick(code: string) {
  try {
    const response = await fetch('/api/partner/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, user_agent: navigator.userAgent }),
    });

    if (!response.ok) {
      console.error('Failed to track referral click:', response.status);
    }
  } catch (error) {
    console.error('Error tracking referral click:', error);
  }
}
