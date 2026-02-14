const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(process.cwd(), 'data', 'neura.db');

// Проверяем существование БД
if (!fs.existsSync(DB_PATH)) {
  console.error('❌ База данных не найдена по пути:', DB_PATH);
  console.log('📝 Создайте базу данных, запустив приложение сначала');
  process.exit(1);
}

const db = new sqlite3.Database(DB_PATH);

console.log('📦 Подключено к базе данных');
console.log('🔄 Начинаем миграцию...\n');

// Функция для выполнения последовательных миграций
async function runMigrations() {
  // 1. Добавляем колонку role
  await new Promise((resolve) => {
    db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'", function(err) {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log('✅ Колонка role уже существует');
        } else {
          console.error('❌ Ошибка добавления колонки role:', err.message);
        }
      } else {
        console.log('✅ Колонка role успешно добавлена');
      }
      resolve();
    });
  });

  // 2. Добавляем недостающие колонки для партнерской программы (если их нет)
  const partnerColumns = [
    { name: 'total_referrals', type: 'INTEGER DEFAULT 0' },
    { name: 'active_referrals', type: 'INTEGER DEFAULT 0' },
    { name: 'total_commission', type: 'REAL DEFAULT 0' },
    { name: 'pending_commission', type: 'REAL DEFAULT 0' },
    { name: 'paid_commission', type: 'REAL DEFAULT 0' },
    { name: 'lifetime_value', type: 'REAL DEFAULT 0' },
    { name: 'referral_rank', type: "TEXT DEFAULT 'Bronze'" }
  ];

  for (const column of partnerColumns) {
    await new Promise((resolve) => {
      db.run(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`, function(err) {
        if (err) {
          if (err.message.includes('duplicate column name')) {
            console.log(`✅ Колонка ${column.name} уже существует`);
          } else {
            console.error(`❌ Ошибка добавления колонки ${column.name}:`, err.message);
          }
        } else {
          console.log(`✅ Колонка ${column.name} успешно добавлена`);
        }
        resolve();
      });
    });
  }

  // 3. Добавляем колонки в referral_links если их нет
  const linkColumns = [
    { name: 'unique_clicks', type: 'INTEGER DEFAULT 0' },
    { name: 'registrations', type: 'INTEGER DEFAULT 0' },
    { name: 'conversions', type: 'INTEGER DEFAULT 0' }
  ];

  for (const column of linkColumns) {
    await new Promise((resolve) => {
      db.run(`ALTER TABLE referral_links ADD COLUMN ${column.name} ${column.type}`, function(err) {
        if (err) {
          if (err.message.includes('duplicate column name')) {
            console.log(`✅ Колонка ${column.name} уже существует в referral_links`);
          } else if (err.message.includes('no such table')) {
            console.log(`⚠️ Таблица referral_links еще не создана`);
          } else {
            console.error(`❌ Ошибка добавления колонки ${column.name} в referral_links:`, err.message);
          }
        } else {
          console.log(`✅ Колонка ${column.name} успешно добавлена в referral_links`);
        }
        resolve();
      });
    });
  }

  // 4. Делаем пользователя yaystal@mail.ru админом
  await new Promise((resolve) => {
    db.get("SELECT id, email, role FROM users WHERE email = ?", ['yaystal@mail.ru'], (err, user) => {
      if (err) {
        console.error('❌ Ошибка поиска пользователя:', err.message);
        resolve();
        return;
      }

      if (!user) {
        console.log('⚠️ Пользователь yaystal@mail.ru не найден в базе');
        console.log('📝 Список всех пользователей:');
        
        db.all("SELECT id, email, role FROM users", (err, users) => {
          if (err) {
            console.error('❌ Ошибка получения списка пользователей:', err.message);
          } else if (users.length > 0) {
            users.forEach(u => {
              console.log(`   ID: ${u.id}, Email: ${u.email}, Роль: ${u.role || 'user'}`);
            });
          } else {
            console.log('   Пользователи отсутствуют');
          }
          resolve();
        });
      } else {
        console.log('📊 Текущие данные пользователя:', user);
        
        db.run(
          "UPDATE users SET role = 'admin' WHERE email = ?",
          ['yaystal@mail.ru'],
          function(err) {
            if (err) {
              console.error('❌ Ошибка обновления роли:', err.message);
            } else {
              if (this.changes > 0) {
                console.log('✅ Пользователь yaystal@mail.ru назначен админом');
              } else {
                console.log('⚠️ Роль пользователя не изменилась');
              }
            }
            
            // Проверяем результат
            db.get("SELECT id, email, role FROM users WHERE email = ?", ['yaystal@mail.ru'], (err, updatedUser) => {
              if (err) {
                console.error('❌ Ошибка проверки:', err.message);
              } else if (updatedUser) {
                console.log('📊 Итоговые данные пользователя:', updatedUser);
              }
              resolve();
            });
          }
        );
      }
    });
  });

  // 5. Добавляем тестовые данные для демонстрации (опционально)
  await new Promise((resolve) => {
    db.get("SELECT COUNT(*) as count FROM referrals", (err, result) => {
      if (!err && result.count === 0) {
        console.log('\n📝 Добавляем тестовые данные...');
        
        // Получаем ID пользователя
        db.get("SELECT id FROM users WHERE email = ?", ['yaystal@mail.ru'], (err, user) => {
          if (user) {
            // Создаем тестовую реферальную ссылку если её нет
            db.get("SELECT id FROM referral_links WHERE user_id = ?", [user.id], (err, link) => {
              if (!link) {
                const testCode = `test_${Date.now()}`;
                const testUrl = `http://localhost:3000/register?ref=${testCode}`;
                
                db.run(
                  `INSERT INTO referral_links (user_id, code, url, is_active) VALUES (?, ?, ?, 1)`,
                  [user.id, testCode, testUrl],
                  function(err) {
                    if (err) {
                      console.log('⚠️ Не удалось создать тестовую ссылку:', err.message);
                    } else {
                      console.log('✅ Тестовая реферальная ссылка создана');
                    }
                  }
                );
              }
            });
          }
        });
      }
      resolve();
    });
  });

  console.log('\n✅ Миграция завершена');
}

// Запускаем миграции
runMigrations().then(() => {
  // Закрываем соединение через 1 секунду
  setTimeout(() => {
    db.close((err) => {
      if (err) {
        console.error('❌ Ошибка при закрытии БД:', err.message);
      } else {
        console.log('✅ Соединение с БД закрыто');
      }
    });
  }, 1000);
});