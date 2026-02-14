import { NextRequest, NextResponse } from 'next/server';
import { 
  findUserByEmail, 
  findUserByPocketOptionId,
  createUser,
  getPocketOptionUser,
  syncUserBalance
} from '@/lib/database';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  console.log('=== REGISTRATION WITH POCKETOPTION VALIDATION ===');
  
  try {
    const body = await request.json();
    const { name, email, password, pocketOptionId } = body;
    
    console.log('📝 Регистрация пользователя:', { 
      email, 
      pocketOptionId 
    });
    
    // 🔴 1. ПРОВЕРКА ВСЕХ ПОЛЕЙ
    if (!name || !email || !password || !pocketOptionId) {
      const missing = [];
      if (!name) missing.push('имя');
      if (!email) missing.push('email');
      if (!password) missing.push('пароль');
      if (!pocketOptionId) missing.push('PocketOption ID');
      
      return NextResponse.json({
        success: false,
        error: `Заполните все обязательные поля: ${missing.join(', ')}`,
        missingFields: missing
      }, { status: 400 });
    }
    
    // 🔴 2. ПРОВЕРКА EMAIL
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      return NextResponse.json({
        success: false,
        error: 'Пользователь с таким email уже зарегистрирован'
      }, { status: 400 });
    }
    
    // 🔴 3. ПРОВЕРКА POCKETOPTION ID В НАШЕЙ СИСТЕМЕ
    const existingPocketOptionId = await findUserByPocketOptionId(pocketOptionId);
    if (existingPocketOptionId) {
      return NextResponse.json({
        success: false,
        error: 'Этот PocketOption ID уже используется другим пользователем'
      }, { status: 400 });
    }
    
    // 🔴 4. ПРОВЕРКА POCKETOPTION ID В POCKETOPTION БАЗЕ
    const pocketOptionData = await getPocketOptionUser(pocketOptionId);
    if (!pocketOptionData) {
      // ID не найден в нашей базе - значит пользователь не зарегистрирован на PocketOption
      return NextResponse.json({
        success: false,
        error: 'PocketOption ID не найден. Пожалуйста, сначала зарегистрируйтесь на PocketOption',
        needPocketOptionRegistration: true
      }, { status: 400 });
    }
    
    console.log('✅ PocketOption данные найдены:', {
      email: pocketOptionData.email,
      balance: pocketOptionData.current_balance,
      verification: pocketOptionData.verification_status
    });
    
    // 🔴 5. ХЕШИРОВАНИЕ ПАРОЛЯ
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 🔴 6. СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ
    const userData = {
      name,
      email,
      password: hashedPassword,
      pocketOptionId
    };
    
    const newUser = await createUser(userData);
    
    // 🔴 7. СИНХРОНИЗАЦИЯ БАЛАНСА ИЗ POCKETOPTION
    const syncedUser = await syncUserBalance(newUser.id, pocketOptionId);
    
    console.log('✅ Пользователь создан и синхронизирован:', {
      id: syncedUser.id,
      email: syncedUser.email,
      balance: syncedUser.balance,
      pocketOptionId: syncedUser.pocketOptionId
    });
    
    return NextResponse.json({
      success: true,
      message: 'Регистрация успешно завершена!',
      user: {
        id: syncedUser.id,
        name: syncedUser.name,
        email: syncedUser.email,
        pocketOptionId: syncedUser.pocketOptionId,
        balance: syncedUser.balance,
        status: syncedUser.status
      },
      pocketoption_data: syncedUser.pocketoption_data
    });
    
  } catch (error) {
    console.error('❌ Registration error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Ошибка при регистрации',
      details: process.env.NODE_ENV === 'development' 
        ? (error as Error).message 
        : undefined
    }, { status: 500 });
  }
}

// GET для проверки email и PocketOption ID
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const pocketOptionId = url.searchParams.get('pocketOptionId');
    
    let checks: Record<string, any> = {};
    
    if (email) {
      const existingEmail = await findUserByEmail(email);
      checks.email = { exists: !!existingEmail };
    }
    
    if (pocketOptionId) {
      // Проверяем в нашей базе пользователей
      const existingPocketOptionId = await findUserByPocketOptionId(pocketOptionId);
      checks.pocketOptionId = { 
        existsInUsers: !!existingPocketOptionId,
        email: existingPocketOptionId?.email
      };
      
      // Проверяем в PocketOption базе
      const pocketOptionData = await getPocketOptionUser(pocketOptionId);
      checks.pocketOptionData = {
        exists: !!pocketOptionData,
        data: pocketOptionData || null
      };
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