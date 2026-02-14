import sqlite3 from 'sqlite3'
import path from 'path'
import fs from 'fs'

// Типы данных для базы данных
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  pocketOptionId: string;
  balance: number;
  phone: string | null;
  country: string;
  language: string;
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
  createdAt: string;
  updatedAt: string;
  role?: string;
}

interface Session {
  id: number;
  userId: number;
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface ReferralLink {
  id: number;
  user_id: number;
  code: string;
  custom_code: string | null;
  url: string;
  clicks: number;
  unique_clicks: number;
  registrations: number;
  conversions: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface Referral {
  id: number;
  referrer_id: number;
  referred_id: number;
  referral_link_id: number | null;
  status: string;
  first_deposit: number;
  total_deposit: number;
  total_trades: number;
  total_profit: number;
  commission_earned: number;
  joined_at: string;
  last_active: string;
}

interface Commission {
  id: number;
  user_id: number;
  referral_id: number | null;
  amount: number;
  type: 'deposit' | 'trade' | 'bonus' | 'withdrawal';
  status: 'pending' | 'paid' | 'cancelled';
  description: string | null;
  source: string | null;
  created_at: string;
  paid_at: string | null;
}

interface PartnerRank {
  id: number;
  name: string;
  min_referrals: number;
  min_deposit: number;
  commission_rate: number;
  icon: string | null;
  color: string | null;
  created_at: string;
}

interface PartnerStats {
  total_referrals: number;
  active_referrals: number;
  total_commission: number;
  pending_commission: number;
  paid_commission: number;
  lifetime_value: number;
  referral_rank: string;
  active_referrals_count: number;
  total_referrals_count: number;
  total_clicks: number;
  unique_clicks: number;
  paid_commission_total: number;
  avg_deposit: number;
  current_rank: string | null;
  next_rank: string | null;
  next_rank_requirement: number | null;
}

interface SignalUsage {
  id: number;
  user_id: number;
  used_at: string;
  signal_data: string | null;
}

// Путь к файлу БД
const DB_PATH = path.join(process.cwd(), 'data', 'neura.db')
const dbDir = path.dirname(DB_PATH)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

let db: sqlite3.Database | null = null
let isInitializing = false
let initPromise: Promise<sqlite3.Database> | null = null

// Инициализация БД и создание таблиц
export async function initDatabase(): Promise<sqlite3.Database> {
  if (initPromise) {
    return initPromise
  }

  if (db) {
    return db
  }

  isInitializing = true
  initPromise = new Promise((resolve, reject) => {
    console.log('📦 Инициализация базы данных...')
    
    const newDb = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Ошибка подключения к SQLite:', err.message)
        isInitializing = false
        initPromise = null
        reject(err)
        return
      }
      
      console.log('✅ Подключено к SQLite базе:', DB_PATH)
      db = newDb
      
      // Создаем таблицы
      createTables(newDb)
        .then(() => {
          isInitializing = false
          resolve(newDb)
        })
        .catch((err) => {
          console.error('❌ Ошибка создания таблиц:', err)
          isInitializing = false
          initPromise = null
          reject(err)
        })
    })
  })

  return initPromise
}

