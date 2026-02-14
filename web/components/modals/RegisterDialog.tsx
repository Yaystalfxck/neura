// components/modals/RegisterDialog.tsx
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  User, 
  Check, 
  Key, 
  ExternalLink,
  Info,
  AlertCircle,
  Shield,
  Wallet,
  CreditCard,
  CheckCircle,
  XCircle,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RegisterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

interface PocketOptionData {
  exists: boolean;
  data?: {
    pocket_option_id: string;
    email: string;
    verification_status: string;
    deposits_count: number;
    current_balance: number;
  };
  message?: string;
  source?: string;
}

type RegistrationStep = 'basic' | 'pocketOption';

export const RegisterDialog: React.FC<RegisterDialogProps> = ({
  isOpen,
  onClose,
  onSwitchToLogin,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    pocketOptionId: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPocketOption, setIsCheckingPocketOption] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPocketOptionInfo, setShowPocketOptionInfo] = useState(false);
  const [pocketOptionData, setPocketOptionData] = useState<PocketOptionData | null>(null);
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('basic');
  const [basicRegistrationCompleted, setBasicRegistrationCompleted] = useState(false);
  
  // Дебаунс для проверки PocketOption ID
  const [checkTimeout, setCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  const pocketOptionLink = "https://pocketoption.com/signup?ref=NEURA54321";

  const handleOpenPocketOption = () => {
    window.open(pocketOptionLink, '_blank');
  };

  // 🔴 Функция для проверки PocketOption ID
  const checkPocketOptionId = async (id: string) => {
    if (!id.trim() || id.length < 3) {
      setPocketOptionData(null);
      return;
    }

    setIsCheckingPocketOption(true);
    setPocketOptionData(null);
    setError("");

    try {
      const response = await fetch(
        `/api/check-pocketoption?pocketOptionId=${encodeURIComponent(id)}`
      );
      
      const result = await response.json();
      
      if (result.success) {
        setPocketOptionData(result);
        
        if (!result.exists) {
          setError("❌ PocketOption ID не найден. Сначала зарегистрируйтесь на PocketOption");
        } else {
          setSuccess(`✅ PocketOption ID проверен!`);
          
          // Автозаполнение email если он есть в данных PocketOption
          if (result.data?.email && !formData.email) {
            setFormData(prev => ({
              ...prev,
              email: result.data.email
            }));
          }
        }
      } else {
        setError(result.error || "Ошибка проверки PocketOption ID");
      }
    } catch (error) {
      console.error('PocketOption check error:', error);
      setError("Ошибка соединения с сервером проверки");
    } finally {
      setIsCheckingPocketOption(false);
    }
  };

  // 🔴 Дебаунс проверки PocketOption ID при вводе
  useEffect(() => {
    if (checkTimeout) {
      clearTimeout(checkTimeout);
    }

    if (formData.pocketOptionId.length >= 3) {
      const timeout = setTimeout(() => {
        checkPocketOptionId(formData.pocketOptionId);
      }, 800); // Задержка 800мс

      setCheckTimeout(timeout);
    }

    return () => {
      if (checkTimeout) {
        clearTimeout(checkTimeout);
      }
    };
  }, [formData.pocketOptionId]);

  // Функция для завершения базовой регистрации
  const handleBasicRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Валидация
    if (formData.password !== formData.confirmPassword) {
      setError("Пароли не совпадают!");
      return;
    }
    
    if (formData.password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов!");
      return;
    }
    
    // Проверка email на существование
    try {
      const response = await fetch(`/api/register?email=${encodeURIComponent(formData.email)}`);
      const result = await response.json();
      
      if (result.success && result.checks?.email?.exists) {
        setError("Этот email уже зарегистрирован");
        return;
      }
    } catch (error) {
      console.error('Email check error:', error);
    }
    
    setBasicRegistrationCompleted(true);
    setCurrentStep('pocketOption');
  };

  // Функция для финальной регистрации с PocketOption ID
  const handleFinalRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!formData.pocketOptionId.trim()) {
      setError("Введите ваш PocketOption ID!");
      return;
    }
    
    // 🔴 Проверка, что PocketOption ID существует
    if (!pocketOptionData?.exists) {
      setError("Сначала проверьте ваш PocketOption ID");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          pocketOptionId: formData.pocketOptionId,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка регистрации');
      }
      
      console.log('Регистрация успешна:', result);
      
      setSuccess("✅ Регистрация успешно завершена! Теперь вы можете войти.");
      
      // Автоматически закрываем через 3 секунды
      setTimeout(() => {
        onClose();
        onSwitchToLogin();
      }, 3000);
      
    } catch (error) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'Ошибка при регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  // Компонент для отображения данных PocketOption
  

  // Шаг 1: Базовая регистрация
  const renderBasicStep = () => (
    <form onSubmit={handleBasicRegistration} className="p-6 space-y-4">
      {/* Заголовок */}
      <div className="text-center mb-2">
        <h3 className="text-lg font-bold text-white">Шаг 1: Создание аккаунта</h3>
        <p className="text-sm text-gray-400 mt-1">Заполните основные данные</p>
      </div>

      {/* Показ ошибок */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 bg-red-900/30 border border-red-800 rounded-lg flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </motion.div>
      )}

      {/* Основные поля */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Имя *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ваше имя"
              required
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Email *
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
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Пароль *
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
                minLength={6}
                disabled={isLoading}
                className="w-full pl-10 pr-10 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Подтверждение *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                minLength={6}
                disabled={isLoading}
                className="w-full pl-10 pr-10 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 disabled:opacity-50"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {formData.password && formData.confirmPassword && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-sm"
          >
            {formData.password === formData.confirmPassword ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-green-500">Пароли совпадают</span>
              </>
            ) : (
              <>
                <X className="w-4 h-4 text-red-500" />
                <span className="text-red-500">Пароли не совпадают</span>
              </>
            )}
          </motion.div>
        )}
      </div>

      <div className="text-xs text-gray-500 space-y-1 pt-2">
        <p>• Пароль должен содержать минимум 6 символов</p>
        <p>• Используйте буквы, цифры и специальные символы</p>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Продолжить
      </Button>

      <div className="text-center pt-4 border-t border-gray-800">
        <p className="text-gray-400">
          Уже есть аккаунт?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-blue-400 hover:text-blue-300 font-medium"
            disabled={isLoading}
          >
            Войти
          </button>
        </p>
      </div>
    </form>
  );

  // Шаг 2: PocketOption ID
  const renderPocketOptionStep = () => (
    <form onSubmit={handleFinalRegistration} className="p-6 space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-bold text-white">Шаг 2: Привязка PocketOption</h3>
          <p className="text-sm text-gray-400 mt-1">Введите ваш PocketOption ID</p>
        </div>
        <button
          type="button"
          onClick={() => setCurrentStep('basic')}
          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
      </div>

      {/* Показ ошибок */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 bg-red-900/30 border border-red-800 rounded-lg flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </motion.div>
      )}
      
      {/* Показ успеха */}
      {success && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 bg-green-900/30 border border-green-800 rounded-lg"
        >
          <p className="text-green-400 text-sm">{success}</p>
        </motion.div>
      )}

      {/* Информация о PocketOption */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            PocketOption ID *
            {isCheckingPocketOption && (
              <span className="inline-block w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></span>
            )}
          </label>
          <button
            type="button"
            onClick={() => setShowPocketOptionInfo(!showPocketOptionInfo)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <Info className="w-3 h-3" />
            {showPocketOptionInfo ? 'Скрыть помощь' : 'Что это?'}
          </button>
        </div>
        
        {showPocketOptionInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-3 mb-2 overflow-hidden"
          >
            <p className="text-sm text-blue-300 font-medium mb-1">
              Что такое PocketOption ID?
            </p>
            <p className="text-xs text-gray-400 mb-2">
              Это ваш уникальный идентификатор в системе Pocket Option.
              Он необходим для синхронизации аккаунтов и получения данных о балансе.
            </p>
            <Button
              type="button"
              onClick={handleOpenPocketOption}
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Зарегистрироваться на Pocket Option
            </Button>
          </motion.div>
        )}
        
        <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            name="pocketOptionId"
            value={formData.pocketOptionId}
            onChange={(e) => {
              handleChange(e);
              if (e.target.value.length < 3) {
                setPocketOptionData(null);
              }
            }}
            onBlur={(e) => checkPocketOptionId(e.target.value)}
            placeholder="RO-123456"
            required
            disabled={isLoading}
            className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50"
          />
          {formData.pocketOptionId.length > 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isCheckingPocketOption ? (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : pocketOptionData?.exists ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : formData.pocketOptionId.length >= 3 ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : null}
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500">
            • Пример ID: RO-123456, RO-789012
          </p>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              type="button"
              onClick={handleOpenPocketOption}
              variant="outline"
              disabled={isLoading}
              className="w-full border-gray-700 hover:border-blue-500 hover:bg-blue-900/20 text-blue-400 hover:text-blue-300 py-2 rounded-lg"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Получить ID на Pocket Option
            </Button>
          </motion.div>
          
          <div className="text-xs text-gray-500 bg-gray-900/30 border border-gray-700 rounded-lg p-2">
            <p className="font-medium text-gray-400 mb-1">Где найти ID:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Зарегистрируйтесь на Pocket Option</li>
              <li>Войдите в аккаунт</li>
              <li>Нажмите на аватар профиля</li>
              <li>ID указан в настройках профиля</li>
            </ol>
          </div>
        </div>
      </div>

      {/* 🔴 Карточка с данными PocketOption */}
      

      <div className="text-xs text-gray-500 space-y-1 pt-2">
        <p className="font-medium text-gray-400">Зачем это нужно?</p>
        <p>• Для синхронизации с вашим аккаунтом Pocket Option</p>
        <p>• Для автоматического получения данных о балансе</p>
        <p>• Для отслеживания депозитов и статуса верификации</p>
      </div>

      <Button
        type="submit"
        disabled={isLoading || !pocketOptionData?.exists}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Завершение регистрации...
          </span>
        ) : (
          "Завершить регистрацию"
        )}
      </Button>

      <div className="text-center text-xs text-gray-500 pt-2">
        <p>Шаг 2 из 2 • PocketOption ID обязателен для использования платформы</p>
      </div>
    </form>
  );

  return (
    <>
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
                <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-gray-800 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10 p-6 border-b border-gray-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-white">Регистрация</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`w-2 h-2 rounded-full ${currentStep === 'basic' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                          <p className="text-sm text-gray-400">
                            {currentStep === 'basic' ? 'Шаг 1: Основные данные' : 'Шаг 2: PocketOption ID'}
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

                  {currentStep === 'basic' ? renderBasicStep() : renderPocketOptionStep()}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};