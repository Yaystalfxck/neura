import { getDb } from './database';
import { randomBytes } from 'crypto';

// Создание сессии
export async function createSession(userId: number): Promise<string> {
  const db = await getDb();
  
  return new Promise((resolve, reject) => {
    // Генерируем уникальный токен
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
    
    db.run(
      `INSERT INTO sessions (userId, token, expiresAt) VALUES (?, ?, ?)`,
      [userId, token, expiresAt.toISOString()],
      function(err) {
        if (err) reject(err);
        else resolve(token);
      }
    );
  });
}

// Проверка сессии
export async function verifySession(token: string): Promise<number | null> {
  const db = await getDb();
  
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT userId FROM sessions WHERE token = ? AND expiresAt > datetime('now')`,
      [token],
      (err, row: any) => {
        if (err) reject(err);
        else resolve(row ? row.userId : null);
      }
    );
  });
}

// Удаление сессии
export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM sessions WHERE token = ?`,
      [token],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// Удаление всех сессий пользователя
export async function deleteAllUserSessions(userId: number): Promise<void> {
  const db = await getDb();
  
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM sessions WHERE userId = ?`,
      [userId],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}