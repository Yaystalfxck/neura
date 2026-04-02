// app/api/check-pocketoption/route.ts
// Проксирует запросы на backend API
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pocketOptionId = url.searchParams.get('pocketOptionId');

    if (!pocketOptionId) {
      return NextResponse.json({
        success: false,
        error: 'PocketOption ID is required'
      }, { status: 400 });
    }

    // Проксируем запрос на backend
    const backendUrl = `${BACKEND_URL}/api/check-pocketoption?pocketOptionId=${encodeURIComponent(pocketOptionId)}`;
    console.log('🔄 Проксирование на backend:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      cache: 'no-store'
    });

    const data = await response.json();

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('❌ Check PocketOption error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Ошибка проверки PocketOption ID'
    }, { status: 500 });
  }
}

// POST для принудительной синхронизации
export async function POST(request: NextRequest) {
  try {
    const { pocketOptionId } = await request.json();

    if (!pocketOptionId) {
      return NextResponse.json({
        success: false,
        error: 'PocketOption ID is required'
      }, { status: 400 });
    }

    // Проксируем запрос на backend
    const backendUrl = `${BACKEND_URL}/api/sync-pocketoption`;
    console.log('🔄 Проксирование на backend:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ pocketOptionId })
    });

    const data = await response.json();

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('❌ Sync PocketOption error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Ошибка синхронизации PocketOption'
    }, { status: 500 });
  }
}