// Миграция таблиц для добавления недостающих колонок
async function migrateTables(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('🔄 Проверка и обновление структуры таблиц...')
    
    // Проверяем существование колонок в таблице users
    db.all("PRAGMA table_info(users)", (err, columns: any[]) => {
      if (err) {
        console.error('❌ Ошибка получения информации о таблице users:', err)
        reject(err)
        return
      }

      const existingColumns = columns.map(col => col.name)
      console.log('📊 Существующие колонки в users:', existingColumns)

      // Список колонок, которые должны быть
      const requiredColumns = [
        { name: 'total_referrals', type: 'INTEGER DEFAULT 0' },
        { name: 'active_referrals', type: 'INTEGER DEFAULT 0' },
        { name: 'total_commission', type: 'REAL DEFAULT 0' },
        { name: 'pending_commission', type: 'REAL DEFAULT 0' },
        { name: 'paid_commission', type: 'REAL DEFAULT 0' },
        { name: 'lifetime_value', type: 'REAL DEFAULT 0' },
        { name: 'referral_rank', type: 'TEXT DEFAULT "Bronze"' },
        { name: 'role', type: 'TEXT DEFAULT "user"' },
        { name: 'referral_code', type: 'TEXT' }
      ]

      let migrationPromises: Promise<void>[] = []

      requiredColumns.forEach(column => {
        if (!existingColumns.includes(column.name)) {
          console.log(`➕ Добавление колонки ${column.name} в таблицу users...`)
          
          const promise = new Promise<void>((res, rej) => {
            db.run(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`, (err) => {
              if (err) {
                if (!err.message.includes('duplicate column name')) {
                  console.error(`❌ Ошибка добавления колонки ${column.name}:`, err)
                  rej(err)
                } else {
                  res()
                }
              } else {
                console.log(`✅ Колонка ${column.name} добавлена`)
                res()
              }
            })
          })
          
          migrationPromises.push(promise)
        }
      })

      // Проверяем таблицу referral_links
      db.all("PRAGMA table_info(referral_links)", (err, columns: any[]) => {
        if (err) {
          console.error('❌ Ошибка получения информации о таблице referral_links:', err)
          reject(err)
          return
        }

        const existingLinkColumns = columns.map(col => col.name)
        console.log('📊 Существующие колонки в referral_links:', existingLinkColumns)

        const requiredLinkColumns = [
          { name: 'unique_clicks', type: 'INTEGER DEFAULT 0' },
          { name: 'registrations', type: 'INTEGER DEFAULT 0' },
          { name: 'conversions', type: 'INTEGER DEFAULT 0' }
        ]

        requiredLinkColumns.forEach(column => {
          if (!existingLinkColumns.includes(column.name)) {
            console.log(`➕ Добавление колонки ${column.name} в таблицу referral_links...`)
            
            const promise = new Promise<void>((res, rej) => {
              db.run(`ALTER TABLE referral_links ADD COLUMN ${column.name} ${column.type}`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                  console.error(`❌ Ошибка добавления колонки ${column.name}:`, err)
                  rej(err)
                } else {
                  if (!err) console.log(`✅ Колонка ${column.name} добавлена`)
                  res()
                }
              })
            })
            
            migrationPromises.push(promise)
          }
        })

        // Проверяем таблицу signal_usage
        db.all("PRAGMA table_info(signal_usage)", (err, columns: any[]) => {
          if (err && !err.message.includes('no such table')) {
            console.error('❌ Ошибка получения информации о таблице signal_usage:', err)
          }
        })

        Promise.all(migrationPromises)
          .then(() => {
            console.log('✅ Миграция таблиц завершена')
            resolve()
          })
          .catch(reject)
      })
    })
  })
}

// Создание таблиц
async function createTables(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    // Включаем поддержку внешних ключей
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) console.warn('⚠️ Не удалось включить foreign_keys:', err)
    })

    const runAsync = (sql: string): Promise<void> => {
      return new Promise((res, rej) => {
        db.run(sql, (err) => {
          if (err) rej(err)
          else res()
        })
      })
    }

    // Создаем таблицы последовательно
    Promise.all([
      runAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          pocketOptionId TEXT NOT NULL UNIQUE,
          balance REAL DEFAULT 0,
          phone TEXT,
          country TEXT DEFAULT 'Россия',
          language TEXT DEFAULT 'Русский',
          status TEXT DEFAULT 'active',
          referral_code TEXT UNIQUE,
          referred_by INTEGER,
          referral_rank TEXT DEFAULT 'Bronze',
          total_referrals INTEGER DEFAULT 0,
          active_referrals INTEGER DEFAULT 0,
          total_commission REAL DEFAULT 0,
          pending_commission REAL DEFAULT 0,
          paid_commission REAL DEFAULT 0,
          lifetime_value REAL DEFAULT 0,
          role TEXT DEFAULT 'user',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `).then(() => console.log('✅ Таблица users создана/проверена')),

      runAsync(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expiresAt DATETIME NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
      `).then(() => console.log('✅ Таблица sessions создана/проверена')),

      runAsync(`
        CREATE TABLE IF NOT EXISTS referral_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          code TEXT UNIQUE NOT NULL,
          custom_code TEXT,
          url TEXT NOT NULL,
          clicks INTEGER DEFAULT 0,
          unique_clicks INTEGER DEFAULT 0,
          registrations INTEGER DEFAULT 0,
          conversions INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `).then(() => console.log('✅ Таблица referral_links создана/проверена')),

      runAsync(`
        CREATE TABLE IF NOT EXISTS referrals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          referrer_id INTEGER NOT NULL,
          referred_id INTEGER NOT NULL UNIQUE,
          referral_link_id INTEGER,
          status TEXT DEFAULT 'active',
          first_deposit REAL DEFAULT 0,
          total_deposit REAL DEFAULT 0,
          total_trades INTEGER DEFAULT 0,
          total_profit REAL DEFAULT 0,
          commission_earned REAL DEFAULT 0,
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (referral_link_id) REFERENCES referral_links(id) ON DELETE SET NULL
        )
      `).then(() => console.log('✅ Таблица referrals создана/проверена')),

      runAsync(`
        CREATE TABLE IF NOT EXISTS commissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          referral_id INTEGER,
          amount REAL NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('deposit', 'trade', 'bonus', 'withdrawal')),
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'cancelled')),
          description TEXT,
          source TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          paid_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE SET NULL
        )
      `).then(() => console.log('✅ Таблица commissions создана/проверена')),

      runAsync(`
        CREATE TABLE IF NOT EXISTS partner_ranks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          min_referrals INTEGER NOT NULL,
          min_deposit REAL NOT NULL,
          commission_rate REAL NOT NULL,
          icon TEXT,
          color TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).then(() => console.log('✅ Таблица partner_ranks создана/проверена')),

      runAsync(`
        CREATE TABLE IF NOT EXISTS referral_clicks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          referral_link_id INTEGER NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          referrer_url TEXT,
          converted BOOLEAN DEFAULT 0,
          clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (referral_link_id) REFERENCES referral_links(id) ON DELETE CASCADE
        )
      `).then(() => console.log('✅ Таблица referral_clicks создана/проверена')),

      runAsync(`
        CREATE TABLE IF NOT EXISTS partner_payouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          method TEXT NOT NULL,
          details TEXT,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
          processed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `).then(() => console.log('✅ Таблица partner_payouts создана/проверена')),

      runAsync(`
        CREATE TABLE IF NOT EXISTS partner_achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          achievement_type TEXT NOT NULL,
          achievement_value TEXT,
          achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `).then(() => console.log('✅ Таблица partner_achievements создана/проверена')),

      runAsync(`
        CREATE TABLE IF NOT EXISTS pocketoption_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pocket_option_id TEXT UNIQUE NOT NULL,
          email TEXT,
          reg_date DATETIME,
          verification_status TEXT,
          ftd_amount REAL DEFAULT 0,
          deposits_count INTEGER DEFAULT 0,
          withdrawals_count INTEGER DEFAULT 0,
          current_balance REAL DEFAULT 0,
          total_deposit REAL DEFAULT 0,
          total_withdrawal REAL DEFAULT 0,
          last_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).then(() => console.log('✅ Таблица pocketoption_users создана/проверена')),

      runAsync(`
        CREATE TABLE IF NOT EXISTS trades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          symbol TEXT NOT NULL,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          price REAL NOT NULL,
          total REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users(id)
        )
      `).then(() => console.log('✅ Таблица trades создана/проверена')),

      // ✅ НОВАЯ ТАБЛИЦА ДЛЯ ОТСЛЕЖИВАНИЯ ИСПОЛЬЗОВАНИЯ СИГНАЛОВ
      runAsync(`
        CREATE TABLE IF NOT EXISTS signal_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          signal_data TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `).then(() => console.log('✅ Таблица signal_usage создана/проверена'))
    ])
    .then(async () => {
      // Запускаем миграцию для обновления существующих таблиц
      await migrateTables(db)
      // Добавляем ранги по умолчанию
      await addDefaultRanks(db)
      // Добавляем тестового пользователя
      await addTestUser(db)
      resolve()
    })
    .catch(reject)
  })
}

// Добавление рангов по умолчанию
async function addDefaultRanks(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve) => {
    db.get(`SELECT COUNT(*) as count FROM partner_ranks`, (err, row: any) => {
      if (err) {
        console.error('Error checking partner ranks:', err)
        resolve()
      } else if (row.count === 0) {
        const ranks = [
          { name: 'Bronze', min_referrals: 0, min_deposit: 0, commission_rate: 5, icon: 'Shield', color: 'amber-600' },
          { name: 'Silver', min_referrals: 10, min_deposit: 1000, commission_rate: 7, icon: 'Award', color: 'gray-400' },
          { name: 'Gold', min_referrals: 25, min_deposit: 5000, commission_rate: 10, icon: 'Crown', color: 'yellow-500' },
          { name: 'Platinum', min_referrals: 50, min_deposit: 10000, commission_rate: 12, icon: 'Star', color: 'blue-400' },
          { name: 'Diamond', min_referrals: 100, min_deposit: 25000, commission_rate: 15, icon: 'Sparkles', color: 'purple-500' }
        ]

        let completed = 0
        ranks.forEach(rank => {
          db.run(
            `INSERT INTO partner_ranks (name, min_referrals, min_deposit, commission_rate, icon, color) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [rank.name, rank.min_referrals, rank.min_deposit, rank.commission_rate, rank.icon, rank.color],
            (err) => {
              if (err) console.error(`❌ Ошибка добавления ранга ${rank.name}:`, err)
              completed++
              if (completed === ranks.length) {
                console.log('✅ Ранги партнеров добавлены')
                resolve()
              }
            }
          )
        })
      } else {
        resolve()
      }
    })
  })
}

