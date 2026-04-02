import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await request.cookies
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const { id } = await params
    const userId = parseInt(id)

    const { pocketOptionId } = await request.json()

    console.log(`🔄 Sync PO data for user ${userId}, PO ID: ${pocketOptionId}`)

    const response = await fetch(`${API_URL}/api/admin/users/${userId}/sync-po`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ pocketOptionId }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    console.log(`✅ PO sync result:`, data)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in sync-po route:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка синхронизации данных' },
      { status: 500 }
    )
  }
}
