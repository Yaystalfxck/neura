import { NextRequest, NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Путь к файлу БД
const DB_PATH = path.join(process.cwd(), 'data', 'neura.db');

// Инициализация БД
async function initDatabase(): Promise<sqlite3.Database> {
  const db = new sqlite3.Database(DB_PATH);
  
  await new Promise<void>((resolve, reject) => {
    // Обновленная таблица с полями phone, country, language
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        pocketOptionId TEXT NOT NULL,
        balance REAL DEFAULT 0,
        phone TEXT,
        country TEXT DEFAULT 'Россия',
        language TEXT DEFAULT 'Русский',
        status TEXT DEFAULT 'active',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creating users table:', err);
        reject(err);
      } else {
        console.log('✅ Users table ready');
        resolve();
      }
    });
  });
  
  return db;
}

// Выполнение SQL запроса
async function queryDb(sql: string, params: any[] = []): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const db = await initDatabase();
    
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      db.get(sql, params, (err, row) => {
        db.close();
        if (err) {
          console.error('❌ Query error:', err);
          reject(err);
        } else resolve(row || null);
      });
    } else {
      db.run(sql, params, function(err) {
        db.close();
        if (err) {
          console.error('❌ Query error:', err);
          reject(err);
        } else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }
  });
}

// Функция для создания сессии
async function createSession(userId: number, token: string): Promise<void> {
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // +7 дней
    
    db.run(
      `INSERT INTO sessions (userId, token, expiresAt) VALUES (?, ?, ?)`,
      [userId, token, expiresAt.toISOString()],
      function(err) {
        db.close();
        if (err) {
          console.error('❌ Error creating session:', err);
          reject(err);
        } else {
          console.log('✅ Session created');
          resolve();
        }
      }
    );
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    // Базовые проверки
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email и пароль обязательны' },
        { status: 400 }
      );
    }
    
    console.log('🔐 Попытка входа:', { email });
    
    // Ищем пользователя
    const user = await queryDb(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (!user) {
      console.log('❌ Пользователь не найден:', email);
      return NextResponse.json(
        { success: false, error: 'Пользователь с таким email не найден' },
        { status: 404 }
      );
    }
    
    console.log('✅ Пользователь найден:', { 
      id: user.id, 
      email: user.email,
      balance: user.balance
    });
    
    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log('❌ Неверный пароль для:', email);
      return NextResponse.json(
        { success: false, error: 'Неверный пароль' },
        { status: 401 }
      );
    }
    
    console.log('✅ Пароль верный для:', email);
    
    // Проверяем наличие pocketOptionId
    if (!user.pocketOptionId || user.pocketOptionId.trim() === '') {
      console.log('⚠️ У пользователя нет PocketOption ID:', email);
      return NextResponse.json({
        success: false,
        error: 'У вашего аккаунта не указан PocketOption ID. Обратитесь в поддержку.',
        missingPocketOptionId: true
      }, { status: 403 });
    }
    
    // Генерируем токен сессии
    const sessionToken = Buffer.from(`${user.id}:${Date.now()}:${Math.random()}`).toString('base64').replace(/=/g, '');
    
    // Создаем таблицу sessions если её нет
    try {
      const db = await initDatabase();
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expiresAt DATETIME NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          )
        `, (err) => {
          db.close();
          if (err) {
            console.error('❌ Error creating sessions table:', err);
            reject(err);
          } else {
            console.log('✅ Sessions table ready');
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('Error creating sessions table:', error);
    }
    
    // Сохраняем сессию в БД
    await createSession(user.id, sessionToken);
    console.log('✅ Сессия создана в БД');
    
    // Формируем данные пользователя - берем реальный баланс из БД
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      pocketOptionId: user.pocketOptionId,
      balance: user.balance, // УБРАНО: || 10000 - теперь берем как есть из БД
      phone: user.phone || null,
      country: user.country || 'Россия',
      language: user.language || 'Русский',
      status: user.status || 'active',
      createdAt: user.createdAt,
    };
    
    console.log('✅ Успешный вход:', { 
      id: user.id, 
      email: user.email,
      balance: user.balance,
      pocketOptionId: user.pocketOptionId ? 'указан' : 'отсутствует'
    });
    
    // Создаем ответ
    const response = NextResponse.json({
      success: true,
      message: 'Вход выполнен успешно',
      user: userResponse,
    });
    
    // Устанавливаем куку neura-session
    response.cookies.set({
      name: 'neura-session',
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      path: '/',
    });
    
    // Дополнительная кука для клиентского доступа к email
    response.cookies.set({
      name: 'user-email',
      value: user.email,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    
    console.log('🍪 Куки установлены: neura-session и user-email');
    
    return response;
    
  } catch (error) {
    console.error('❌ Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при входе в систему' },
      { status: 500 }
    );
  }
}