// Добавление тестового пользователя
async function addTestUser(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve) => {
    db.get(`SELECT COUNT(*) as count FROM users`, (err, row: any) => {
      if (err) {
        console.error('Error checking users count:', err)
        resolve()
      } else if (row.count === 0) {
        const testUser = {
          name: 'Тестовый Пользователь',
          email: 'test@example.com',
          password: 'password123',
          pocketOptionId: 'TEST123',
          phone: '+7 (999) 123-45-67',
          country: 'Россия',
          language: 'Русский',
          referral_code: 'test123'
        }

        db.run(
          `INSERT INTO users (name, email, password, pocketOptionId, balance, phone, country, language, status, referral_code) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            testUser.name,
            testUser.email,
            testUser.password,
            testUser.pocketOptionId,
            1500.50,
            testUser.phone,
            testUser.country,
            testUser.language,
            'active',
            testUser.referral_code
          ],
          (err) => {
            if (err) {
              console.error('❌ Ошибка добавления тестового пользователя:', err)
            } else {
              console.log('✅ Тестовый пользователь добавлен:', testUser.email)
            }
            resolve()
          }
        )
      } else {
        resolve()
      }
    })
  })
}

// Получение соединения с БД
export async function getDb(): Promise<sqlite3.Database> {
  if (db) {
    // Проверяем, открыто ли соединение
    return new Promise((resolve, reject) => {
      db!.get('SELECT 1', (err) => {
        if (err) {
          console.log('⚠️ Соединение с БД закрыто, переподключаемся...')
          db = null
          initPromise = null
          resolve(initDatabase())
        } else {
          resolve(db!)
        }
      })
    })
  }
  
  return initDatabase()
}

// 📌 ФУНКЦИИ ДЛЯ ПАРТНЕРСКОЙ ПРОГРАММЫ

// Генерация реферального кода
export async function generateReferralCode(userId: number, customCode?: string): Promise<string> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    console.log('🔄 generateReferralCode called for user:', userId, 'customCode:', customCode)
    
    // Деактивируем все старые ссылки пользователя
    database.run(
      `UPDATE referral_links SET is_active = 0 WHERE user_id = ?`,
      [userId],
      function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          console.error('❌ Error deactivating old links:', err)
          reject(err)
          return
        }
        
        console.log('✅ Old links deactivated, changes:', this.changes)
        
        // Определяем базовый код
        let baseCode: string
        if (customCode && customCode.trim() !== '') {
          // Очищаем custom code от недопустимых символов
          baseCode = customCode.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
          if (baseCode.length === 0) {
            baseCode = `user_${userId}`
          }
        } else {
          // Генерируем случайный код
          baseCode = `user_${userId}_${Date.now().toString(36)}`
        }
        
        console.log('🔄 Base code:', baseCode)
        
        let code = baseCode
        let counter = 1
        
        const tryInsert = () => {
          console.log('🔄 Trying to insert code:', code)
          
          database.get(
            `SELECT id FROM referral_links WHERE code = ?`,
            [code],
            (err: Error | null, existing: { id: number } | undefined) => {
              if (err) {
                console.error('❌ Error checking existing code:', err)
                reject(err)
                return
              }
              
              if (existing) {
                console.log('⚠️ Code already exists, trying next:', code)
                code = `${baseCode}_${counter}`
                counter++
                tryInsert()
                return
              }
              
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
              const url = `${baseUrl}/?ref=${code}`
              
              console.log('🔄 Creating new referral link with URL:', url)
              
              database.run(
                `INSERT INTO referral_links (user_id, code, custom_code, url, is_active, clicks, unique_clicks, registrations, conversions) 
                 VALUES (?, ?, ?, ?, 1, 0, 0, 0, 0)`,
                [userId, code, customCode || null, url],
                function(this: sqlite3.RunResult, err: Error | null) {
                  if (err) {
                    console.error('❌ Error creating referral link:', err)
                    reject(err)
                  } else {
                    console.log('✅ New referral link created with ID:', this.lastID, 'code:', code)
                    resolve(code)
                  }
                }
              )
            }
          )
        }
        
        tryInsert()
      }
    )
  })
}

// Получение реферальной ссылки
export async function getReferralLink(userId: number): Promise<ReferralLink | null> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    console.log('🔄 getReferralLink called for user:', userId)
    
    database.get(
      `SELECT * FROM referral_links WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
      (err: Error | null, row: ReferralLink | undefined) => {
        if (err) {
          console.error('❌ Error getting referral link:', err)
          reject(err)
        } else {
          if (row) {
            console.log('✅ Active referral link found:', {
              id: row.id,
              code: row.code,
              url: row.url,
              clicks: row.clicks,
              registrations: row.registrations,
              conversions: row.conversions
            })
          } else {
            console.log('⚠️ No active referral link found for user:', userId)
          }
          resolve(row || null)
        }
      }
    )
  })
}

// Обновление статистики кликов
export async function trackReferralClick(code: string, ip: string, userAgent: string, referrer?: string): Promise<void> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT id FROM referral_links WHERE code = ? AND is_active = 1`,
      [code],
      (err: Error | null, link: { id: number } | undefined) => {
        if (err || !link) {
          reject(err || new Error('Referral link not found'))
          return
        }
        
        // Записываем клик
        database.run(
          `INSERT INTO referral_clicks (referral_link_id, ip_address, user_agent, referrer_url) 
           VALUES (?, ?, ?, ?)`,
          [link.id, ip, userAgent, referrer || null],
          function(this: sqlite3.RunResult, err: Error | null) {
            if (err) {
              reject(err)
              return
            }
            
            // Обновляем счетчик кликов
            database.run(
              `UPDATE referral_links SET clicks = clicks + 1 WHERE id = ?`,
              [link.id],
              (err: Error | null) => {
                if (err) reject(err)
                else resolve()
              }
            )
          }
        )
      }
    )
  })
}

// Регистрация по реферальной ссылке
export async function registerWithReferral(code: string, newUserId: number): Promise<void> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT * FROM referral_links WHERE code = ? AND is_active = 1`,
      [code],
      (err: Error | null, link: ReferralLink | undefined) => {
        if (err || !link) {
          reject(err || new Error('Referral link not found'))
          return
        }
        
        // Обновляем пользователя - устанавливаем referrer
        database.run(
          `UPDATE users SET referred_by = ?, referral_code = ? WHERE id = ?`,
          [link.user_id, code, newUserId],
          function(this: sqlite3.RunResult, err: Error | null) {
            if (err) {
              reject(err)
              return
            }
            
            // Обновляем статистику ссылки
            database.run(
              `UPDATE referral_links SET registrations = registrations + 1 WHERE id = ?`,
              [link.id],
              (err: Error | null) => {
                if (err) {
                  reject(err)
                  return
                }
                
                // Обновляем клик как конверсию
                database.run(
                  `UPDATE referral_clicks SET converted = 1 
                   WHERE referral_link_id = ? AND converted = 0 
                   ORDER BY clicked_at DESC LIMIT 1`,
                  [link.id],
                  (err: Error | null) => {
                    if (err) {
                      reject(err)
                      return
                    }
                    
                    // Обновляем счетчики реферера
                    database.run(
                      `UPDATE users SET total_referrals = total_referrals + 1 WHERE id = ?`,
                      [link.user_id],
                      (err: Error | null) => {
                        if (err) reject(err)
                        else resolve()
                      }
                    )
                  }
                )
              }
            )
          }
        )
      }
    )
  })
}

