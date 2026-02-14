const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'neura.db');
const BACKUP_PATH = path.join(__dirname, '..', 'data', 'neura_backup.db');

async function backupDatabase() {
  return new Promise((resolve, reject) => {
    try {
      if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, BACKUP_PATH);
        console.log('💾 Создана резервная копия базы данных');
        resolve(true);
      } else {
        console.log('ℹ️ Файл базы данных не найден для резервного копирования');
        resolve(false);
      }
    } catch (error) {
      console.error('⚠️ Не удалось создать резервную копию:', error.message);
      reject(error);
    }
  });
}

async function cleanupExpiredRegistrations() {
  console.log('='.repeat(60));
  console.log('🧹 ЗАПУСК ОЧИСТКИ ПРОСРОЧЕННЫХ РЕГИСТРАЦИЙ');
  console.log('='.repeat(60));
  
  // 1. Проверяем существование файла БД
  if (!fs.existsSync(DB_PATH)) {
    console.log('❌ Файл базы данных не найден:', DB_PATH);
    console.log('   Создайте базу данных через регистрацию пользователя');
    return;
  }
  
  console.log('📁 Путь к базе данных:', DB_PATH);
  console.log('📅 Дата и время запуска:', new Date().toLocaleString());
  
  // 2. Создаем резервную копию
  try {
    await backupDatabase();
  } catch (error) {
    console.log('⚠️ Продолжаем без резервной копии...');
  }
  
  const db = new sqlite3.Database(DB_PATH);
  
  try {
    // 3. Проверяем структуру базы данных
    console.log('\n🔍 Проверка структуры базы данных...');
    
    const tables = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    console.log('📋 Таблицы в базе:');
    tables.forEach(table => console.log(`   - ${table.name}`));
    
    if (!tables.some(t => t.name === 'users')) {
      console.log('❌ Таблица users не найдена!');
      return;
    }
    
    // 4. Получаем текущую статистику ДО очистки
    console.log('\n📊 СТАТИСТИКА ДО ОЧИСТКИ:');
    
    const statsBefore = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          status,
          COUNT(*) as count,
          MIN(datetime(createdAt)) as oldest,
          MAX(datetime(createdAt)) as newest
        FROM users 
        GROUP BY status
        ORDER BY status
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    statsBefore.forEach(stat => {
      console.log(`   📌 ${stat.status.toUpperCase()}:`);
      console.log(`      Количество: ${stat.count}`);
      console.log(`      Самая старая: ${stat.oldest || 'нет данных'}`);
      console.log(`      Самая новая: ${stat.newest || 'нет данных'}`);
    });
    
    // 5. Находим просроченные регистрации
    console.log('\n🔎 Поиск просроченных регистраций...');
    
    const expiredUsers = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          id,
          email,
          status,
          datetime(createdAt) as created,
          julianday('now') - julianday(createdAt) as days_passed
        FROM users 
        WHERE status = 'pending'
        AND julianday('now') - julianday(createdAt) > 1  -- больше 1 дня
        ORDER BY createdAt
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    console.log(`📋 Найдено ${expiredUsers.length} просроченных регистраций:`);
    
    if (expiredUsers.length > 0) {
      expiredUsers.slice(0, 5).forEach(user => {
        console.log(`   👤 ${user.email} (создан: ${user.created}, прошло дней: ${user.days_passed.toFixed(1)})`);
      });
      
      if (expiredUsers.length > 5) {
        console.log(`   ... и еще ${expiredUsers.length - 5} записей`);
      }
      
      // 6. Выполняем удаление
      console.log('\n🗑️  УДАЛЕНИЕ ПРОСРОЧЕННЫХ РЕГИСТРАЦИЙ...');
      
      const deleteResult = await new Promise((resolve, reject) => {
        db.run(`
          DELETE FROM users 
          WHERE status = 'pending'
          AND julianday('now') - julianday(createdAt) > 1
        `, function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
      });
      
      console.log(`✅ Удалено ${deleteResult} записей`);
      
    } else {
      console.log('✅ Нет просроченных регистраций для удаления');
    }
    
    // 7. Получаем статистику ПОСЛЕ очистки
    console.log('\n📊 СТАТИСТИКА ПОСЛЕ ОЧИСТКИ:');
    
    const statsAfter = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          status,
          COUNT(*) as count
        FROM users 
        GROUP BY status
        ORDER BY status
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    statsAfter.forEach(stat => {
      console.log(`   📌 ${stat.status.toUpperCase()}: ${stat.count} пользователей`);
    });
    
    // 8. Сводка
    console.log('\n' + '='.repeat(60));
    console.log('📋 СВОДКА:');
    
    const pendingBefore = statsBefore.find(s => s.status === 'pending')?.count || 0;
    const pendingAfter = statsAfter.find(s => s.status === 'pending')?.count || 0;
    const deleted = pendingBefore - pendingAfter;
    
    console.log(`   Удалено записей: ${deleted}`);
    console.log(`   Осталось pending: ${pendingAfter}`);
    console.log(`   Всего пользователей: ${statsAfter.reduce((sum, stat) => sum + stat.count, 0)}`);
    
  } catch (error) {
    console.error('\n❌ ОШИБКА ВЫПОЛНЕНИЯ:');
    console.error('   Сообщение:', error.message);
    
    // Дополнительная информация для отладки
    if (error.message.includes('SQLITE_ERROR')) {
      console.error('   Тип: Ошибка SQLite');
      console.error('   Проверьте структуру базы данных');
    }
    
  } finally {
    // 9. Закрываем соединение
    db.close((err) => {
      if (err) {
        console.error('⚠️ Ошибка при закрытии БД:', err.message);
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 ОЧИСТКА ЗАВЕРШЕНА');
    console.log('='.repeat(60));
  }
}

// Запускаем при вызове
if (require.main === module) {
  cleanupExpiredRegistrations()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Фатальная ошибка:', error);
      process.exit(1);
    });
}

module.exports = { cleanupExpiredRegistrations, backupDatabase };