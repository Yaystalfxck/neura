// app/api/partner/track-click/route.ts
// Проксирует запросы на backend API
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, user_agent } = body;

    console.log('🖱️ Track click:', { code, user_agent });

    if (!code) {
      return NextResponse.json({
        success: false,
        error: 'Referral code is required'
      }, { status: 400 });
    }

    // Проксируем запрос на backend
    const backendUrl = `${BACKEND_URL}/api/partner/track-click`;
    console.log('🔄 Проксирование на backend:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ code, user_agent: user_agent || 'unknown' })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Backend error:', data);
      return NextResponse.json({
        success: false,
        error: data.detail || data.error || 'Failed to track click'
      }, { status: response.status });
    }

    console.log('✅ Click tracked:', data);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('❌ Track click error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
