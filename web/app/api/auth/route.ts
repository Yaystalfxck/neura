import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    // Получаем токен из куки
    const authToken = request.cookies.get('auth-token')?.value;

    if (!authToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
          code: 'NO_AUTH_DATA'
        },
        { status: 401 }
      );
    }

    // Вызов Python API для проверки авторизации
    const response = await fetch(`${API_URL}/api/auth`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
          code: 'INVALID_TOKEN'
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: data.user
    });

  } catch (error) {
    console.error('❌ Auth check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
  });
}