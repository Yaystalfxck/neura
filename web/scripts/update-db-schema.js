// scripts/update-database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'neura.db');
const DB_DIR = path.dirname(DB_PATH);

// 🔴 НОВЫЕ ТАБЛИЦЫ ДЛЯ POCKETOPTION
const TABLES_CONFIG = {
  users: `
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
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expiresAt DATETIME NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  
  pocketoption_users: `
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
  `,
  
  password_reset_codes: `
    CREATE TABLE IF NOT EXISTS password_reset_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
    )
  `,
  
  trades: `
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
  `
};

// 🔴 ФУНКЦИЯ ДЛЯ ПЕРЕСОЗДАНИЯ БАЗЫ
async function recreateDatabase() {
  console.log('🔄 Начинаем пересоздание базы данных...');
  
  try {
    // Закрываем все соединения (если есть)
    if (global.dbConnections && global.dbConnections.length > 0) {
      console.log('⚠️  Закрываем активные соединения...');
      for (const db of global.dbConnections) {
        try { db.close(); } catch (e) {}
      }
    }
    
    // Удаляем старый файл БД
    if (fs.existsSync(DB_PATH)) {
      console.log('🗑️  Удаляем старую базу данных...');
      fs.unlinkSync(DB_PATH);
    }
    
    // Создаем папку если нет
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      console.log('📁 Создана папка data/');
    }
    
    // Создаем новую базу
    console.log('🆕 Создаем новую базу данных...');
    const db = new sqlite3.Database(DB_PATH);
    
    // Включаем поддержку внешних ключей
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Включены внешние ключи');
          resolve();
        }
      });
    });
    
    // Создаем все таблицы
    for (const [tableName, createSQL] of Object.entries(TABLES_CONFIG)) {
      await new Promise((resolve, reject) => {
        db.run(createSQL, (err) => {
          if (err) {
            console.error(`❌ Ошибка создания таблицы ${tableName}:`, err.message);
            reject(err);
          } else {
            console.log(`✅ Таблица ${tableName} создана`);
            resolve();
          }
        });
      });
    }
    
    // Создаем индексы
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email 
       ON password_reset_codes(email, expires_at, used)`,
       
      `CREATE INDEX IF NOT EXISTS idx_pocketoption_users_id 
       ON pocketoption_users(pocket_option_id)`,
       
      `CREATE INDEX IF NOT EXISTS idx_users_pocket_option_id 
       ON users(pocketOptionId)`,
       
      `CREATE INDEX IF NOT EXISTS idx_users_email 
       ON users(email)`,
       
      `CREATE INDEX IF NOT EXISTS idx_sessions_token 
       ON sessions(token)`,
       
      `CREATE INDEX IF NOT EXISTS idx_sessions_userId 
       ON sessions(userId)`
    ];
    
    for (const indexSQL of indexes) {
      await new Promise((resolve, reject) => {
        db.run(indexSQL, (err) => {
          if (err) reject(err);
          else {
            console.log('✅ Индекс создан');
            resolve();
          }
        });
      });
    }
    
    // Проверяем структуру базы
    console.log('\n📊 Проверяем структуру базы данных...');
    
    await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) reject(err);
        else {
          console.log('\n📋 Созданные таблицы:');
          tables.forEach(table => console.log(`  • ${table.name}`));
          
          // Показываем количество записей в каждой таблице
          db.all(
            `SELECT 'users' as table_name, COUNT(*) as count FROM users
             UNION ALL
             SELECT 'sessions', COUNT(*) FROM sessions
             UNION ALL
             SELECT 'pocketoption_users', COUNT(*) FROM pocketoption_users
             UNION ALL
             SELECT 'password_reset_codes', COUNT(*) FROM password_reset_codes
             UNION ALL
             SELECT 'trades', COUNT(*) FROM trades`,
            (err, counts) => {
              if (err) reject(err);
              else {
                console.log('\n📈 Количество записей:');
                counts.forEach(row => {
                  console.log(`  • ${row.table_name}: ${row.count} записей`);
                });
                resolve();
              }
            }
          );
        }
      });
    });
    
    db.close();
    
    console.log('\n🎉 База данных успешно пересоздана!');
    console.log('📍 Путь к базе:', DB_PATH);
    
  } catch (error) {
    console.error('❌ Критическая ошибка при пересоздании базы:', error.message);
    process.exit(1);
  }
}

