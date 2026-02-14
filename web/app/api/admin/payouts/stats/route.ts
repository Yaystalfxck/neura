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

    // Получаем статистику выплат
    const stats = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as totalPending,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as totalProcessing,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as totalCompleted,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as totalFailed,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as totalCancelled,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pendingAmount,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as completedAmount
        FROM partner_payouts
      `, (err, row) => {
        if (err) {
          console.error('❌ Error getting payout stats:', err)
          reject(err)
        } else {
          resolve(row)
        }
      })
    })

    return NextResponse.json({
      success: true,
      stats: stats
    })
  } catch (error) {
    console.error('❌ Error in /api/admin/payouts/stats:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}