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

    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()
    const backendUrl = `${API_URL}/api/admin/payouts${queryString ? '?' + queryString : ''}`

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
      payouts: (data.payouts || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        amount: p.amount,
        method: p.method,
        details: p.details,
        status: p.status,
        created_at: p.created_at,
        processed_at: p.processed_at,
        user: p.user ? {
          id: p.user.id,
          name: p.user.name || 'Неизвестно',
          email: p.user.email,
          pocketOptionId: p.user.pocket_option_id,
        } : null
      })),
      stats: data.stats || {
        totalPending: 0,
        totalProcessing: 0,
        totalCompleted: 0,
        totalAmount: 0,
        pendingAmount: 0,
        completedAmount: 0
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
    console.error('❌ Admin payouts API error:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
