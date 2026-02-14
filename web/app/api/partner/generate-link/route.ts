import { NextResponse } from 'next/server'
import { generateReferralCode, getReferralLink, getDb } from '@/lib/database'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('neura-session')?.value
    const userEmail = cookieStore.get('user-email')?.value

    console.log('🔍 Generate link - Session token:', sessionToken ? 'exists' : 'missing')
    console.log('🔍 Generate link - User email:', userEmail)

    if (!sessionToken || !userEmail) {
      return NextResponse.json(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const { customCode } = await request.json()
    console.log('🔍 Custom code received:', customCode)

    const db = await getDb()
    
    // Найдем пользователя по email
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM users WHERE email = ?',
        [userEmail],
        (err, row) => {
          if (err) {
            console.error('❌ Error finding user:', err)
            reject(err)
          } else {
            console.log('✅ User found:', row ? 'yes' : 'no')
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
    console.log('✅ User ID:', userId)

    // Проверяем сессию
    const session = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM sessions WHERE userId = ? AND token = ? AND expiresAt > datetime("now")',
        [userId, sessionToken],
        (err, row) => {
          if (err) {
            console.error('❌ Error checking session:', err)
            reject(err)
          } else {
            console.log('✅ Session check:', row ? 'valid' : 'invalid')
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
    
    // Генерируем новый код
    console.log('🔄 Generating referral code for user:', userId)
    const code = await generateReferralCode(userId, customCode)
    console.log('✅ Generated code:', code)
    
    // Получаем полную информацию о ссылке
    console.log('🔄 Getting referral link for user:', userId)
    const link = await getReferralLink(userId)
    
    if (!link) {
      console.error('❌ Failed to get referral link after generation')
      return NextResponse.json(
        { success: false, error: 'Не удалось получить ссылку' },
        { status: 500 }
      )
    }

    console.log('✅ Link generated successfully:', {
      id: link.id,
      code: link.code,
      url: link.url,
      clicks: link.clicks,
      registrations: link.registrations,
      conversions: link.conversions
    })

    return NextResponse.json({
      success: true,
      link: {
        id: link.id,
        code: link.code,
        url: link.url,
        clicks: link.clicks || 0,
        registrations: link.registrations || 0,
        conversions: link.conversions || 0
      }
    })
  } catch (error) {
    console.error('❌ Error in /api/partner/generate-link:', error)
    
    // Возвращаем более информативную ошибку
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Внутренняя ошибка сервера'
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}