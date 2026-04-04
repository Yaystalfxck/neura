// /middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Защищенные маршруты страниц
const protectedPages = [
  '/dashboard',
  '/profile',
  '/history',
  '/settings',
  '/signal-found',
  '/search'
]

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // Пропускаем статические файлы и API маршруты
  if (
    path.startsWith('/_next') ||
    path.startsWith('/static') ||
    path.startsWith('/api/') || // ✅ РАЗРЕШАЕМ ВСЕ API ЗАПРОСЫ
    path.startsWith('/public') ||
    path.includes('.ico') ||
    path.includes('.png') ||
    path.includes('.jpg') ||
    path.includes('.svg')
  ) {
    return NextResponse.next()
  }
  
  // Проверяем только защищенные страницы, а не API
  const isProtectedPage = protectedPages.some(route => 
    path === route || path.startsWith(`${route}/`)
  )
  
  // Если это не защищенная страница - пропускаем
  if (!isProtectedPage) {
    return NextResponse.next()
  }
  
  
  // Проверяем наличие session cookie
  const sessionToken = request.cookies.get('neura-session')?.value
  const userEmail = request.cookies.get('user-email')?.value
  
  
  // Если нет ни сессии, ни email - перенаправляем на логин
  if (!sessionToken && !userEmail) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }
  
  // Проверяем авторизацию через API /api/auth
  try {
    const authUrl = new URL('/api/auth', request.url)
    const response = await fetch(authUrl, {
      headers: {
        'Cookie': request.headers.get('cookie') || ''
      },
      cache: 'no-store'
    })
    
      status: response.status,
      ok: response.ok
    })
    
    if (!response.ok) {
      
      // Очищаем куки
      const redirectResponse = NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(path)}`, request.url)
      )
      
      redirectResponse.cookies.delete('user-email')
      redirectResponse.cookies.delete('neura-session')
      redirectResponse.cookies.delete('auth-token')
      
      return redirectResponse
    }
    
    const data = await response.json()
    
    if (!data.success || !data.user) {
      
      const redirectResponse = NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(path)}`, request.url)
      )
      
      redirectResponse.cookies.delete('user-email')
      redirectResponse.cookies.delete('neura-session')
      redirectResponse.cookies.delete('auth-token')
      
      return redirectResponse
    }
    
    
    // Добавляем информацию о пользователе в заголовки
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', data.user.id.toString())
    requestHeaders.set('x-user-email', data.user.email)
    requestHeaders.set('x-user-name', data.user.name)
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
    
  } catch (error) {
    console.error('❌ Ошибка проверки авторизации:', error)
    
    const redirectResponse = NextResponse.redirect(
      new URL(`/login?redirect=${encodeURIComponent(path)}`, request.url)
    )
    
    redirectResponse.cookies.delete('user-email')
    redirectResponse.cookies.delete('neura-session')
    redirectResponse.cookies.delete('auth-token')
    
    return redirectResponse
  }
}

export const config = {
  matcher: [
    // Защищаем только конкретные страницы, а не все маршруты
    '/dashboard/:path*',
    '/profile/:path*',
    '/history/:path*',
    '/settings/:path*',
    '/signal-found/:path*',
    '/search/:path*'
  ],
}