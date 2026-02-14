// app/api/check-pocketoption/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// 🔴 ВРЕМЕННЫЕ ФУНКЦИИ ДЛЯ БАЗЫ
async function getPocketOptionUser(pocketOptionId: string): Promise<any> {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const DB_PATH = path.join(process.cwd(), 'data', 'neura.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.get(
      'SELECT * FROM pocketoption_users WHERE pocket_option_id = ?',
      [pocketOptionId],
      (err: Error | null, row: any) => {
        db.close();
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

async function savePocketOptionUser(data: any): Promise<any> {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const DB_PATH = path.join(process.cwd(), 'data', 'neura.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.run(
      `INSERT OR REPLACE INTO pocketoption_users (
        pocket_option_id, email, reg_date, verification_status,
        ftd_amount, deposits_count, withdrawals_count,
        current_balance, total_deposit, total_withdrawal,
        last_sync, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        data.pocket_option_id,
        data.email,
        data.reg_date,
        data.verification_status,
        data.ftd_amount,
        data.deposits_count,
        data.withdrawals_count,
        data.current_balance,
        data.total_deposit,
        data.total_withdrawal
      ],
      function(this: { lastID: number; changes: number }, err: Error | null) {
        db.close();
        if (err) reject(err);
        else resolve({ id: this.lastID, ...data });
      }
    );
  });
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const user_id = url.searchParams.get('pocketOptionId');
    
    console.log('🔍 Проверка PocketOption ID:', user_id);
    
    if (!user_id) {
      return NextResponse.json({
        success: false,
        error: 'PocketOption ID is required'
      }, { status: 400 });
    }

    // 1. Проверяем в локальной базе
    console.log('📦 Проверка в локальной базе...');
    const existingInDb = await getPocketOptionUser(user_id);
    
    if (existingInDb) {
      console.log('✅ ID найден в локальной базе:', user_id);
      return NextResponse.json({
        success: true,
        exists: true,
        message: 'PocketOption ID найден в локальной базе',
        data: existingInDb,
        source: 'local_db'
      });
    }

    console.log('❌ ID не найден в локальной базе, проверяем через API...');
    
    // 2. Проверяем через PocketOption API
    const partner_id = process.env.NEXT_PUBLIC_PARTNER_ID;
    const api_token = process.env.POCKETOPTION_API_TOKEN;
    
    if (!partner_id || !api_token) {
      return NextResponse.json({
        success: false,
        error: 'API credentials not configured'
      }, { status: 500 });
    }

    // Генерируем хеш
    const stringToHash = `${user_id}:${partner_id}:${api_token}`;
    const hash = crypto.createHash('md5').update(stringToHash).digest('hex');
    
    const apiUrl = `https://affiliate.pocketoption.com/api/user-info/${encodeURIComponent(user_id)}/${encodeURIComponent(partner_id)}/${hash}`;
    
    console.log('🌐 Запрос к PocketOption API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      cache: 'no-store'
    });
    
    console.log('📥 Статус ответа:', response.status);
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.log('❌ API вернул ошибку:', response.status);
      return NextResponse.json({
        success: true,
        exists: false,
        message: `PocketOption API вернул ошибку ${response.status}`,
        source: 'pocketoption_api'
      });
    }

    let apiData;
    try {
      apiData = JSON.parse(responseText);
      console.log('✅ JSON успешно распарсен');
      console.log('📊 Данные API - uid:', apiData.uid);
    } catch (parseError) {
      console.error('❌ Ошибка парсинга JSON:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON response',
        responseText: responseText
      }, { status: 500 });
    }
    
    // 🔴 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Проверяем наличие uid в ответе
    // Если есть uid - пользователь существует в системе PocketOption!
    if (!apiData.uid) {
      console.log('⚠️ API не вернул uid, пользователь не найден');
      return NextResponse.json({
        success: true,
        exists: false,
        message: 'PocketOption ID не найден в системе',
        source: 'pocketoption_api',
        apiData: apiData
      });
    }
    
    console.log('✅ Пользователь найден в PocketOption! UID:', apiData.uid);
    
    // 🔴 ПРЕОБРАЗУЕМ ДАННЫЕ ИЗ ФОРМАТА POCKETOPTION
    // email может отсутствовать в API, это нормально
    const pocketOptionData = {
      pocket_option_id: user_id,
      email: '', // Email может быть скрыт в API
      reg_date: apiData.reg_date || new Date().toISOString(),
      verification_status: apiData.is_verified ? 'verified' : 'pending',
      ftd_amount: apiData.sum_ftd || 0,
      deposits_count: apiData.count_deposits || 0,
      withdrawals_count: 0, // Не приходит в API
      current_balance: apiData.balance || 0,
      total_deposit: apiData.sum_deposits || 0,
      total_withdrawal: 0, // Не приходит в API
      // Дополнительные поля из API
      country: apiData.country || '',
      is_verified: apiData.is_verified || false,
      link_type: apiData.link_type || '',
      offer_type: apiData.offer_type || ''
    };
    
    console.log('💾 Данные для сохранения:', pocketOptionData);
    
    // 🔴 ВСЕГДА СОХРАНЯЕМ ДАННЫЕ, ЕСЛИ ПОЛЬЗОВАТЕЛЬ НАЙДЕН
    await savePocketOptionUser(pocketOptionData);
    console.log('✅ Данные сохранены в базу');
    
    // 🔴 ВОЗВРАЩАЕМ УСПЕШНЫЙ ОТВЕТ ДАЖЕ С НУЛЕВЫМ БАЛАНСОМ
    return NextResponse.json({
      success: true,
      exists: true,
      message: 'PocketOption ID найден в системе',
      data: {
        ...pocketOptionData,
        // 🔴 ДОБАВЛЯЕМ ИНФОРМАЦИОННОЕ СООБЩЕНИЕ
        note: apiData.balance === 0 ? 
          'Пользователь найден, но баланс равен 0. Это нормально для нового аккаунта.' : 
          'Пользователь найден'
      },
      source: 'pocketoption_api',
      apiRawData: apiData // Для отладки
    });

  } catch (error: any) {
    console.error('❌ Check PocketOption error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}