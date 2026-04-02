import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// POST - Запрос сигнала из Backend API
export async function POST(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    const body = await request.json();
    
    const { market, timeframe, aiType } = body;

    console.log('📡 Запрос сигнала:', { market, timeframe, aiType });

    // Проверяем токен
    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      );
    }

    // Вызов Backend API для получения сигнала
    const response = await fetch(`${API_URL}/api/signal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        market: market || 'demo',
        timeframe: timeframe || '1',
        ai_type: aiType || 'ml'
      }),
    });

    const result = await response.json();

    console.log('📥 Backend response:', response.status, result);

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Signal API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Ошибка при получении сигнала',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - Проверка доступности
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Signal API is running',
    backend_url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  });
}
