import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// PUT - Обновление статуса тикета (Admin)
export async function PUT(
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

    const response = await fetch(`${API_URL}/api/admin/support/tickets/${ticket_id}/status`, {
      method: 'PUT',
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
    console.error('❌ Update ticket status error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении статуса' },
      { status: 500 }
    );
  }
}
