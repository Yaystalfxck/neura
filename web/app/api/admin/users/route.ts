import { NextResponse } from 'next/server'
import { getDb } from '@/lib/database'
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

    const db = await getDb()
    
    // Проверяем, является ли пользователь админом
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, role FROM users WHERE email = ?',
        [userEmail],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    if (!user || (user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || 'all'
    const rank = searchParams.get('rank') || 'all'
    const sort = searchParams.get('sort') || 'newest'
    const search = searchParams.get('search') || ''

    const offset = (page - 1) * limit

    // Базовый запрос
    let query = `
      SELECT 
        u.*,
        po.current_balance as po_balance,
        po.total_deposit as po_total_deposit,
        po.verification_status as po_verification_status,
        (SELECT COUNT(*) FROM trades WHERE userId = u.id) as trades_count
      FROM users u
      LEFT JOIN pocketoption_users po ON u.pocketOptionId = po.pocket_option_id
      WHERE 1=1
    `
    const params: any[] = []

    // Фильтры
    if (status !== 'all') {
      query += ` AND u.status = ?`
      params.push(status)
    }

    if (rank !== 'all') {
      query += ` AND u.referral_rank = ?`
      params.push(rank)
    }

    if (search) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.pocketOptionId LIKE ? OR u.phone LIKE ?)`
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    // Сортировка
    switch(sort) {
      case 'newest':
        query += ` ORDER BY u.createdAt DESC`
        break
      case 'oldest':
        query += ` ORDER BY u.createdAt ASC`
        break
      case 'balance_desc':
        query += ` ORDER BY u.balance DESC`
        break
      case 'balance_asc':
        query += ` ORDER BY u.balance ASC`
        break
      case 'referrals_desc':
        query += ` ORDER BY u.total_referrals DESC`
        break
      case 'commission_desc':
        query += ` ORDER BY u.total_commission DESC`
        break
      default:
        query += ` ORDER BY u.createdAt DESC`
    }

    // Пагинация
    query += ` LIMIT ? OFFSET ?`
    params.push(limit, offset)

    // Получаем пользователей
    const users = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })

    // Получаем общее количество
    let countQuery = `SELECT COUNT(*) as total FROM users WHERE 1=1`
    const countParams: any[] = []

    if (status !== 'all') {
      countQuery += ` AND status = ?`
      countParams.push(status)
    }

    if (rank !== 'all') {
      countQuery += ` AND referral_rank = ?`
      countParams.push(rank)
    }

    if (search) {
      countQuery += ` AND (name LIKE ? OR email LIKE ? OR pocketOptionId LIKE ? OR phone LIKE ?)`
      const searchPattern = `%${search}%`
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    const total = await new Promise<number>((resolve, reject) => {
      db.get(countQuery, countParams, (err, row: any) => {
        if (err) reject(err)
        else resolve(row?.total || 0)
      })
    })

    // Получаем статистику
    const stats = await new Promise<any>((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(*) as totalUsers,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeUsers,
          SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blockedUsers,
          COALESCE(SUM(balance), 0) as totalBalance,
          COALESCE(AVG(balance), 0) as averageBalance,
          COUNT(CASE WHEN pocketOptionId IS NOT NULL THEN 1 END) as usersWithPO,
          COALESCE(SUM(total_referrals), 0) as totalReferrals,
          COALESCE(SUM(total_commission), 0) as totalCommission
        FROM users
      `, (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })

    // Получаем статистику по депозитам из PO
    const poStats = await new Promise<any>((resolve, reject) => {
      db.get(`
        SELECT 
          COALESCE(SUM(total_deposit), 0) as totalDeposits,
          COALESCE(SUM(total_withdrawal), 0) as totalWithdrawals
        FROM pocketoption_users
      `, (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })

    // Объединяем статистику
    const combinedStats = {
      totalUsers: (stats as any)?.totalUsers || 0,
      activeUsers: (stats as any)?.activeUsers || 0,
      blockedUsers: (stats as any)?.blockedUsers || 0,
      totalBalance: (stats as any)?.totalBalance || 0,
      averageBalance: (stats as any)?.averageBalance || 0,
      usersWithPO: (stats as any)?.usersWithPO || 0,
      totalReferrals: (stats as any)?.totalReferrals || 0,
      totalCommission: (stats as any)?.totalCommission || 0,
      totalDeposits: (poStats as any)?.totalDeposits || 0,
      totalWithdrawals: (poStats as any)?.totalWithdrawals || 0
    }

    return NextResponse.json({
      success: true,
      users: users,
      stats: combinedStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error in /api/admin/users:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}