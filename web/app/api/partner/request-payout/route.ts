import { NextResponse } from 'next/server'
import { requestPayout, getDb } from '@/lib/database'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
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

    const { amount, method, details } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Некорректная сумма' },
        { status: 400 }
      )
    }

    const db = await getDb()
    
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM users WHERE email = ?',
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
        { status: 401 }
      )
    }

    const userId = (user as any).id

    const session = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM sessions WHERE userId = ? AND token = ? AND expiresAt > datetime("now")',
        [userId, sessionToken],
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

    await requestPayout(userId, amount, method, details)

    return NextResponse.json({
      success: true,
      message: 'Запрос на выплату отправлен'
    })
  } catch (error: any) {
    console.error('Error in /api/partner/request-payout:', error)
    
    if (error.message === 'Insufficient commission balance') {
      return NextResponse.json(
        { success: false, error: 'Недостаточно средств для вывода' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}