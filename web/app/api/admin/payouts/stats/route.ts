import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await request.cookies
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const backendUrl = `${API_URL}/api/admin/payouts/stats`

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    // Преобразуем формат backend в формат frontend
    const transformedData = {
      success: data.success || true,
      stats: {
        totalPending: data.stats?.pending_count || 0,
        totalProcessing: data.stats?.processing_count || 0,
        totalCompleted: data.stats?.completed_count || 0,
        totalAmount: (data.stats?.pending_amount || 0) + (data.stats?.completed_amount || 0),
        pendingAmount: data.stats?.pending_amount || 0,
        completedAmount: data.stats?.completed_amount || 0
      }
    }

    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('❌ Admin payouts stats API error:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
