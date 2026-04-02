import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// POST - Отправка кода на email
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    const response = await fetch(`${API_URL}/api/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ Reset password error:', error);
    return NextResponse.json({ success: false, error: 'Ошибка при отправке кода' }, { status: 500 });
  }
}

// PUT - Проверка кода
export async function PUT(request: NextRequest) {
  try {
    const { email, code } = await request.json();
    const response = await fetch(`${API_URL}/api/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Verify code error:', error);
    return NextResponse.json({ success: false, error: 'Ошибка проверки кода' }, { status: 500 });
  }
}

// PATCH - Установка нового пароля
export async function PATCH(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json();
    const response = await fetch(`${API_URL}/api/reset-password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, new_password: newPassword }),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Set new password error:', error);
    return NextResponse.json({ success: false, error: 'Ошибка при смене пароля' }, { status: 500 });
  }
}

// GET - Повторная отправка кода
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email обязателен' }, { status: 400 });
    }
    const response = await fetch(`${API_URL}/api/reset-password?email=${encodeURIComponent(email)}`);
    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Resend code error:', error);
    return NextResponse.json({ success: false, error: 'Ошибка при повторной отправке' }, { status: 500 });
  }
}

// HEAD - Проверка работы API
export async function HEAD() {
  try {
    const response = await fetch(`${API_URL}/api/reset-password`, { method: 'HEAD' });
    if (response.ok) return new NextResponse(null, { status: 200 });
    return new NextResponse(null, { status: 500 });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}
