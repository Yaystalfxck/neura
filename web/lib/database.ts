import { Pool, QueryResult } from 'pg'

// Типы данных
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  pocket_option_id: string | null;
  balance: number;
  phone: string | null;
  country: string | null;
  language: string | null;
  status: string;
  referral_code: string | null;
  referred_by: number | null;
  referral_rank: string;
  total_referrals: number;
  active_referrals: number;
  total_commission: number;
  pending_commission: number;
  paid_commission: number;
  lifetime_value: number;
  created_at: Date;
  updated_at: Date;
  role?: string;
}

// PostgreSQL connection pool
let pool: Pool | null = null

// Инициализация подключения
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 'postgres://neura:neura_password@localhost:5432/neura_db'
    
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    pool.on('error', (err) => {
      console.error('❌ Unexpected error on idle client', err)
    })

    console.log('✅ PostgreSQL pool created')
  }
  
  return pool
}

// Выполнение запроса
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const client = await getPool().connect()
  try {
    const result = await client.query(text, params)
    return result
  } finally {
    client.release()
  }
}

// Закрытие подключения
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    console.log('✅ PostgreSQL pool closed')
  }
}

// Helper функции
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query('SELECT * FROM users WHERE email = $1', [email])
  return result.rows[0] || null
}

export async function getUserById(id: number): Promise<User | null> {
  const result = await query('SELECT * FROM users WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function createUser(userData: Partial<User>): Promise<User> {
  const {
    name,
    email,
    password,
    pocket_option_id,
    referral_code,
    referred_by,
    role = 'user'
  } = userData

  const result = await query(`
    INSERT INTO users (name, email, password, pocket_option_id, referral_code, referred_by, role)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [name, email, password, pocket_option_id, referral_code, referred_by, role])

  return result.rows[0]
}

export async function createSession(userId: number, token: string, expiresAt: Date): Promise<void> {
  await query(`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES ($1, $2, $3)
  `, [userId, token, expiresAt])
}

export async function getSessionByToken(token: string): Promise<any> {
  const result = await query(
    'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
    [token]
  )
  return result.rows[0] || null
}

export async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token = $1', [token])
}

export async function deleteExpiredSessions(): Promise<void> {
  await query('DELETE FROM sessions WHERE expires_at < NOW()')
}

// Заглушка для совместимости со старым кодом
export async function getDb(): Promise<any> {
  throw new Error('SQLite removed. Use PostgreSQL query() function instead.')
}

export async function initDatabase(): Promise<void> {
  console.log('ℹ️ Database initialization not needed for frontend - using backend API')
}
