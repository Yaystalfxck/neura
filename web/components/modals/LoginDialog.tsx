"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  User, 
  Key, 
  CheckCircle,
  RefreshCw,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/contexts/AuthContext"; // Импортируем useAuth

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
}

// Типы для этапов восстановления пароля
type ResetPasswordStep = 'email' | 'code' | 'new_password' | 'success';

export const LoginDialog: React.FC<LoginDialogProps> = ({
  isOpen,
  onClose,
  onSwitchToRegister,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Состояния для восстановления пароля
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetStep, setResetStep] = useState<ResetPasswordStep>('email');
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // ИСПРАВЛЕНО: Используем хук useAuth
  const { login } = useAuth();

  // Таймер для повторной отправки кода
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!formData.email.trim() || !formData.password.trim()) {
      setError("Заполните все поля");
      return;
    }
    
    setIsLoading(true);

    try {
      // ИСПРАВЛЕНО: Используем функцию login из AuthContext
      const result = await login(formData.email, formData.password);
      
      if (!result.success) {
        // Проверяем конкретные ошибки
        if (result.error?.includes('PocketOption ID')) {
          setError(result.error);
        } else {
          setError(result.error || 'Неверный email или пароль');
        }
        return;
      }

      console.log("✅ Успешный вход через AuthContext!");
      
      // Закрываем диалог
      onClose();
      setFormData({ email: "", password: "" });

    } catch (error) {
      console.error('❌ Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неверный email или пароль';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  // 🔴 РЕАЛЬНЫЕ ФУНКЦИИ ДЛЯ ВОССТАНОВЛЕНИЯ ПАРОЛЯ

  // 1. Отправка кода на почту
  const handleSendResetCode = async () => {
    if (!resetEmail.trim()) {
      setResetError("Введите email");
      return;
    }

    setIsLoading(true);
    setResetError("");

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при отправке кода');
      }

      console.log(`✅ Код отправлен на ${resetEmail}`);
      setResetStep('code');
      setCountdown(60); // 60 секунд до возможности повторной отправки
      setResetSuccess(result.message || 'Код отправлен на email');
      
      // Показываем код в консоли для теста (только в разработке)
      if (result.code) {
        console.log('📧 Код для теста:', result.code);
      }
      
    } catch (error) {
      console.error('❌ Send code error:', error);
      setResetError(error instanceof Error ? error.message : 'Ошибка при отправке кода');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Проверка кода
  const handleVerifyCode = async () => {
    if (!resetCode.trim()) {
      setResetError("Введите код");
      return;
    }

    // Проверяем формат кода
    if (!/^\d{6}$/.test(resetCode)) {
      setResetError("Код должен состоять из 6 цифр");
      return;
    }

    setIsLoading(true);
    setResetError("");

    try {
      const response = await fetch('/api/reset-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: resetEmail, 
          code: resetCode 
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка проверки кода');
      }

      console.log(`✅ Код ${resetCode} принят`);
      setResetStep('new_password');
      setResetSuccess("Код подтвержден. Введите новый пароль.");
      
    } catch (error) {
      console.error('❌ Verify code error:', error);
      setResetError(error instanceof Error ? error.message : 'Неверный код. Попробуйте еще раз.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Установка нового пароля
  const handleSetNewPassword = async () => {
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      setResetError("Заполните все поля");
      return;
    }

    if (newPassword.length < 6) {
      setResetError("Пароль должен содержать минимум 6 символов");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setResetError("Пароли не совпадают");
      return;
    }

    setIsLoading(true);
    setResetError("");

    try {
      const response = await fetch('/api/reset-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: resetEmail, 
          code: resetCode, 
          newPassword 
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при смене пароля');
      }

      console.log(`✅ Пароль изменен для ${resetEmail}`);
      setResetStep('success');
      setResetSuccess("Пароль успешно изменен!");
      
    } catch (error) {
      console.error('❌ Set new password error:', error);
      setResetError(error instanceof Error ? error.message : 'Ошибка при смене пароля');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Переотправка кода
  const handleResendCode = async () => {
    if (countdown > 0) return;
    
    setResetError("");
    setResetSuccess("");
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/reset-password?email=${encodeURIComponent(resetEmail)}`, {
        method: 'GET',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при повторной отправке');
      }

      setResetSuccess(result.message || 'Код отправлен повторно');
      setCountdown(result.retryAfter || 60);
      
      // Показываем код в консоли для теста
      if (result.code) {
        console.log('📧 Новый код для теста:', result.code);
      }
      
    } catch (error) {
      console.error('❌ Resend code error:', error);
      setResetError(error instanceof Error ? error.message : 'Ошибка при отправке кода');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Закрыть восстановление пароля
  const handleCloseResetPassword = () => {
    setShowResetPassword(false);
    setResetStep('email');
    setResetEmail("");
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setResetError("");
    setResetSuccess("");
    setCountdown(0);
  };

  // 6. Вернуться к входу после успешного восстановления
  const handleBackToLogin = () => {
    handleCloseResetPassword();
    setFormData(prev => ({ ...prev, email: resetEmail }));
  };

  // Рендер окна восстановления пароля
  const renderResetPasswordContent = () => {
    switch (resetStep) {
      case 'email':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-900/30 rounded-lg">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Восстановление пароля
                </h3>
                <p className="text-sm text-gray-400">
                  Введите email для отправки кода подтверждения
                </p>
              </div>
            </div>

            {resetSuccess && (
              <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg">
                <p className="text-green-400 text-sm">{resetSuccess}</p>
              </div>
            )}

            {resetError && (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                <p className="text-red-400 text-sm">{resetError}</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="text-xs text-gray-500">
              <p>• На email будет отправлен 6-значный код</p>
              <p>• Код действителен 15 минут</p>
              <p>• Проверьте папку "Спам", если не видите письмо</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={handleCloseResetPassword}
                variant="outline"
                className="flex-1 border-gray-700 hover:border-gray-500 hover:bg-gray-900/50 text-white"
              >
                Отмена
              </Button>
              <Button
                type="button"
                onClick={handleSendResetCode}
                disabled={isLoading || !resetEmail.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Отправка...
                  </>
                ) : (
                  "Отправить код"
                )}
              </Button>
            </div>
          </div>
        );

      case 'code':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-900/30 rounded-lg">
                <Key className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Введите код подтверждения
                </h3>
                <p className="text-sm text-gray-400">
                  Код отправлен на {resetEmail}
                </p>
              </div>
            </div>

            {resetSuccess && (
              <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg">
                <p className="text-green-400 text-sm">{resetSuccess}</p>
              </div>
            )}

            {resetError && (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                <p className="text-red-400 text-sm">{resetError}</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">
                6-значный код
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full pl-4 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all text-center text-2xl tracking-widest"
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                Введите 6 цифр из письма
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-gray-500">Не получили код?</span>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={countdown > 0 || isLoading}
                className={`text-blue-400 hover:text-blue-300 ${countdown > 0 || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoading ? 'Отправка...' : 
                 countdown > 0 ? `Отправить повторно (${countdown}с)` : 'Отправить повторно'}
              </button>
            </div>

            <div className="text-xs text-gray-500 text-center">
              <p>• Проверьте папку "Спам"</p>
              <p>• Код действителен 15 минут</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={() => setResetStep('email')}
                variant="outline"
                className="flex-1 border-gray-700 hover:border-gray-500 hover:bg-gray-900/50 text-white"
              >
                Назад
              </Button>
              <Button
                type="button"
                onClick={handleVerifyCode}
                disabled={isLoading || resetCode.length !== 6}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Проверка...
                  </>
                ) : (
                  "Подтвердить код"
                )}
              </Button>
            </div>
          </div>
        );

      case 'new_password':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-900/30 rounded-lg">
                <RefreshCw className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Новый пароль
                </h3>
                <p className="text-sm text-gray-400">
                  Придумайте новый пароль для {resetEmail}
                </p>
              </div>
            </div>

            {resetSuccess && (
              <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg">
                <p className="text-green-400 text-sm">{resetSuccess}</p>
              </div>
            )}

            {resetError && (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                <p className="text-red-400 text-sm">{resetError}</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">
                Новый пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">
                Подтверждение пароля
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showConfirmNewPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                >
                  {showConfirmNewPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
              
              {newPassword && confirmNewPassword && (
                <div className="flex items-center gap-2 text-sm">
                  {newPassword === confirmNewPassword ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-500">Пароли совпадают</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-500">Пароли не совпадают</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>• Пароль должен содержать минимум 6 символов</p>
              <p>• Используйте буквы, цифры и специальные символы</p>
              <p>• Рекомендуем использовать уникальный пароль</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={() => setResetStep('code')}
                variant="outline"
                className="flex-1 border-gray-700 hover:border-gray-500 hover:bg-gray-900/50 text-white"
              >
                Назад
              </Button>
              <Button
                type="button"
                onClick={handleSetNewPassword}
                disabled={isLoading || !newPassword.trim() || !confirmNewPassword.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Сохранение...
                  </>
                ) : (
                  "Изменить пароль"
                )}
              </Button>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6 text-center">
            <div className="mx-auto w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-white">
                Пароль успешно изменен!
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                Теперь вы можете войти в аккаунт с новым паролем
              </p>
            </div>

            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-300">
                Email: <span className="font-medium">{resetEmail}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Сохраните новый пароль в надежном месте
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={handleBackToLogin}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Войти в аккаунт
              </Button>
              <Button
                type="button"
                onClick={handleCloseResetPassword}
                variant="outline"
                className="flex-1 border-gray-700 hover:border-gray-500 hover:bg-gray-900/50 text-white"
              >
                Закрыть
              </Button>
            </div>
          </div>
        );
    }
  };

  // Если показываем окно восстановления пароля
  if (showResetPassword) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseResetPassword}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md"
              >
                <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
                  {/* Заголовок */}
                  <div className="relative p-6 border-b border-gray-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-white">
                          {resetStep === 'email' && 'Восстановление пароля'}
                          {resetStep === 'code' && 'Код подтверждения'}
                          {resetStep === 'new_password' && 'Новый пароль'}
                          {resetStep === 'success' && 'Готово!'}
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                          {resetStep === 'email' && 'Шаг 1 из 3: Введите email'}
                          {resetStep === 'code' && 'Шаг 2 из 3: Введите код'}
                          {resetStep === 'new_password' && 'Шаг 3 из 3: Новый пароль'}
                          {resetStep === 'success' && 'Пароль успешно изменен'}
                        </p>
                      </div>
                      <motion.button
                        whileHover={{ rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleCloseResetPassword}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-400" />
                      </motion.button>
                    </div>
                    
                    {/* Индикатор прогресса */}
                    <div className="mt-4 flex gap-1">
                      {['email', 'code', 'new_password', 'success'].map((stepName, index) => {
                        const stepIndex = ['email', 'code', 'new_password', 'success'].indexOf(resetStep);
                        const isActive = index <= stepIndex;
                        return (
                          <div
                            key={stepName}
                            className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                              isActive ? 'bg-blue-500' : 'bg-gray-700'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Содержимое */}
                  <div className="p-6">
                    {renderResetPasswordContent()}
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Оригинальное окно входа
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md"
            >
              <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="relative p-6 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-900/30 rounded-lg">
                        <User className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">Вход в аккаунт</h2>
                        <p className="text-sm text-gray-400 mt-1">
                          Введите данные для входа
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onClose}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </motion.button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-900/30 border border-red-800 rounded-lg"
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                        <div>
                          <p className="text-red-400 font-medium">Ошибка входа</p>
                          <p className="text-red-300 text-sm mt-1">{error}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="your@email.com"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-300">
                      Пароль
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required
                        className="w-full pl-10 pr-12 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 🔴 КНОПКА "ЗАБЫЛИ ПАРОЛЬ" */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm text-blue-400 hover:text-blue-300"
                      onClick={() => {
                        setShowResetPassword(true);
                        // Автозаполняем email из формы входа
                        if (formData.email) {
                          setResetEmail(formData.email);
                        }
                      }}
                    >
                      Забыли пароль?
                    </button>
                  </div>

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                          Проверка данных...
                        </span>
                      ) : (
                        "Войти"
                      )}
                    </Button>

                    <div className="text-center text-xs text-gray-500">
                      <div className="flex items-center justify-center gap-1">
                        <Key className="w-3 h-3 text-green-500" />
                        <p>Требуется PocketOption ID для входа</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center pt-4 border-t border-gray-800">
                    <p className="text-gray-400">
                      Нет аккаунта?{" "}
                      <button
                        type="button"
                        onClick={onSwitchToRegister}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Зарегистрироваться
                      </button>
                    </p>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};