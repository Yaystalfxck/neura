import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    console.log('🔐 Попытка входа:', { email });

    // Вызов Python API
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log('❌ Ошибка входа:', data.detail || data.error);
      return NextResponse.json(
        { 
          success: false, 
          error: data.detail || data.error || 'Неверный email или пароль' 
        },
        { status: response.status }
      );
    }

    console.log('✅ Успешный вход:', {
      id: data.user?.id,
      email: data.user?.email,
    });

    // Создаем ответ с токеном
    const nextResponse = NextResponse.json({
      success: true,
      message: 'Вход выполнен успешно',
      user: data.user,
      token: data.access_token,
    });

    // Устанавливаем куку с токеном
    nextResponse.cookies.set({
      name: 'auth-token',
      value: data.access_token,
      httpOnly: false,  // Изменили на false чтобы можно было читать из JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      path: '/',
    });

    // Кука для client-side доступа к email
    nextResponse.cookies.set({
      name: 'user-email',
      value: data.user?.email || '',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return nextResponse;

  } catch (error) {
    console.error('❌ Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при входе в систему' },
      { status: 500 }
    );
  }
}