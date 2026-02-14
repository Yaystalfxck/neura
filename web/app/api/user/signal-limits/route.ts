import { NextResponse } from 'next/server'
import { getDb } from '@/lib/database'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('neura-session')?.value
    const userEmail = cookieStore.get('user-email')?.value

    if (!sessionToken || !userEmail) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const db = await getDb()
    
    // Получаем пользователя
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, balance, role FROM users WHERE email = ?',
        [userEmail],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 }
      )
    }

    // Проверяем сессию
    const session = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM sessions WHERE userId = ? AND token = ? AND expiresAt > datetime("now")',
        [(user as any).id, sessionToken],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Сессия истекла' },
        { status: 401 }
      )
    }

    // Получаем сегодняшнюю дату
    const today = new Date().toISOString().split('T')[0];

    // Получаем количество использованных сигналов сегодня
    const signalsUsed = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM signal_usage 
         WHERE user_id = ? AND date(used_at) = date(?)`,
        [(user as any).id, today],
        (err, row: any) => {
          if (err) reject(err)
          else resolve(row?.count || 0)
        }
      )
    })

    // Рассчитываем лимит на основе баланса
    const balance = (user as any).balance || 0;
    let limit = 1;

    if ((user as any).role === 'admin') {
      limit = 999; // Админ без лимита
    } else if (balance >= 200) {
      limit = 5;
    } else if (balance >= 100) {
      limit = 4;
    } else if (balance >= 50) {
      limit = 3;
    } else if (balance >= 25) {
      limit = 2;
    }

    return NextResponse.json({
      success: true,
      used: signalsUsed,
      limit: limit,
      balance: balance,
      role: (user as any).role
    })
  } catch (error) {
    console.error('Error getting signal limits:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}