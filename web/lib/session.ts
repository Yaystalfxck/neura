import { query } from './database';
import { randomBytes } from 'crypto';

// Создание сессии
export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней

  await query(`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES ($1, $2, $3)
  `, [userId, token, expiresAt]);

  return token;
}

// Проверка сессии
export async function verifySession(token: string): Promise<number | null> {
  const result = await query(`
    SELECT user_id FROM sessions 
    WHERE token = $1 AND expires_at > NOW()
  `, [token]);

  return result.rows[0] ? result.rows[0].user_id : null;
}

// Удаление сессии
export async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token = $1', [token]);
}

// Удаление всех сессий пользователя
export async function deleteAllUserSessions(userId: number): Promise<void> {
  await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

// Получить сессию по токену
export async function getSessionByToken(token: string): Promise<any> {
  const result = await query(`
    SELECT * FROM sessions 
    WHERE token = $1 AND expires_at > NOW()
  `, [token]);

  return result.rows[0] || null;
}
