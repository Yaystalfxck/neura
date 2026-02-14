import { NextRequest, NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { sendResetPasswordEmail } from '@/lib/email-service';

const DB_PATH = path.join(process.cwd(), 'data', 'neura.db');

// Инициализация БД
async function initDatabase(): Promise<sqlite3.Database> {
  const db = new sqlite3.Database(DB_PATH);
  
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS password_reset_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
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

// Генерация 6-значного кода
function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 🔴 Шаг 1: Отправка кода на email (С РЕАЛЬНОЙ ОТПРАВКОЙ)
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email обязателен'
      }, { status: 400 });
    }
    
    console.log('🔐 Запрос на восстановление пароля для:', email);
    
    // Проверяем существование пользователя
    const user = await queryDb(
      'SELECT id, email FROM users WHERE email = ?',
      [email]
    );
    
    if (!user) {
      // Для безопасности не говорим, что пользователь не существует
      console.log('⚠️ Пользователь не найден, но не сообщаем об этом');
      return NextResponse.json({
        success: true,
        message: 'Если пользователь с таким email существует, код будет отправлен'
      });
    }
    
    // Генерируем код
    const code = generateResetCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 минут
    
    // Удаляем старые коды для этого email
    await queryDb(
      'DELETE FROM password_reset_codes WHERE email = ?',
      [email]
    );
    
    // Сохраняем новый код
    await queryDb(
      'INSERT INTO password_reset_codes (email, code, expires_at) VALUES (?, ?, ?)',
      [email, code, expiresAt.toISOString()]
    );
    
    console.log(`✅ Код ${code} сгенерирован для ${email}`);
    
    // 🔴 РЕАЛЬНАЯ ОТПРАВКА EMAIL
    const emailResult = await sendResetPasswordEmail(email, code);
    
    if (!emailResult.success) {
      // Если не удалось отправить email, удаляем код из БД
      await queryDb(
        'DELETE FROM password_reset_codes WHERE email = ? AND code = ?',
        [email, code]
      );
      
      console.error('❌ Не удалось отправить email:', emailResult.error);
      
      // В режиме разработки показываем код в консоли
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 КОД ДЛЯ ТЕСТА (email не отправлен):', code);
        return NextResponse.json({
          success: false,
          error: 'Ошибка отправки email. Проверьте конфигурацию.',
          code: code, // Для отладки
          debug: emailResult.error
        }, { status: 500 });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Ошибка отправки кода. Попробуйте позже.'
      }, { status: 500 });
    }
    
    console.log(`📧 Email успешно отправлен на ${email}`);
    console.log('⏰ Действителен до:', expiresAt.toLocaleString());
    
    return NextResponse.json({
      success: true,
      message: 'Код отправлен на email',
      expiresIn: 15 // минут
    });
    
  } catch (error) {
    console.error('❌ Reset password error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Ошибка при отправке кода'
    }, { status: 500 });
  }
}

