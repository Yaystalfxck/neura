import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// GET - Получение баланса
export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/api/user/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ Get balance error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении баланса' },
      { status: 500 }
    );
  }
}

// POST - Синхронизация баланса
export async function POST(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/api/user/sync-balance`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ Sync balance error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при синхронизации баланса' },
      { status: 500 }
    );
  }
}
