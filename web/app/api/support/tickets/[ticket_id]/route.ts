import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// GET - Получение тикета с сообщениями
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticket_id: string }> }
) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const { ticket_id } = await params;

    const response = await fetch(`${API_URL}/api/support/tickets/${ticket_id}`, {
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
    console.error('❌ Get support ticket error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при получении тикета' },
      { status: 500 }
    );
  }
}

// POST - Отправка сообщения в тикет
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticket_id: string }> }
) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const { ticket_id } = await params;
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/support/tickets/${ticket_id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ Send support message error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при отправке сообщения' },
      { status: 500 }
    );
  }
}