// Добавление реферала
export async function addReferral(referrerId: number, referredId: number, linkId?: number): Promise<void> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO referrals (referrer_id, referred_id, referral_link_id) VALUES (?, ?, ?)`,
      [referrerId, referredId, linkId || null],
      function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          console.error('❌ Error adding referral:', err)
          reject(err)
        } else {
          console.log('✅ Referral added:', referrerId, '->', referredId)
          resolve()
        }
      }
    )
  })
}

// Обновление комиссии при депозите
export async function addCommissionFromDeposit(userId: number, depositAmount: number): Promise<void> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    // Находим реферера
    database.get(
      `SELECT referred_by FROM users WHERE id = ?`,
      [userId],
      (err: Error | null, user: { referred_by: number | null } | undefined) => {
        if (err || !user || !user.referred_by) {
          resolve() // Нет реферера - ничего не делаем
          return
        }
        
        const referrerId = user.referred_by;
        
        // Получаем ранг реферера и его комиссию
        database.get(
          `SELECT u.referral_rank, pr.commission_rate 
           FROM users u
           LEFT JOIN partner_ranks pr ON u.referral_rank = pr.name
           WHERE u.id = ?`,
          [referrerId],
          (err: Error | null, referrer: { referral_rank: string; commission_rate: number } | undefined) => {
            if (err || !referrer) {
              reject(err)
              return
            }
            
            const commissionRate = referrer.commission_rate || 5;
            const commissionAmount = depositAmount * (commissionRate / 100);
            
            // Находим ID реферальной связи
            database.get(
              `SELECT id FROM referrals WHERE referrer_id = ? AND referred_id = ?`,
              [referrerId, userId],
              (err: Error | null, referral: { id: number } | undefined) => {
                if (err) {
                  reject(err)
                  return
                }
                
                const referralId = referral?.id || null;
                
                // Добавляем комиссию
                database.run(
                  `INSERT INTO commissions (user_id, referral_id, amount, type, description, source, status) 
                   VALUES (?, ?, ?, 'deposit', ?, ?, 'pending')`,
                  [
                    referrerId, 
                    referralId, 
                    commissionAmount, 
                    `Комиссия ${commissionRate}% от депозита $${depositAmount}`,
                    `deposit_${userId}`
                  ],
                  function(this: sqlite3.RunResult, err: Error | null) {
                    if (err) {
                      reject(err)
                      return
                    }
                    
                    // Обновляем баланс комиссий реферера
                    database.run(
                      `UPDATE users 
                       SET pending_commission = pending_commission + ?,
                           total_commission = total_commission + ?,
                           lifetime_value = lifetime_value + ?
                       WHERE id = ?`,
                      [commissionAmount, commissionAmount, depositAmount, referrerId],
                      (err: Error | null) => {
                        if (err) {
                          reject(err)
                          return
                        }
                        
                        // Обновляем статистику реферала
                        if (referralId) {
                          database.run(
                            `UPDATE referrals 
                             SET total_deposit = total_deposit + ?,
                                 commission_earned = commission_earned + ?,
                                 status = CASE 
                                   WHEN ? > 0 AND status = 'active' THEN 'active'
                                   ELSE status
                                 END
                             WHERE id = ?`,
                            [depositAmount, commissionAmount, depositAmount, referralId],
                            (err: Error | null) => {
                              if (err) reject(err)
                              else {
                                console.log('✅ Commission added for user:', referrerId, '$' + commissionAmount)
                                resolve()
                              }
                            }
                          )
                        } else {
                          console.log('✅ Commission added for user:', referrerId, '$' + commissionAmount)
                          resolve()
                        }
                      }
                    )
                  }
                )
              }
            )
          }
        )
      }
    )
  })
}

// Обновление комиссии при торговле
export async function addCommissionFromTrade(userId: number, tradeProfit: number): Promise<void> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    if (tradeProfit <= 0) {
      resolve() // Только прибыльные сделки
      return
    }
    
    database.get(
      `SELECT referred_by FROM users WHERE id = ?`,
      [userId],
      (err: Error | null, user: { referred_by: number | null } | undefined) => {
        if (err || !user || !user.referred_by) {
          resolve()
          return
        }
        
        const referrerId = user.referred_by;
        
        database.get(
          `SELECT u.referral_rank, pr.commission_rate 
           FROM users u
           LEFT JOIN partner_ranks pr ON u.referral_rank = pr.name
           WHERE u.id = ?`,
          [referrerId],
          (err: Error | null, referrer: { referral_rank: string; commission_rate: number } | undefined) => {
            if (err || !referrer) {
              reject(err)
              return
            }
            
            const commissionRate = (referrer.commission_rate || 5) / 2; // 50% от ставки для торговли
            const commissionAmount = tradeProfit * (commissionRate / 100);
            
            database.get(
              `SELECT id FROM referrals WHERE referrer_id = ? AND referred_id = ?`,
              [referrerId, userId],
              (err: Error | null, referral: { id: number } | undefined) => {
                if (err) {
                  reject(err)
                  return
                }
                
                database.run(
                  `INSERT INTO commissions (user_id, referral_id, amount, type, description, source, status) 
                   VALUES (?, ?, ?, 'trade', ?, ?, 'pending')`,
                  [
                    referrerId, 
                    referral?.id || null, 
                    commissionAmount, 
                    `Комиссия ${commissionRate}% от прибыли $${tradeProfit}`,
                    `trade_${userId}_${Date.now()}`
                  ],
                  function(this: sqlite3.RunResult, err: Error | null) {
                    if (err) {
                      reject(err)
                      return
                    }
                    
                    database.run(
                      `UPDATE users SET pending_commission = pending_commission + ? WHERE id = ?`,
                      [commissionAmount, referrerId],
                      (err: Error | null) => {
                        if (err) reject(err)
                        else {
                          console.log('✅ Trade commission added for user:', referrerId, '$' + commissionAmount)
                          resolve()
                        }
                      }
                    )
                  }
                )
              }
            )
          }
        )
      }
    )
  })
}

// Получение статистики партнера
export async function getPartnerStats(userId: number): Promise<PartnerStats | null> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    // Сначала проверим существование пользователя
    database.get(
      `SELECT * FROM users WHERE id = ?`,
      [userId],
      (err: Error | null, user: User | undefined) => {
        if (err || !user) {
          reject(err || new Error('User not found'))
          return
        }

        // Затем получаем статистику - исправлено количество параметров
        database.get(
          `SELECT 
            COALESCE(u.total_referrals, 0) as total_referrals,
            COALESCE(u.active_referrals, 0) as active_referrals,
            COALESCE(u.total_commission, 0) as total_commission,
            COALESCE(u.pending_commission, 0) as pending_commission,
            COALESCE(u.paid_commission, 0) as paid_commission,
            COALESCE(u.lifetime_value, 0) as lifetime_value,
            COALESCE(u.referral_rank, 'Bronze') as referral_rank,
            (SELECT COUNT(*) FROM referrals WHERE referrer_id = ? AND status = 'active') as active_referrals_count,
            (SELECT COUNT(*) FROM referrals WHERE referrer_id = ?) as total_referrals_count,
            (SELECT COUNT(*) FROM referral_clicks rc 
             JOIN referral_links rl ON rc.referral_link_id = rl.id 
             WHERE rl.user_id = ?) as total_clicks,
            (SELECT COUNT(DISTINCT ip_address) FROM referral_clicks rc 
             JOIN referral_links rl ON rc.referral_link_id = rl.id 
             WHERE rl.user_id = ?) as unique_clicks,
            (SELECT COALESCE(SUM(amount), 0) FROM commissions WHERE user_id = ? AND status = 'paid') as paid_commission_total,
            (SELECT COALESCE(AVG(total_deposit), 0) FROM referrals WHERE referrer_id = ?) as avg_deposit,
            (SELECT name FROM partner_ranks WHERE min_referrals <= ? ORDER BY min_referrals DESC LIMIT 1) as current_rank,
            (SELECT name FROM partner_ranks WHERE min_referrals > ? ORDER BY min_referrals ASC LIMIT 1) as next_rank,
            (SELECT min_referrals FROM partner_ranks WHERE min_referrals > ? ORDER BY min_referrals ASC LIMIT 1) as next_rank_requirement
           FROM users u WHERE u.id = ?`,
          [
            userId, userId, userId, userId, userId, 
            userId, userId, userId, userId, userId,
            userId
          ],
          (err: Error | null, row: PartnerStats | undefined) => {
            if (err) {
              console.error('❌ Error getting partner stats:', err)
              reject(err)
            } else {
              resolve(row || null)
            }
          }
        )
      }
    )
  })
}

// Получение списка рефералов
export async function getReferrals(userId: number, limit: number = 50, offset: number = 0): Promise<any[]> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.all(
      `SELECT 
        r.*,
        u.name,
        u.email,
        u.createdAt as registeredAt,
        u.status,
        u.balance,
        (SELECT COUNT(*) FROM trades WHERE userId = u.id) as trades_count,
        (SELECT COALESCE(SUM(total), 0) FROM trades WHERE userId = u.id AND status = 'success') as total_profit
       FROM referrals r
       JOIN users u ON r.referred_id = u.id
       WHERE r.referrer_id = ?
       ORDER BY r.joined_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
      (err: Error | null, rows: any[]) => {
        if (err) {
          console.error('❌ Error getting referrals:', err)
          reject(err)
        } else {
          resolve(rows || [])
        }
      }
    )
  })
}

