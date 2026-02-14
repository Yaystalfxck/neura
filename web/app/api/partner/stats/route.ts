import { NextResponse } from 'next/server'
import { getPartnerStats, getDb } from '@/lib/database'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('neura-session')?.value
    const userEmail = cookieStore.get('user-email')?.value

    console.log('🔍 Partner stats - Session token:', sessionToken ? 'exists' : 'missing')
    console.log('🔍 Partner stats - User email:', userEmail)

    if (!sessionToken || !userEmail) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const db = await getDb()
    
    // Сначала найдем пользователя по email
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM users WHERE email = ?',
        [userEmail],
        (err, row) => {
          if (err) {
            console.error('❌ Error finding user:', err)
            reject(err)
          } else {
            resolve(row)
          }
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

    // Проверяем сессию в базе данных
    const session = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM sessions WHERE userId = ? AND token = ? AND expiresAt > datetime("now")',
        [userId, sessionToken],
        (err, row) => {
          if (err) {
            console.error('❌ Error checking session:', err)
            reject(err)
          } else {
            resolve(row)
          }
        }
      )
    })

    if (!session) {
      console.log('❌ Session not found or expired for user:', userId)
      return NextResponse.json(
        { success: false, error: 'Сессия истекла' },
        { status: 401 }
      )
    }

    const stats = await getPartnerStats(userId)
    
    // Форматируем статистику
    const formattedStats = {
      totalReferrals: stats?.total_referrals_count || 0,
      activeReferrals: stats?.active_referrals_count || 0,
      totalCommission: stats?.total_commission || 0,
      pendingCommission: stats?.pending_commission || 0,
      paidCommission: stats?.paid_commission_total || 0,
      conversionRate: stats?.total_clicks ? Math.round((stats?.total_referrals_count / stats?.total_clicks) * 100) : 0,
      averageDeposit: stats?.avg_deposit || 0,
      totalDeposits: stats?.lifetime_value || 0,
      monthlyGrowth: 0,
      rank: stats?.current_rank || 'Bronze',
      nextRank: stats?.next_rank || 'Silver',
      progressToNextRank: stats?.next_rank_requirement 
        ? Math.min(100, Math.round((stats?.total_referrals_count / stats?.next_rank_requirement) * 100))
        : 0,
      lifetimeValue: stats?.lifetime_value || 0,
      clickThroughRate: stats?.total_clicks ? Math.round((stats?.total_referrals_count / stats?.total_clicks) * 100) : 0,
      uniqueClicks: stats?.unique_clicks || 0,
      totalClicks: stats?.total_clicks || 0,
      rankCommission: 5
    }

    return NextResponse.json({
      success: true,
      stats: formattedStats
    })
  } catch (error) {
    console.error('Error in /api/partner/stats:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}