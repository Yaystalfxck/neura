import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await request.cookies
    const authToken = cookieStore.get('auth-token')?.value
    const userEmail = cookieStore.get('user-email')?.value

    console.log('🔐 Admin API - Token:', authToken ? 'exists' : 'missing')
    console.log('🔐 Admin API - Email:', userEmail)

    if (!authToken || !userEmail) {
      console.log('❌ No auth token or email')
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }

    // Проксируем запрос на backend с Authorization header
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()
    const backendUrl = `${API_URL}/api/admin/users${queryString ? '?' + queryString : ''}`

    console.log('📡 Fetching from backend:', backendUrl)

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    })

    console.log('📥 Backend response status:', response.status)

    const data = await response.json()

    console.log('📦 Backend response data:', JSON.stringify(data).substring(0, 200))

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    // Преобразуем формат backend в формат frontend
    const transformedData = {
      success: data.success || true,
      users: data.users || [],
      stats: data.stats || {
        totalUsers: data.total || 0,
        activeUsers: 0,
        blockedUsers: 0,
        totalBalance: 0,
        averageBalance: 0,
        usersWithPO: 0,
        totalReferrals: 0,
        totalCommission: 0,
        totalDeposits: 0,
        totalWithdrawals: 0
      },
      pagination: {
        page: data.page || 1,
        limit: data.per_page || 20,
        total: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / (data.per_page || 20))
      }
    }

    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('❌ Admin users API error:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
