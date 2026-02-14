import { NextResponse } from 'next/server'
import { getDb } from '@/lib/database'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('neura-session')?.value
    const userEmail = cookieStore.get('user-email')?.value

    console.log('🔍 Admin Payouts API - Session token:', sessionToken ? 'exists' : 'missing')
    console.log('🔍 Admin Payouts API - User email:', userEmail)

    if (!sessionToken || !userEmail) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const db = await getDb()
    
    // Проверяем, является ли пользователь админом
    const admin = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, role FROM users WHERE email = ?',
        [userEmail],
        (err, row) => {
          if (err) {
            console.error('❌ Error finding admin:', err)
            reject(err)
          } else {
            resolve(row)
          }
        }
      )
    })

    if (!admin || (admin as any).role !== 'admin') {
      console.log('❌ Access denied for user:', userEmail)
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен. Требуются права администратора' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || 'all'
    const method = searchParams.get('method') || 'all'
    const search = searchParams.get('search') || ''

    const offset = (page - 1) * limit

    // Базовый запрос
    let query = `
      SELECT 
        p.*,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.pocketOptionId as user_pocketOptionId
      FROM partner_payouts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `
    const params: any[] = []

    // Фильтр по статусу
    if (status !== 'all') {
      query += ` AND p.status = ?`
      params.push(status)
    }

    // Фильтр по методу вывода
    if (method !== 'all') {
      query += ` AND p.method = ?`
      params.push(method)
    }

    // Поиск
    if (search) {
      query += ` AND (p.id LIKE ? OR u.email LIKE ? OR u.name LIKE ? OR p.details LIKE ?)`
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    // Получаем общее количество для пагинации
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/,
      'SELECT COUNT(*) as total FROM'
    ).replace(/LIMIT.*OFFSET.*$/, '')

    const totalResult = await new Promise<{ total: number }>((resolve, reject) => {
      db.get(countQuery, params, (err, row: any) => {
        if (err) {
          console.error('❌ Error getting total count:', err)
          reject(err)
        } else {
          resolve(row || { total: 0 })
        }
      })
    })

    // Добавляем сортировку и пагинацию
    query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    // Получаем выплаты
    const payouts = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('❌ Error getting payouts:', err)
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })

    // Форматируем результат
    const formattedPayouts = (payouts as any[]).map(p => ({
      id: p.id,
      user_id: p.user_id,
      amount: p.amount,
      method: p.method,
      details: p.details,
      status: p.status,
      created_at: p.created_at,
      processed_at: p.processed_at,
      user: p.user_name ? {
        id: p.user_id,
        name: p.user_name,
        email: p.user_email,
        pocketOptionId: p.user_pocketOptionId
      } : null
    }))

    // Получаем статистику
    const stats = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as totalPending,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as totalProcessing,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as totalCompleted,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as totalFailed,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as totalCancelled,
          COALESCE(SUM(CASE WHEN status IN ('pending', 'processing', 'completed') THEN amount ELSE 0 END), 0) as totalAmount,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pendingAmount,
          COALESCE(SUM(CASE WHEN status = 'processing' THEN amount ELSE 0 END), 0) as processingAmount,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as completedAmount
        FROM partner_payouts
      `, (err, row) => {
        if (err) {
          console.error('❌ Error getting stats:', err)
          reject(err)
        } else {
          resolve(row)
        }
      })
    })

    const total = totalResult.total || 0

    return NextResponse.json({
      success: true,
      payouts: formattedPayouts,
      stats: stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('❌ Error in /api/admin/payouts:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}