import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  console.log('=== REGISTRATION VIA PYTHON API ===');

  try {
    const rawBody = await request.json();
    console.log('📥 Raw body from frontend:', JSON.stringify(rawBody, null, 2));
    
    // Поддерживаем оба варианта имени поля
    const { name, email, password, pocketOptionId, pocket_option_id, referralCode } = rawBody;
    const poId = pocketOptionId || pocket_option_id;

    console.log('📝 Регистрация пользователя:', { email, pocketOptionId: poId, referralCode });

    // Проверяем, что pocketOptionId существует
    if (!poId) {
      console.error('❌ pocketOptionId is missing!');
      return NextResponse.json({
        success: false,
        error: 'PocketOption ID is required'
      }, { status: 400 });
    }

    // Формируем URL с referral_code как query параметр
    let registerUrl = `${API_URL}/api/register`;
    if (referralCode) {
      registerUrl += `?referral_code=${encodeURIComponent(referralCode)}`;
      console.log('🔗 Referral code added:', referralCode);
    }

    console.log('🌐 Backend URL:', registerUrl);

    // Формируем body для backend
    const backendBody = { name, email, password, pocket_option_id: poId };
    console.log('📤 Sending to backend:', JSON.stringify(backendBody, null, 2));

    // Вызов Python API
    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendBody),
    });

    const data = await response.json();
    console.log('📥 Response from backend:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.log('❌ Ошибка регистрации:', data.detail || data.error);
      const errorMessage = typeof (data.detail || data.error) === 'string' 
        ? (data.detail || data.error)
        : JSON.stringify(data.detail || data.error);
      return NextResponse.json({
        success: false,
        error: errorMessage
      }, { status: response.status });
    }

    console.log('✅ Регистрация успешна:', {
      id: data.user?.id,
      email: data.user?.email,
      referrer: data.referrer,
    });

    return NextResponse.json({
      success: true,
      message: 'Регистрация успешно завершена!',
      user: data.user,
      referrer: data.referrer,
    });

  } catch (error: any) {
    console.error('❌ Registration error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Ошибка при регистрации'
    }, { status: 500 });
  }
}

// GET для проверки email и PocketOption ID
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const pocketOptionId = url.searchParams.get('pocketOptionId');

    const checks: Record<string, any> = {};

    if (email) {
      const response = await fetch(`${API_URL}/api/register?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      checks.email = data.checks?.email || { exists: false };
    }

    if (pocketOptionId) {
      const response = await fetch(`${API_URL}/api/register?pocketOptionId=${encodeURIComponent(pocketOptionId)}`);
      const data = await response.json();
      checks.pocketOptionId = data.checks?.pocketOptionId || { exists: false };
    }

    return NextResponse.json({
      success: true,
      checks,
      message: 'Проверка выполнена'
    });

  } catch (error) {
    console.error('Check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка при проверке данных'
    }, { status: 500 });
  }
}