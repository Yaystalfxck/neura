import { savePocketOptionUser } from '@/lib/database';
import crypto from 'crypto';

// Пример данных для заполнения
const mockPocketOptionUsers = [
  {
    pocket_option_id: 'RO-123456',
    email: 'user1@example.com',
    reg_date: '2024-01-15 10:30:00',
    verification_status: 'verified',
    ftd_amount: 1000,
    deposits_count: 3,
    withdrawals_count: 1,
    current_balance: 2500,
    total_deposit: 3000,
    total_withdrawal: 500
  },
  {
    pocket_option_id: 'RO-789012',
    email: 'user2@example.com',
    reg_date: '2024-01-20 14:45:00',
    verification_status: 'pending',
    ftd_amount: 500,
    deposits_count: 2,
    withdrawals_count: 0,
    current_balance: 1500,
    total_deposit: 2000,
    total_withdrawal: 0
  },
  // Добавьте больше тестовых пользователей
];

async function fillDatabase() {
  console.log('Начинаем заполнение базы PocketOption данными...');
  
  for (const user of mockPocketOptionUsers) {
    try {
      await savePocketOptionUser(user);
      console.log(`✅ Добавлен пользователь: ${user.pocket_option_id}`);
    } catch (error) {
      console.error(`❌ Ошибка при добавлении ${user.pocket_option_id}:`, error);
    }
  }
  
  console.log('Заполнение базы завершено!');
}

// Запуск скрипта
fillDatabase();