// Получение истории комиссий
export async function getCommissionHistory(userId: number, limit: number = 50, offset: number = 0): Promise<any[]> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.all(
      `SELECT 
        c.*,
        u.name as from_user_name,
        u.email as from_user_email
       FROM commissions c
       LEFT JOIN referrals r ON c.referral_id = r.id
       LEFT JOIN users u ON r.referred_id = u.id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
      (err: Error | null, rows: any[]) => {
        if (err) {
          console.error('❌ Error getting commission history:', err)
          reject(err)
        } else {
          resolve(rows || [])
        }
      }
    )
  })
}

// Обновление ранга партнера
export async function updatePartnerRank(userId: number): Promise<void> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT 
        (SELECT COUNT(*) FROM referrals WHERE referrer_id = ?) as total_referrals,
        (SELECT COALESCE(SUM(total_deposit), 0) FROM referrals WHERE referrer_id = ?) as total_deposit
       FROM users WHERE id = ?`,
      [userId, userId, userId],
      (err: Error | null, stats: { total_referrals: number; total_deposit: number } | undefined) => {
        if (err) {
          reject(err)
          return
        }
        
        database.get(
          `SELECT name FROM partner_ranks 
           WHERE min_referrals <= ? AND min_deposit <= ?
           ORDER BY min_referrals DESC, min_deposit DESC LIMIT 1`,
          [stats?.total_referrals || 0, stats?.total_deposit || 0],
          (err: Error | null, rank: { name: string } | undefined) => {
            if (err) {
              reject(err)
              return
            }
            
            if (rank) {
              database.run(
                `UPDATE users SET referral_rank = ? WHERE id = ?`,
                [rank.name, userId],
                (err: Error | null) => {
                  if (err) reject(err)
                  else {
                    console.log('✅ Partner rank updated for user:', userId, rank.name)
                    resolve()
                  }
                }
              )
            } else {
              resolve()
            }
          }
        )
      }
    )
  })
}

