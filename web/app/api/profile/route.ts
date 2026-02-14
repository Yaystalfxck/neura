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
        else resolve(row);
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

async function queryAllDb(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    
    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function checkColumnExists(column: string): Promise<boolean> {
  try {
    const rows = await queryAllDb('PRAGMA table_info(users)', []);
    return rows.some(row => row.name === column);
  } catch (error) {
    console.error(`Error checking column ${column}:`, error);
    return false;
  }
}

async function findUserByEmail(email: string): Promise<any> {
  return queryDb('SELECT * FROM users WHERE email = ?', [email]);
}

export async function GET(request: NextRequest) {
  try {
    // Получаем токен сессии из куки
    const sessionToken = request.cookies.get('neura-session')?.value;
    
    console.log('🔍 Получение профиля - Session Token:', !!sessionToken);
    
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      );
    }
    
    // Проверяем какие колонки существуют
    const phoneExists = await checkColumnExists('phone');
    const countryExists = await checkColumnExists('country');
    const languageExists = await checkColumnExists('language');
    
    // Формируем запрос
    let selectColumns = 's.userId, u.id, u.name, u.email, u.pocketOptionId, u.balance, u.status, u.createdAt';
    
    if (phoneExists) selectColumns += ', u.phone';
    if (countryExists) selectColumns += ', u.country';
    if (languageExists) selectColumns += ', u.language';
    
    // Получаем сессию и пользователя
    const session = await queryDb(
      `SELECT ${selectColumns} 
       FROM sessions s 
       JOIN users u ON s.userId = u.id 
       WHERE s.token = ? AND s.expiresAt > datetime('now')`,
      [sessionToken]
    );
    
    if (!session) {
      console.log('❌ Сессия не найдена или истекла');
      return NextResponse.json(
        { success: false, error: 'Сессия не найдена' },
        { status: 401 }
      );
    }
    
    // Формируем ответ
    const userData: any = {
      id: session.userId || session.id,
      name: session.name,
      email: session.email,
      pocketOptionId: session.pocketOptionId,
      balance: session.balance || 0,
      status: session.status || 'active',
      createdAt: session.createdAt
    };
    
    if (phoneExists) userData.phone = session.phone || null;
    if (countryExists) userData.country = session.country || 'Россия';
    if (languageExists) userData.language = session.language || 'Русский';
    
    return NextResponse.json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Получаем токен сессии из куки
    const sessionToken = request.cookies.get('neura-session')?.value;
    
    console.log('✏️ Обновление профиля - Session Token:', !!sessionToken);
    
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      );
    }
    
    // Получаем сессию
    const session = await queryDb(
      `SELECT s.userId, u.email, u.id 
       FROM sessions s 
       JOIN users u ON s.userId = u.id 
       WHERE s.token = ? AND s.expiresAt > datetime('now')`,
      [sessionToken]
    );
    
    if (!session) {
      console.log('❌ Сессия не найдена или истекла');
      return NextResponse.json(
        { success: false, error: 'Сессия не найдена' },
        { status: 401 }
      );
    }
    
    const data = await request.json();
    console.log('📦 Получены данные для обновления:', data);
    
    // Проверяем, что данные есть
    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Нет данных для обновления' },
        { status: 400 }
      );
    }
    
    // Проверяем какие колонки существуют
    const phoneExists = await checkColumnExists('phone');
    const countryExists = await checkColumnExists('country');
    const languageExists = await checkColumnExists('language');
    
    // Разрешенные поля для обновления - ДОБАВЛЯЕМ EMAIL
    const allowedFields = ['name', 'email']; // Добавлен email
    if (phoneExists) allowedFields.push('phone');
    if (countryExists) allowedFields.push('country');
    if (languageExists) allowedFields.push('language');
    
    // Проверяем уникальность email, если он изменяется
    if (data.email && data.email !== session.email) {
      const existingUser = await findUserByEmail(data.email);
      if (existingUser && existingUser.id !== session.userId) {
        return NextResponse.json(
          { success: false, error: 'Этот email уже используется другим пользователем' },
          { status: 400 }
        );
      }
      console.log('✅ Email уникален, можно обновлять');
    }
    
    const updateFields = [];
    const updateValues = [];
    
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(data[field]);
        console.log(`📝 Поле для обновления: ${field} = ${data[field]}`);
      }
    }
    
    // Если нет полей для обновления
    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Нет разрешенных полей для обновления' },
        { status: 400 }
      );
    }
    
    // Добавляем updatedAt
    updateFields.push('updatedAt = CURRENT_TIMESTAMP');
    
    // Добавляем userId в конец для WHERE
    updateValues.push(session.userId);
    
    // Обновляем данные в базе
    const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    console.log('📝 SQL запрос:', sql);
    console.log('📝 Параметры:', updateValues);
    
    const result = await queryDb(sql, updateValues);
    
    console.log('✅ Результат обновления:', result);
    
    if (result.changes === 0) {
      console.log('⚠️ Пользователь не найден или данные не изменились');
    }
    
    // Получаем обновленного пользователя
    let selectColumns = 'id, name, email, pocketOptionId, balance, status, createdAt';
    if (phoneExists) selectColumns += ', phone';
    if (countryExists) selectColumns += ', country';
    if (languageExists) selectColumns += ', language';
    
    const updatedUser = await queryDb(
      `SELECT ${selectColumns} FROM users WHERE id = ?`,
      [session.userId]
    );
    
    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 }
      );
    }
    
    // Формируем ответ
    const userData: any = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      pocketOptionId: updatedUser.pocketOptionId,
      balance: updatedUser.balance || 0,
      status: updatedUser.status || 'active',
      createdAt: updatedUser.createdAt
    };
    
    if (phoneExists) userData.phone = updatedUser.phone || null;
    if (countryExists) userData.country = updatedUser.country || 'Россия';
    if (languageExists) userData.language = updatedUser.language || 'Русский';
    
    // Создаем ответ
    const response = NextResponse.json({
      success: true,
      message: 'Профиль успешно обновлен',
      user: userData
    });
    
    // Если обновили email, обновляем куку user-email
    if (data.email) {
      response.cookies.set({
        name: 'user-email',
        value: data.email,
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 дней
        path: '/',
      });
      console.log('📧 Email обновлен, кука user-email обновлена');
    }
    
    console.log('✅ Профиль успешно обновлен, отправляем:', userData);
    
    return response;
    
  } catch (error) {
    console.error('❌ Profile PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления профиля' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}