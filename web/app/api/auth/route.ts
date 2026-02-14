import { NextRequest, NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'neura.db');

async function queryDb(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      db.get(sql, params, (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row || null);
      });
    } else {
      db.run(sql, params, function(err) {
        db.close();
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    // Пробуем получить email из куки
    const userEmail = request.cookies.get('user-email')?.value;
    const sessionToken = request.cookies.get('neura-session')?.value;
    
    console.log('🔍 Проверка авторизации:', { 
      userEmail: userEmail?.substring(0, 10) + '...',
      hasSession: !!sessionToken 
    });
    
    // Если нет данных для авторизации
    if (!userEmail && !sessionToken) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Not authenticated',
          code: 'NO_AUTH_DATA'
        },
        { status: 401 }
      );
    }
    
    let user = null;
    
    // Ищем пользователя по email - ДОБАВЛЯЕМ ПОЛЕ role В ЗАПРОС
    if (userEmail) {
      user = await queryDb(
        'SELECT id, name, email, pocketOptionId, balance, status, createdAt, role FROM users WHERE email = ?',
        [userEmail]
      );
    }
    
    // Если пользователь не найден
    if (!user) {
      console.log('❌ Пользователь не найден');
      return NextResponse.json(
        { 
          success: false, 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        },
        { status: 404 }
      );
    }
    
    console.log('✅ Пользователь найден:', { 
      id: user.id, 
      name: user.name,
      email: user.email,
      role: user.role || 'user'  // Добавляем логирование роли
    });
    
    // Возвращаем пользователя с ролью
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        pocketOptionId: user.pocketOptionId,
        balance: user.balance,
        status: user.status,
        createdAt: user.createdAt,
        role: user.role || 'user'  // ВАЖНО: возвращаем роль
      }
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