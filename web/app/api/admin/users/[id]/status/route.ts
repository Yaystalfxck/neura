import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/database'
import { cookies } from 'next/headers'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { status } = await request.json()

    if (!['active', 'blocked', 'inactive'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный статус' },
        { status: 400 }
      )
    }

    const db = await getDb()

    // Проверяем админа
    const admin = await new Promise((resolve, reject) => {
      db.get(
        'SELECT role FROM users WHERE email = ?',
        [userEmail],
        (err: Error, row: any) => {
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

    const { id } = await params
    const userId = parseInt(id)

    // Обновляем статус
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [status, userId],
        function(this: any, err: Error) {
          if (err) reject(err)
          else resolve(this)
        }
      )
    })

    return NextResponse.json({
      success: true,
      message: `Статус пользователя изменен на ${status}`
    })
  } catch (error) {
    console.error('Error in PUT /api/admin/users/[id]/status:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}