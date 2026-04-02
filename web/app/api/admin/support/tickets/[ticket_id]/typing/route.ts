import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.31.96:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticket_id: string }> }
) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401 });
    }
    const { ticket_id } = await params;
    const response = await fetch(`${API_URL}/api/admin/support/tickets/${ticket_id}/typing`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Admin update typing error:', error);
    return NextResponse.json({ success: false, error: 'Ошибка' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticket_id: string }> }
) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401 });
    }
    const { ticket_id } = await params;
    const response = await fetch(`${API_URL}/api/admin/support/tickets/${ticket_id}/typing`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Admin get typing error:', error);
    return NextResponse.json({ success: false, error: 'Ошибка' }, { status: 500 });
  }
}
