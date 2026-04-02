import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// POST - Анализ OTC актива
export async function POST(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;

    const body = await request.json();
    const { symbol, prices, timeframe } = body;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_URL}/api/otc/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ symbol, prices, timeframe }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ OTC analyze error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при анализе OTC' },
      { status: 500 }
    );
  }
}

// GET - Получение сигналов
export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol');
    const status = url.searchParams.get('status') || 'active';
    const limit = url.searchParams.get('limit') || '50';

    const queryParams = new URLSearchParams({ status, limit });
    if (symbol) queryParams.append('symbol', symbol);

    const headers: Record<string, string> = {};
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_URL}/api/otc/signals?${queryParams}`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    // Если не авторизован, возвращаем пустой список
    if (response.status === 401) {
      return NextResponse.json({
        success: true,
        signals: [],
        total: 0,
        message: 'Сигналы доступны только авторизованным пользователям'
      });
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ Get OTC signals error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении сигналов' },
      { status: 500 }
    );
  }
}