// Запрос на выплату
export async function requestPayout(userId: number, amount: number, method: string, details: string): Promise<void> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT pending_commission FROM users WHERE id = ?`,
      [userId],
      (err: Error | null, user: { pending_commission: number } | undefined) => {
        if (err || !user) {
          reject(err || new Error('User not found'))
          return
        }
        
        if (user.pending_commission < amount) {
          reject(new Error('Insufficient commission balance'))
          return
        }
        
        database.run(
          `INSERT INTO partner_payouts (user_id, amount, method, details) VALUES (?, ?, ?, ?)`,
          [userId, amount, method, details],
          function(this: sqlite3.RunResult, err: Error | null) {
            if (err) {
              reject(err)
              return
            }
            
            database.run(
              `UPDATE users SET pending_commission = pending_commission - ? WHERE id = ?`,
              [amount, userId],
              (err: Error | null) => {
                if (err) reject(err)
                else {
                  console.log('✅ Payout requested for user:', userId, '$' + amount)
                  resolve()
                }
              }
            )
          }
        )
      }
    )
  })
}

// 📌 ФУНКЦИИ ДЛЯ СИГНАЛОВ

// Получение лимита сигналов на основе баланса
export function getSignalLimitByBalance(balance: number, isAdmin: boolean = false): number {
  if (isAdmin) return 999; // Админ без лимита
  if (balance >= 200) return 5;
  if (balance >= 100) return 4;
  if (balance >= 50) return 3;
  if (balance >= 25) return 2;
  return 1;
}

// Получение количества использованных сигналов за сегодня
export async function getTodaySignalsUsed(userId: number): Promise<number> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    
    database.get(
      `SELECT COUNT(*) as count FROM signal_usage 
       WHERE user_id = ? AND date(used_at) = date(?)`,
      [userId, today],
      (err: Error | null, row: any) => {
        if (err) {
          console.error('❌ Error getting today signals used:', err)
          reject(err)
        } else {
          resolve(row?.count || 0)
        }
      }
    )
  })
}

// Проверка доступности сигнала для пользователя
export async function checkSignalAvailability(userId: number, isAdmin: boolean = false): Promise<{
  available: boolean;
  used: number;
  limit: number;
  balance?: number;
}> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT balance FROM users WHERE id = ?`,
      [userId],
      async (err: Error | null, user: { balance: number } | undefined) => {
        if (err || !user) {
          reject(err || new Error('User not found'))
          return
        }
        
        const used = await getTodaySignalsUsed(userId)
        const limit = getSignalLimitByBalance(user.balance, isAdmin)
        
        resolve({
          available: used < limit,
          used,
          limit,
          balance: user.balance
        })
      }
    )
  })
}