// 🔴 Шаг 2: Проверка кода (остается без изменений)
export async function PUT(request: NextRequest) {
  try {
    const { email, code } = await request.json();
    
    if (!email || !code) {
      return NextResponse.json({
        success: false,
        error: 'Email и код обязательны'
      }, { status: 400 });
    }
    
    console.log('🔍 Проверка кода:', { email, code });
    
    // Ищем действующий код
    const resetCode = await queryDb(
      `SELECT * FROM password_reset_codes 
       WHERE email = ? 
         AND code = ? 
         AND used = 0 
         AND expires_at > datetime('now')
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, code]
    );
    
    if (!resetCode) {
      return NextResponse.json({
        success: false,
        error: 'Неверный или просроченный код'
      }, { status: 400 });
    }
    
    console.log('✅ Код подтвержден');
    
    return NextResponse.json({
      success: true,
      message: 'Код подтвержден',
      valid: true
    });
    
  } catch (error) {
    console.error('❌ Verify code error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Ошибка проверки кода'
    }, { status: 500 });
  }
}

// 🔴 Шаг 3: Установка нового пароля (остается без изменений)
export async function PATCH(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json();
    
    if (!email || !code || !newPassword) {
      return NextResponse.json({
        success: false,
        error: 'Все поля обязательны'
      }, { status: 400 });
    }
    
    if (newPassword.length < 6) {
      return NextResponse.json({
        success: false,
        error: 'Пароль должен содержать минимум 6 символов'
      }, { status: 400 });
    }
    
    console.log('🔄 Смена пароля для:', email);
    
    // Проверяем код еще раз
    const resetCode = await queryDb(
      `SELECT * FROM password_reset_codes 
       WHERE email = ? 
         AND code = ? 
         AND used = 0 
         AND expires_at > datetime('now')
       LIMIT 1`,
      [email, code]
    );
    
    if (!resetCode) {
      return NextResponse.json({
        success: false,
        error: 'Неверный или просроченный код'
      }, { status: 400 });
    }
    
    // Проверяем существование пользователя
    const user = await queryDb(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Пользователь не найден'
      }, { status: 404 });
    }
    
    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Обновляем пароль
    const result = await queryDb(
      'UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE email = ?',
      [hashedPassword, email]
    );
    
    // Помечаем код как использованный
    await queryDb(
      'UPDATE password_reset_codes SET used = 1 WHERE id = ?',
      [resetCode.id]
    );
    
    // Удаляем все другие коды для этого email
    await queryDb(
      'DELETE FROM password_reset_codes WHERE email = ? AND id != ?',
      [email, resetCode.id]
    );
    
    console.log('✅ Пароль успешно изменен для:', email);
    
    return NextResponse.json({
      success: true,
      message: 'Пароль успешно изменен'
    });
    
  } catch (error) {
    console.error('❌ Reset password confirm error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Ошибка при смене пароля'
    }, { status: 500 });
  }
}

// 🔴 Шаг 4: Повторная отправка кода (С РЕАЛЬНОЙ ОТПРАВКОЙ)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email обязателен'
      }, { status: 400 });
    }
    
    console.log('🔄 Запрос повторной отправки для:', email);
    
    // Проверяем, был ли недавно отправлен код
    const recentCode = await queryDb(
      `SELECT * FROM password_reset_codes 
       WHERE email = ? 
         AND created_at > datetime('now', '-1 minute')
         AND used = 0
       LIMIT 1`,
      [email]
    );
    
    if (recentCode) {
      return NextResponse.json({
        success: false,
        error: 'Код уже отправлен. Подождите 1 минуту.',
        retryAfter: 60
      }, { status: 429 }); // Too Many Requests
    }
    
    // Генерируем новый код
    const code = generateResetCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    // Сохраняем новый код
    await queryDb(
      'INSERT INTO password_reset_codes (email, code, expires_at) VALUES (?, ?, ?)',
      [email, code, expiresAt.toISOString()]
    );
    
    // 🔴 РЕАЛЬНАЯ ОТПРАВКА EMAIL
    const emailResult = await sendResetPasswordEmail(email, code);
    
    if (!emailResult.success) {
      // Если не удалось отправить email, удаляем код из БД
      await queryDb(
        'DELETE FROM password_reset_codes WHERE email = ? AND code = ?',
        [email, code]
      );
      
      console.error('❌ Не удалось отправить email при повторной отправке:', emailResult.error);
      
      // В режиме разработки показываем код в консоли
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 КОД ДЛЯ ТЕСТА (email не отправлен):', code);
        return NextResponse.json({
          success: false,
          error: 'Ошибка отправки email. Проверьте конфигурацию.',
          code: code, // Для отладки
          debug: emailResult.error
        }, { status: 500 });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Ошибка при отправке кода'
      }, { status: 500 });
    }
    
    console.log(`📧 Email повторно отправлен на ${email}`);
    console.log(`🔄 Новый код ${code} отправлен для ${email}`);
    
    return NextResponse.json({
      success: true,
      message: 'Код отправлен повторно',
      retryAfter: 60
    });
    
  } catch (error) {
    console.error('❌ Resend code error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Ошибка при повторной отправке'
    }, { status: 500 });
  }
}

// 🔴 Новый эндпоинт: Проверка конфигурации email
export async function HEAD() {
  try {
    // Простая проверка, что API работает
    return NextResponse.json({
      success: true,
      message: 'Reset password API is running'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'API error'
    }, { status: 500 });
  }
}