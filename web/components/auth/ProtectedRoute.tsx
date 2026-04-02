// /components/auth/ProtectedRoute.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2, AlertCircle, Shield, Home, LogOut } from 'lucide-react'
import { useLanguage } from '@/app/contexts/LanguageContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  adminOnly?: boolean  // Добавляем пропс для проверки админ-доступа
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { language } = useLanguage()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [user, setUser] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    
    // Периодически проверяем авторизацию каждые 5 минут
    const interval = setInterval(checkAuth, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  const checkAuth = async () => {
    try {
      setError(null)
      const response = await fetch('/api/auth', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.user) {
          setIsAuthenticated(true)
          setUser(data.user)
          
          // Проверяем, является ли пользователь админом
          const userRole = data.user.role || 'user'
          const isUserAdmin = userRole === 'admin'
          setIsAdmin(isUserAdmin)
          
          // Если страница только для админов, а пользователь не админ
          if (adminOnly && !isUserAdmin) {
            setError('У вас нет прав доступа к этой странице')
            setIsAuthenticated(false)
          }
        } else {
          setIsAuthenticated(false)
        }
      } else {
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error('Ошибка проверки авторизации:', error)
      setError('Ошибка соединения с сервером')
      setIsAuthenticated(false)
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        router.push('/login')
      } else {
        console.error('Ошибка выхода')
      }
    } catch (error) {
      console.error('Ошибка выхода:', error)
    }
  }

  const handleGoHome = () => {
    if (isAdmin) {
      router.push('/admin/users')
    } else {
      router.push('/dashboard')
    }
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-blue-500/30 rounded-full"></div>
            <div className="absolute top-0 left-0 w-24 h-24 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            <Loader2 className="w-12 h-12 text-blue-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mt-8 mb-2">{language === 'en' ? 'Checking authorization...' : 'Проверка авторизации...'}</h2>
          <p className="text-gray-400">{language === 'en' ? 'Please wait, checking access' : 'Подождите, идет проверка доступа'}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <AlertCircle className="w-20 h-20 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">
            {error || (language === 'en' ? 'Access denied' : 'Доступ запрещен')}
          </h2>
          <p className="text-gray-400 mb-6">
            {error
              ? (language === 'en' ? 'You do not have permission to view this page' : 'У вас нет прав для просмотра этой страницы')
              : (language === 'en' ? 'You must be logged in to access this page' : 'Для доступа к этой странице необходимо авторизоваться')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/login')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all"
            >
              {language === 'en' ? 'Login' : 'Войти в систему'}
            </button>
            <button
              onClick={() => router.push('/register')}
              className="border border-gray-700 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition-all"
            >
              {language === 'en' ? 'Register' : 'Зарегистрироваться'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Если страница только для админов и пользователь не админ
  if (adminOnly && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <Shield className="w-20 h-20 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">{language === 'en' ? 'Access denied' : 'Доступ запрещен'}</h2>
          <p className="text-gray-400 mb-6">
            {language === 'en' ? 'This page is only available to administrators' : 'Эта страница доступна только для администраторов'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleGoHome}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              {language === 'en' ? 'Home' : 'На главную'}
            </button>
            <button
              onClick={handleLogout}
              className="border border-gray-700 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {language === 'en' ? 'Logout' : 'Выйти'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Рендерим дочерние компоненты если все проверки пройдены
  return <>{children}</>
}