// Запись использования сигнала
export async function recordSignalUsage(userId: number, signalData?: any): Promise<void> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO signal_usage (user_id, signal_data) VALUES (?, ?)`,
      [userId, signalData ? JSON.stringify(signalData) : null],
      function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          console.error('❌ Error recording signal usage:', err)
          reject(err)
        } else {
          console.log('✅ Signal usage recorded for user:', userId, 'ID:', this.lastID)
          resolve()
        }
      }
    )
  })
}

// Получение статистики использования сигналов для админа
export async function getSignalUsageStats(): Promise<any> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT 
        COUNT(DISTINCT user_id) as total_users_used,
        COUNT(*) as total_signals,
        COUNT(CASE WHEN date(used_at) = date('now') THEN 1 END) as today_signals,
        AVG(CASE WHEN date(used_at) = date('now') THEN 1 END) as avg_daily_per_user
       FROM signal_usage`,
      [],
      (err: Error | null, row: any) => {
        if (err) {
          console.error('❌ Error getting signal usage stats:', err)
          reject(err)
        } else {
          resolve(row || { total_users_used: 0, total_signals: 0, today_signals: 0 })
        }
      }
    )
  })
}

// 📌 СУЩЕСТВУЮЩИЕ ФУНКЦИИ

export async function findUserByEmail(email: string): Promise<User | null> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      (err: Error | null, row: User | undefined) => {
        if (err) {
          console.error('❌ Error finding user by email:', err)
          reject(err)
        } else {
          resolve(row || null)
        }
      }
    )
  })
}

export async function findUserByPocketOptionId(pocketOptionId: string): Promise<User | null> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.get(
      'SELECT * FROM users WHERE pocketOptionId = ?',
      [pocketOptionId],
      (err: Error | null, row: User | undefined) => {
        if (err) {
          console.error('❌ Error finding user by pocketOptionId:', err)
          reject(err)
        } else {
          resolve(row || null)
        }
      }
    )
  })
}

