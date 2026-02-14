import { NextResponse } from 'next/server'
import { getDb } from '@/lib/database'
import { cookies } from 'next/headers'

export async function PUT(
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

    const { status } = await request.json()
    const payoutId = parseInt(params.id)

    if (!['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Некорректный статус' },
        { status: 400 }
      )
    }

    const db = await getDb()
    
    // Проверяем админа
    const admin = await new Promise((resolve, reject) => {
      db.get(
        'SELECT role FROM users WHERE email = ?',
        [userEmail],
        (err, row) => {
          if (err) {
            console.error('❌ Error checking admin:', err)
            reject(err)
          } else {
            resolve(row)
          }
        }
      )
    })

    if (!admin || (admin as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    // Получаем информацию о выплате
    const payout = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM partner_payouts WHERE id = ?',
        [payoutId],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    if (!payout) {
      return NextResponse.json(
        { success: false, error: 'Выплата не найдена' },
        { status: 404 }
      )
    }

    // Обновляем статус
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE partner_payouts 
         SET status = ?, 
             processed_at = CASE 
               WHEN ? IN ('completed', 'failed', 'cancelled') 
               THEN CURRENT_TIMESTAMP 
               ELSE processed_at 
             END
         WHERE id = ?`,
        [status, status, payoutId],
        function(err) {
          if (err) {
            console.error('❌ Error updating payout status:', err)
            reject(err)
          } else {
            resolve(this)
          }
        }
      )
    })

    // Если статус changed на 'completed' или 'cancelled', обновляем баланс пользователя
    if (status === 'completed') {
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE users 
           SET paid_commission = paid_commission + ?,
               pending_commission = pending_commission - ?
           WHERE id = ?`,
          [(payout as any).amount, (payout as any).amount, (payout as any).user_id],
          function(err) {
            if (err) {
              console.error('❌ Error updating user balance:', err)
              reject(err)
            } else {
              resolve(this)
            }
          }
        )
      })
    } else if (status === 'cancelled' || status === 'failed') {
      // Возвращаем средства в pending_commission
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE users 
           SET pending_commission = pending_commission + ?
           WHERE id = ?`,
          [(payout as any).amount, (payout as any).user_id],
          function(err) {
            if (err) {
              console.error('❌ Error returning funds to user:', err)
              reject(err)
            } else {
              resolve(this)
            }
          }
        )
      })
    }

    // Получаем обновленную информацию о выплате
    const updatedPayout = await new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          p.*,
          u.name as user_name,
          u.email as user_email,
          u.pocketOptionId as user_pocketOptionId
         FROM partner_payouts p
         LEFT JOIN users u ON p.user_id = u.id
         WHERE p.id = ?`,
        [payoutId],
        (err, row) => {
          if (err) reject(err)
          else resolve(row)
        }
      )
    })

    return NextResponse.json({
      success: true,
      message: 'Статус выплаты обновлен',
      payout: updatedPayout
    })
  } catch (error) {
    console.error('❌ Error updating payout status:', error)
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}