import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// GET - Получение профиля
export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401 });
    }
    const response = await fetch(`${API_URL}/api/profile`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Get profile error:', error);
    return NextResponse.json({ success: false, error: 'Ошибка при получении профиля' }, { status: 500 });
  }
}

// PUT - Обновление профиля
export async function PUT(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401 });
    }
    const body = await request.json();
    const response = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Update profile error:', error);
    return NextResponse.json({ success: false, error: 'Ошибка при обновлении профиля' }, { status: 500 });
  }
}
