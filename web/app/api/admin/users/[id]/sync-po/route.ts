import { NextResponse } from 'next/server'
import { getDb, syncUserBalance } from '@/lib/database'
import { cookies } from 'next/headers'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const { pocketOptionId } = await request.json()

    const db = await getDb()
    
    // Проверяем админа
    const admin = await new Promise((resolve, reject) => {
      db.get(
        'SELECT role FROM users WHERE email = ?',
        [userEmail],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    if (!admin || (admin as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    const userId = parseInt(params.id)

    // Синхронизируем данные
    const updatedUser = await syncUserBalance(userId, pocketOptionId)

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Данные успешно синхронизированы'
    })
  } catch (error) {
    console.error('Error in POST /api/admin/users/[id]/sync-po:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка синхронизации данных' },
      { status: 500 }
    )
  }
}