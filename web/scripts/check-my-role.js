const sqlite3 = require('sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'neura.db');
const db = new sqlite3.Database(DB_PATH);

const myEmail = 'yaystal@mail.ru';

console.log(`🔍 Проверка роли пользователя ${myEmail}...\n`);

db.get("SELECT id, email, role FROM users WHERE email = ?", [myEmail], (err, user) => {
  if (err) {
    console.error('❌ Ошибка:', err.message);
  } else if (user) {
    console.log('📊 Данные пользователя:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Роль: ${user.role || 'user'}`);
    
    if (user.role === 'admin') {
      console.log('✅ У вас есть права администратора!');
    } else {
      console.log('❌ У вас НЕТ прав администратора. Текущая роль:', user.role || 'user');
      console.log('\n🔧 Исправление: запустите node scripts/make-me-admin.js');
    }
  } else {
    console.log('❌ Пользователь не найден');
  }
  
  db.close();
});