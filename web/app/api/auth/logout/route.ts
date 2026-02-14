import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🚪 API выхода: обработка запроса');
    
    // Создаем успешный ответ
    const response = NextResponse.json({
      success: true,
      message: 'Выход выполнен успешно',
      timestamp: new Date().toISOString(),
    });
    
    // Очищаем куки через cookies.set с прошедшей датой
    response.cookies.set({
      name: 'neura-session',
      value: '',
      expires: new Date(0),
      path: '/',
    });
    
    response.cookies.set({
      name: 'user-email',
      value: '',
      expires: new Date(0),
      path: '/',
    });
    
    response.cookies.set({
      name: 'auth-token',
      value: '',
      expires: new Date(0),
      path: '/',
    });
    
    console.log('✅ API выхода: куки очищены');
    
    return response;
    
  } catch (error) {
    console.error('❌ API выхода: ошибка:', error);
    
    // Даже при ошибке возвращаем успешный ответ
    const response = NextResponse.json({
      success: true,
      message: 'Выход выполнен',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    });
    
    // Очищаем куки
    response.cookies.set({
      name: 'neura-session',
      value: '',
      expires: new Date(0),
      path: '/',
    });
    
    return response;
  }
}

// Добавляем обработчик GET
export async function GET() {
  return POST();
}