export async function findUserById(id: number): Promise<User | null> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT id, name, email, pocketOptionId, balance, phone, country, language, status, 
              createdAt, referral_code, referred_by, referral_rank, total_referrals, 
              active_referrals, total_commission, pending_commission, paid_commission, lifetime_value,
              role
       FROM users WHERE id = ?`,
      [id],
      (err: Error | null, row: User | undefined) => {
        if (err) {
          console.error('❌ Error finding user by id:', err)
          reject(err)
        } else {
          resolve(row || null)
        }
      }
    )
  })
}

export async function createUser(userData: {
  name: string
  email: string
  password: string
  pocketOptionId: string
  referralCode?: string
}): Promise<any> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    // Генерируем реферальный код для нового пользователя
    const referralCode = `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    database.run(
      `INSERT INTO users (name, email, password, pocketOptionId, balance, phone, country, language, status, referral_code, role) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.name, 
        userData.email, 
        userData.password, 
        userData.pocketOptionId,
        0,
        null,
        'Россия',
        'Русский',
        'active',
        referralCode,
        'user'
      ],
      function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          console.error('❌ Error creating user:', err)
          reject(err)
          return
        }
        
        const newUserId = this.lastID;
        
        // Если есть реферальный код, обрабатываем регистрацию по рефералке
        if (userData.referralCode) {
          registerWithReferral(userData.referralCode, newUserId)
            .then(() => {
              console.log('✅ User created with referral:', newUserId)
              resolve({
                id: newUserId,
                ...userData,
                balance: 0,
                phone: null,
                country: 'Россия',
                language: 'Русский',
                status: 'active',
                referral_code: referralCode,
                role: 'user'
              })
            })
            .catch((err) => {
              console.error('❌ Error processing referral:', err)
              resolve({
                id: newUserId,
                ...userData,
                balance: 0,
                phone: null,
                country: 'Россия',
                language: 'Русский',
                status: 'active',
                referral_code: referralCode,
                role: 'user'
              })
            })
        } else {
          console.log('✅ User created with ID:', newUserId)
          resolve({
            id: newUserId,
            ...userData,
            balance: 0,
            phone: null,
            country: 'Россия',
            language: 'Русский',
            status: 'active',
            referral_code: referralCode,
            role: 'user'
          })
        }
      }
    )
  })
}

// 📌 ФУНКЦИИ ДЛЯ POCKETOPTION ДАННЫХ

export async function getPocketOptionUser(pocketOptionId: string): Promise<any> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.get(
      'SELECT * FROM pocketoption_users WHERE pocket_option_id = ?',
      [pocketOptionId],
      (err: Error | null, row: any) => {
        if (err) {
          console.error('❌ Error getting pocketOption user:', err)
          reject(err)
        } else {
          resolve(row || null)
        }
      }
    )
  })
}

export async function savePocketOptionUser(data: {
  pocket_option_id: string
  email: string
  reg_date: string
  verification_status: string
  ftd_amount: number
  deposits_count: number
  withdrawals_count: number
  current_balance: number
  total_deposit: number
  total_withdrawal: number
}): Promise<any> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT OR REPLACE INTO pocketoption_users (
        pocket_option_id, email, reg_date, verification_status,
        ftd_amount, deposits_count, withdrawals_count,
        current_balance, total_deposit, total_withdrawal,
        last_sync, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        data.pocket_option_id,
        data.email,
        data.reg_date,
        data.verification_status,
        data.ftd_amount,
        data.deposits_count,
        data.withdrawals_count,
        data.current_balance,
        data.total_deposit,
        data.total_withdrawal
      ],
      function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          console.error('❌ Error saving pocketOption user:', err)
          reject(err)
        } else {
          console.log('✅ PocketOption user saved with ID:', this.lastID)
          resolve({
            id: this.lastID,
            ...data
          })
        }
      }
    )
  })
}

export async function checkPocketOptionIdExists(pocketOptionId: string): Promise<boolean> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    database.get(
      'SELECT 1 FROM pocketoption_users WHERE pocket_option_id = ?',
      [pocketOptionId],
      (err: Error | null, row: any) => {
        if (err) {
          console.error('❌ Error checking pocketOption ID:', err)
          reject(err)
        } else {
          resolve(!!row)
        }
      }
    )
  })
}

export async function syncUserBalance(userId: number, pocketOptionId: string): Promise<any> {
  const database = await getDb()
  
  return new Promise(async (resolve, reject) => {
    try {
      const poData = await getPocketOptionUser(pocketOptionId)
      
      if (!poData) {
        // Если данных нет, создаем запись
        await savePocketOptionUser({
          pocket_option_id: pocketOptionId,
          email: '',
          reg_date: new Date().toISOString(),
          verification_status: 'unverified',
          ftd_amount: 0,
          deposits_count: 0,
          withdrawals_count: 0,
          current_balance: 0,
          total_deposit: 0,
          total_withdrawal: 0
        });
        
        const newPoData = await getPocketOptionUser(pocketOptionId);
        if (!newPoData) {
          reject(new Error('Не удалось создать запись PocketOption'));
          return;
        }
        
        // Обновляем баланс пользователя
        database.run(
          'UPDATE users SET balance = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
          [newPoData.current_balance, userId],
          function(this: sqlite3.RunResult, err: Error | null) {
            if (err) {
              console.error('❌ Error syncing user balance:', err)
              reject(err)
            } else {
              // Возвращаем данные без вызова findUserById
              resolve({
                id: userId,
                balance: newPoData.current_balance,
                pocketoption_data: newPoData
              })
            }
          }
        )
        return;
      }
      
      // Обновляем баланс пользователя
      database.run(
        'UPDATE users SET balance = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [poData.current_balance, userId],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) {
            console.error('❌ Error syncing user balance:', err)
            reject(err)
          } else {
            // Возвращаем данные без вызова findUserById
            resolve({
              id: userId,
              balance: poData.current_balance,
              pocketoption_data: poData
            })
          }
        }
      )
    } catch (error) {
      console.error('❌ Error in syncUserBalance:', error)
      reject(error)
    }
  })
}

// Обновление данных пользователя
export async function updateUser(id: number, userData: Partial<{
  name: string
  email: string
  pocketOptionId: string
  balance: number
  phone: string | null
  country: string
  language: string
  status: string
  referral_rank: string
  total_referrals: number
  active_referrals: number
  total_commission: number
  pending_commission: number
  paid_commission: number
  lifetime_value: number
  role: string
}>): Promise<void> {
  const database = await getDb()
  
  return new Promise((resolve, reject) => {
    const fields = []
    const values = []
    
    if (userData.name !== undefined) {
      fields.push('name = ?')
      values.push(userData.name)
    }
    if (userData.email !== undefined) {
      fields.push('email = ?')
      values.push(userData.email)
    }
    if (userData.phone !== undefined) {
      fields.push('phone = ?')
      values.push(userData.phone)
    }
    if (userData.country !== undefined) {
      fields.push('country = ?')
      values.push(userData.country)
    }
    if (userData.language !== undefined) {
      fields.push('language = ?')
      values.push(userData.language)
    }
    if (userData.balance !== undefined) {
      fields.push('balance = ?')
      values.push(userData.balance)
    }
    if (userData.status !== undefined) {
      fields.push('status = ?')
      values.push(userData.status)
    }
    if (userData.pocketOptionId !== undefined) {
      fields.push('pocketOptionId = ?')
      values.push(userData.pocketOptionId)
    }
    if (userData.referral_rank !== undefined) {
      fields.push('referral_rank = ?')
      values.push(userData.referral_rank)
    }
    if (userData.total_referrals !== undefined) {
      fields.push('total_referrals = ?')
      values.push(userData.total_referrals)
    }
    if (userData.active_referrals !== undefined) {
      fields.push('active_referrals = ?')
      values.push(userData.active_referrals)
    }
    if (userData.total_commission !== undefined) {
      fields.push('total_commission = ?')
      values.push(userData.total_commission)
    }
    if (userData.pending_commission !== undefined) {
      fields.push('pending_commission = ?')
      values.push(userData.pending_commission)
    }
    if (userData.paid_commission !== undefined) {
      fields.push('paid_commission = ?')
      values.push(userData.paid_commission)
    }
    if (userData.lifetime_value !== undefined) {
      fields.push('lifetime_value = ?')
      values.push(userData.lifetime_value)
    }
    if (userData.role !== undefined) {
      fields.push('role = ?')
      values.push(userData.role)
    }
    
    if (fields.length === 0) {
      resolve()
      return
    }
    
    fields.push('updatedAt = CURRENT_TIMESTAMP')
    values.push(id)
    
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`
    
    console.log('📝 SQL Update:', sql)
    console.log('📝 Values:', values)
    
    database.run(sql, values, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) {
        console.error('❌ Error updating user:', err)
        reject(err)
      } else {
        console.log('✅ User updated, changes:', this.changes)
        resolve()
      }
    })
  })
}

// Закрыть соединение (только при завершении приложения)
export async function closeDatabase(): Promise<void> {
  const currentDb = db;
  
  if (!currentDb) {
    console.log('⚠️ База данных уже закрыта или не инициализирована')
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    currentDb.close((err) => {
      if (err) {
        console.error('Ошибка при закрытии БД:', err.message)
        reject(err)
      } else {
        console.log('✅ Соединение с БД закрыто')
        db = null
        initPromise = null
        resolve()
      }
    })
  })
}

// Обработчик завершения процесса - только на сервере
if (typeof process !== 'undefined' && process.on) {
  const handleExit = async () => {
    try {
      await closeDatabase()
    } catch (error) {
      console.error('Ошибка при закрытии БД:', error)
    }
  }

  // Обработка сигналов завершения
  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const;
  
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`📦 Получен сигнал ${signal}, закрываем соединение с БД...`)
      await handleExit()
      process.exit(0)
    })
  }

  // Для избежания утечек памяти при перезагрузке в dev режиме
  process.on('beforeExit', async () => {
    await closeDatabase()
  })
}