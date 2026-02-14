import { NextResponse } from 'next/server'
import { getReferrals, getDb } from '@/lib/database'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

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

    const referrals = await getReferrals(userId, limit, offset)

    const formattedReferrals = referrals.map(ref => ({
      id: ref.id,
      name: ref.name || 'Пользователь',
      email: ref.email,
      registeredAt: new Date(ref.registeredAt).toLocaleDateString('ru-RU'),
      status: ref.status || 'active',
      totalDeposit: ref.total_deposit || 0,
      commission: ref.commission_earned || 0,
      trades: ref.trades_count || 0,
      profit: ref.total_profit || 0
    }))

    return NextResponse.json({
      success: true,
      referrals: formattedReferrals
    })
  } catch (error) {
    console.error('Error in /api/partner/referrals:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}