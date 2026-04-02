"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  name: string;
  email: string;
  pocketOptionId: string;
  balance: number;
  status: string;
  createdAt: string;
  phone?: string | null;
  country?: string;
  language?: string;
  role?: string; // Добавляем поле role
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<{ success: boolean; error?: string; user?: User }>;
  register?: (userData: any) => Promise<{ success: boolean; error?: string; user?: User }>;
  updateProfile?: (profileData: any) => Promise<{ success: boolean; error?: string }>;
  refreshUser?: () => Promise<void>; // Добавляем функцию обновления
  syncBalance?: () => Promise<void>; // Синхронизация баланса с PocketOption
}

// Создаем контекст
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Провайдер
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Проверяем авторизацию при загрузке
  useEffect(() => {
    checkAuth();
  }, []);

  // Функция проверки авторизации
  const checkAuth = async () => {
    try {
      setIsLoading(true);
      
      // Сначала пробуем получить данные из localStorage
      const savedUser = localStorage.getItem('neura_user');
      
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData);
      }
      
      // Затем проверяем серверную валидацию
      try {
        const response = await fetch('/api/auth', {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            // Обновляем из сервера
            const userWithRole = {
              ...data.user,
              role: data.user.role || 'user' // Убеждаемся, что role есть
            };
            setUser(userWithRole);
            localStorage.setItem('neura_user', JSON.stringify(userWithRole));
          } else {
            // Сервер не подтвердил авторизацию
            setUser(null);
            localStorage.removeItem('neura_user');
          }
        } else {
          // Ошибка сервера - не авторизован
          setUser(null);
          localStorage.removeItem('neura_user');
        }
      } catch (serverError) {
        console.log('Server auth check failed, using client cache');
      }
      
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      localStorage.removeItem('neura_user');
    } finally {
      setIsLoading(false);
    }
  };

  // Функция обновления данных пользователя
  const refreshUser = async (): Promise<void> => {
    try {
      const response = await fetch('/api/auth', {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          const userWithRole = {
            ...data.user,
            role: data.user.role || 'user'
          };
          setUser(userWithRole);
          localStorage.setItem('neura_user', JSON.stringify(userWithRole));
          
          // Автоматическая синхронизация баланса с PocketOption
          await syncBalanceWithPocketOption();
        }
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  // Синхронизация баланса с PocketOption API
  const syncBalanceWithPocketOption = async (): Promise<void> => {
    try {
      // Пробуем получить токен из localStorage или куки
      let authToken = localStorage.getItem('auth-token');

      // Если нет в localStorage, пробуем прочитать из куки
      if (!authToken) {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'auth-token') {
            authToken = value;
            break;
          }
        }
      }

      if (!authToken) {
        console.log('⚠️ No auth token found for balance sync');
        return;
      }

      console.log('🔄 Синхронизация баланса с Pocket Option API...');

      const response = await fetch('/api/user/sync-balance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.balance !== undefined) {
          console.log(`✅ Баланс синхронизирован: $${data.balance}`);
          
          // Обновляем баланс в локальном состоянии
          if (user) {
            const updatedUser = {
              ...user,
              balance: data.balance
            };
            setUser(updatedUser);
            localStorage.setItem('neura_user', JSON.stringify(updatedUser));
            
            if (data.commission) {
              console.log(`💰 Комиссия получена: $${data.commission.amount} от ${data.commission.referrer}`);
            }
          }
        }
      } else {
        console.error('❌ Ошибка синхронизации баланса:', response.status);
      }
    } catch (error) {
      console.error('❌ Error syncing balance with PocketOption:', error);
    }
  };

  // Функция входа
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || 'Неверный email или пароль' };
      }

      const userWithRole = {
        ...result.user,
        role: result.user.role || 'user'
      };

      setUser(userWithRole);
      localStorage.setItem('neura_user', JSON.stringify(userWithRole));

      // Сохраняем токен в localStorage и в куки
      if (result.token) {
        localStorage.setItem('auth-token', result.token);
        // Кука уже установлена на сервере, но продублируем для надежности
        document.cookie = `auth-token=${result.token}; path=/; max-age=${60 * 60 * 24 * 7}`;
        console.log('✅ Токен сохранен:', {
          inLocalStorage: !!localStorage.getItem('auth-token'),
          tokenLength: result.token.length,
          inCookie: document.cookie.includes('auth-token')
        });
      } else {
        console.log('⚠️ Токен не получен от сервера');
      }

      return { success: true, user: userWithRole };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка входа'
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Функция выхода
  const logout = async () => {
    console.log('🔄 Начало выхода...');

    try {
      // Получаем токен
      const authToken = localStorage.getItem('auth-token');

      if (authToken) {
        // Отправляем запрос на logout (но не ждем ответа долго)
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
            },
            credentials: 'include',
          });
        } catch (apiError) {
          console.log('Logout API call failed, continuing client cleanup');
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // ВАЖНО: Очищаем клиентское состояние СРАЗУ и гарантированно
      setUser(null);
      localStorage.removeItem('neura_user');
      localStorage.removeItem('auth-token');

      // Очищаем ВСЕ куки доменной зоны
      const allCookies = document.cookie.split(';');
      allCookies.forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim();
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
        if (window.location.hostname.includes('.')) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
        }
      });

      // Дополнительно очищаем известные имена куки
      const knownCookies = ['neura-session', 'user-email', 'auth-token', 'session', 'token', 'access_token'];
      knownCookies.forEach(cookieName => {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      });

      console.log('✅ Клиентское состояние очищено');

      // Перенаправляем на главную
      router.push('/');
      router.refresh();
    }
  };

  // Обновление данных пользователя - СОХРАНЕНИЕ В БД
  const updateUser = async (userData: Partial<User>): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      setIsLoading(true);
      
      console.log('📤 Отправка данных профиля на сервер:', userData);
      
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Ошибка сервера:', result.error);
        return { success: false, error: result.error || 'Ошибка обновления профиля' };
      }

      if (result.success && result.user) {
        // Обновляем локальное состояние
        const userWithRole = {
          ...result.user,
          role: result.user.role || user?.role || 'user'
        };
        setUser(userWithRole);
        localStorage.setItem('neura_user', JSON.stringify(userWithRole));
        console.log('✅ Профиль успешно обновлен:', userWithRole);
        return { success: true, user: userWithRole };
      }

      return { success: false, error: 'Не удалось обновить профиль' };
      
    } catch (error) {
      console.error('❌ Update user error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Ошибка обновления профиля' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Регистрация
  const register = async (userData: any) => {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || 'Ошибка регистрации' };
      }

      return { success: true, user: result.user };
    } catch (error) {
      return { 
        success: false, 
        error: 'Ошибка регистрации' 
      };
    }
  };

  // Обновление профиля (алиас для updateUser)
  const updateProfile = async (profileData: any) => {
    return updateUser(profileData);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
    register,
    updateProfile,
    refreshUser,
    syncBalance: syncBalanceWithPocketOption, // Добавляем функцию синхронизации
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Хук для использования контекста
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}