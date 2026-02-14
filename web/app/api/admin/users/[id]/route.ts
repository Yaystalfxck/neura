import { NextResponse } from 'next/server'
import { getDb } from '@/lib/database'
import { cookies } from 'next/headers'

export async function GET(
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

    // Получаем пользователя
    const user = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM users WHERE id = ?`,
        [userId],
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

    // Получаем данные из PocketOption
    const poData = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM pocketoption_users WHERE pocket_option_id = ?`,
        [(user as any).pocketOptionId],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    // Получаем статистику торговли
    const trades = await new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(*) as trades_count,
          COALESCE(SUM(total), 0) as total_volume,
          COALESCE(SUM(CASE WHEN status = 'success' THEN total ELSE 0 END), 0) as profit
         FROM trades WHERE userId = ?`,
        [userId],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        po_data: poData || null,
        trades_stats: trades || { trades_count: 0, total_volume: 0, profit: 0 }
      }
    })
  } catch (error) {
    console.error('Error in /api/admin/users/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Удаляем пользователя (каскадно удалятся связанные записи)
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM users WHERE id = ?',
        [userId],
        function(err) {
          if (err) reject(err)
          else resolve(this)
        }
      )
    })

    return NextResponse.json({
      success: true,
      message: 'Пользователь удален'
    })
  } catch (error) {
    console.error('Error in DELETE /api/admin/users/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}