// 🔴 ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ БЕЗ УДАЛЕНИЯ
async function updateDatabaseSchema() {
  console.log('🔧 Обновление структуры базы данных (без удаления)...');
  
  const db = new sqlite3.Database(DB_PATH);
  
  try {
    // Включаем внешние ключи
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Создаем новые таблицы если их нет
    for (const [tableName, createSQL] of Object.entries(TABLES_CONFIG)) {
      await new Promise((resolve, reject) => {
        db.run(createSQL, (err) => {
          if (err) {
            console.error(`❌ Ошибка с таблицей ${tableName}:`, err.message);
            // Пропускаем ошибки если таблица уже существует с другой структурой
          }
          console.log(`✅ Таблица ${tableName} проверена`);
          resolve();
        });
      });
    }
    
    // Добавляем недостающие колонки в таблицу users
    const columnsToAdd = [
      { name: 'phone', type: 'TEXT' },
      { name: 'country', type: 'TEXT DEFAULT "Россия"' },
      { name: 'language', type: 'TEXT DEFAULT "Русский"' }
    ];
    
    // Проверяем существующие колонки
    const existingColumns = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(users)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.name));
      });
    });
    
    console.log('\n🔍 Проверяем наличие колонок в таблице users:');
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        try {
          await new Promise((resolve, reject) => {
            const sql = `ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`;
            db.run(sql, (err) => {
              if (err) {
                console.error(`❌ Ошибка добавления колонки ${column.name}:`, err.message);
                reject(err);
              } else {
                console.log(`✅ Добавлена колонка: ${column.name}`);
                resolve();
              }
            });
          });
        } catch (error) {
          console.log(`⚠️  Колонка ${column.name} уже существует или не может быть добавлена`);
        }
      } else {
        console.log(`✅ Колонка ${column.name} уже существует`);
      }
    }
    
    // Очищаем старые коды восстановления
    await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM password_reset_codes 
         WHERE expires_at < datetime('now', '-1 hour')`,
        function(err) {
          if (err) reject(err);
          else {
            if (this.changes > 0) {
              console.log(`✅ Очищено ${this.changes} просроченных кодов`);
            }
            resolve();
          }
        }
      );
    });
    
    console.log('\n🎯 Структура базы данных обновлена!');
    
  } catch (error) {
    console.error('❌ Ошибка обновления БД:', error.message);
  } finally {
    db.close();
  }
}

// 🔴 ФУНКЦИЯ ДЛЯ РЕЗЕРВНОГО КОПИРОВАНИЯ
async function backupDatabase() {
  console.log('💾 Создание резервной копии базы данных...');
  
  if (!fs.existsSync(DB_PATH)) {
    console.log('⚠️  База данных не найдена, резервная копия не требуется');
    return;
  }
  
  const backupDir = path.join(DB_DIR, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `neura-backup-${timestamp}.db`);
  
  try {
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`✅ Резервная копия создана: ${backupPath}`);
  } catch (error) {
    console.error('❌ Ошибка создания резервной копии:', error.message);
  }
}

// 🔴 ФУНКЦИЯ ДЛЯ ДОБАВЛЕНИЯ КОЛОНОК В СУЩЕСТВУЮЩУЮ БАЗУ
async function addMissingColumns() {
  console.log('➕ Добавление недостающих колонок в существующую базу...');
  
  if (!fs.existsSync(DB_PATH)) {
    console.log('❌ База данных не найдена!');
    return;
  }
  
  const db = new sqlite3.Database(DB_PATH);
  
  try {
    // Проверяем существующие колонки
    const existingColumns = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(users)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.name));
      });
    });
    
    console.log('📊 Существующие колонки:', existingColumns);
    
    // Колонки для добавления
    const columnsToAdd = [
      { name: 'phone', sql: 'ADD COLUMN phone TEXT' },
      { name: 'country', sql: 'ADD COLUMN country TEXT DEFAULT "Россия"' },
      { name: 'language', sql: 'ADD COLUMN language TEXT DEFAULT "Русский"' }
    ];
    
    let addedCount = 0;
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        try {
          await new Promise((resolve, reject) => {
            const sql = `ALTER TABLE users ${column.sql}`;
            console.log(`🔄 Выполняем: ${sql}`);
            db.run(sql, (err) => {
              if (err) {
                console.error(`❌ Ошибка добавления ${column.name}:`, err.message);
                reject(err);
              } else {
                console.log(`✅ Добавлена колонка: ${column.name}`);
                addedCount++;
                resolve();
              }
            });
          });
        } catch (error) {
          console.log(`⚠️  Не удалось добавить ${column.name}, возможно уже существует`);
        }
      } else {
        console.log(`✅ Колонка ${column.name} уже существует`);
      }
    }
    
    if (addedCount > 0) {
      console.log(`\n✅ Добавлено ${addedCount} колонок`);
    } else {
      console.log('\n✅ Все колонки уже существуют');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    db.close();
  }
}

// 🔴 ГЛАВНАЯ ФУНКЦИЯ
async function main() {
  const command = process.argv[2];
  
  console.log('🚀 Утилита управления базой данных Neura\n');
  
  switch (command) {
    case 'recreate':
      console.log('Выбран режим: ПЕРЕСОЗДАНИЕ БАЗЫ ДАННЫХ\n');
      await backupDatabase();
      await recreateDatabase();
      break;
      
    case 'update':
      console.log('Выбран режим: ОБНОВЛЕНИЕ СТРУКТУРЫ\n');
      await updateDatabaseSchema();
      break;
      
    case 'backup':
      console.log('Выбран режим: РЕЗЕРВНОЕ КОПИРОВАНИЕ\n');
      await backupDatabase();
      break;
      
    case 'check':
      console.log('Выбран режим: ПРОВЕРКА СТРУКТУРЫ\n');
      await checkDatabase();
      break;
      
    case 'add-columns':
      console.log('Выбран режим: ДОБАВЛЕНИЕ КОЛОНОК\n');
      await addMissingColumns();
      break;
      
    default:
      console.log('Использование:');
      console.log('  node scripts/update-database.js [command]');
      console.log('\nДоступные команды:');
      console.log('  recreate     - Полностью пересоздать базу данных');
      console.log('  update       - Обновить структуру без удаления данных');
      console.log('  backup       - Создать резервную копию текущей базы');
      console.log('  check        - Проверить структуру базы');
      console.log('  add-columns  - Добавить недостающие колонки (phone, country, language)');
      console.log('\nПример:');
      console.log('  node scripts/update-database.js add-columns');
  }
}

// 🔴 ФУНКЦИЯ ПРОВЕРКИ
async function checkDatabase() {
  console.log('🔍 Проверка структуры базы данных...');
  
  if (!fs.existsSync(DB_PATH)) {
    console.log('❌ База данных не найдена!');
    return;
  }
  
  const db = new sqlite3.Database(DB_PATH);
  
  try {
    // Получаем список таблиц
    const tables = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('\n📋 Найдено таблиц:', tables.length);
    
    // Проверяем каждую таблицу
    for (const table of tables) {
      const columns = await new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table.name})`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      console.log(`\n📄 Таблица: ${table.name}`);
      console.log('  Колонки:');
      columns.forEach(col => {
        console.log(`    • ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
      });
      
      // Считаем записи
      const count = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      
      console.log(`  Записей: ${count}`);
    }
    
    console.log('\n✅ Проверка завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка проверки:', error.message);
  } finally {
    db.close();
  }
}

// Запуск
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Непредвиденная ошибка:', error);
    process.exit(1);
  });
}

// Экспорт функций
module.exports = { 
  recreateDatabase, 
  updateDatabaseSchema, 
  backupDatabase,
  checkDatabase,
  addMissingColumns
};