import { NextResponse } from 'next/server'
import { syncUserBalance, getDb } from '@/lib/database'
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

    const { userId, pocketOptionId } = await request.json()

    const db = await getDb()
    
    // Проверяем сессию
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

    // Синхронизируем баланс
    const result = await syncUserBalance(userId, pocketOptionId)

    return NextResponse.json({
      success: true,
      balance: result.balance || 0,
      pocketoption_data: result.pocketoption_data
    })
  } catch (error) {
    console.error('Error syncing balance:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка синхронизации баланса' },
      { status: 500 }
    )
  }
}