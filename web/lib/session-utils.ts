import { randomBytes } from 'crypto'

// Генерация токена сессии
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

// Валидация email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Проверка сложности пароля
export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 6) {
    errors.push('Пароль должен содержать минимум 6 символов')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Пароль должен содержать хотя бы одну заглавную букву')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Пароль должен содержать хотя бы одну цифру')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Форматирование даты
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}