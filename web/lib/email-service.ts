import nodemailer from 'nodemailer';

// Конфигурация email транспортера
const createTransporter = () => {
  // Для Gmail (рекомендуется для тестирования)
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Используй App Password, не обычный пароль!
      },
    });
  }

  // Для любого SMTP сервера
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// HTML шаблон для письма с кодом восстановления
const generateResetPasswordEmailHTML = (code: string, email: string): string => `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Восстановление пароля - Neura Trading</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .code-container {
            background-color: #f8f9fa;
            border-radius: 10px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
            border: 2px solid #e9ecef;
        }
        .code {
            font-size: 48px;
            font-weight: bold;
            letter-spacing: 10px;
            color: #667eea;
            font-family: 'Courier New', monospace;
            margin: 20px 0;
            padding: 10px;
            background: white;
            border-radius: 8px;
            display: inline-block;
            min-width: 280px;
        }
        .instructions {
            background-color: #fff8e1;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 25px 0;
            border-radius: 5px;
        }
        .instructions h3 {
            color: #d39e00;
            margin-top: 0;
        }
        .footer {
            text-align: center;
            padding: 25px;
            color: #6c757d;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
            background-color: #f8f9fa;
        }
        .warning {
            background-color: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border: 1px solid #f5c6cb;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 8px;
            margin: 20px 0;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s;
        }
        .button:hover {
            transform: translateY(-2px);
        }
        .steps {
            display: flex;
            justify-content: space-between;
            margin: 30px 0;
            flex-wrap: wrap;
        }
        .step {
            flex: 1;
            min-width: 120px;
            text-align: center;
            padding: 15px;
            margin: 10px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .step-number {
            display: inline-block;
            width: 36px;
            height: 36px;
            background: #667eea;
            color: white;
            border-radius: 50%;
            line-height: 36px;
            margin-bottom: 10px;
            font-weight: bold;
        }
        @media (max-width: 600px) {
            .container {
                border-radius: 0;
            }
            .content {
                padding: 20px 15px;
            }
            .code {
                font-size: 36px;
                letter-spacing: 8px;
                min-width: 240px;
            }
            .steps {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Восстановление пароля</h1>
        </div>
        
        <div class="content">
            <h2>Здравствуйте!</h2>
            <p>Мы получили запрос на восстановление пароля для вашего аккаунта в <strong>Neura Trading</strong>.</p>
            
            <div class="code-container">
                <h3 style="margin-top: 0; color: #495057;">Ваш код подтверждения:</h3>
                <div class="code">${code}</div>
                <p style="color: #6c757d; font-size: 14px; margin-top: 10px;">
                    ⏰ Код действителен в течение <strong>15 минут</strong>
                </p>
            </div>
            
            <div class="instructions">
                <h3>📝 Как использовать код:</h3>
                <ol style="margin: 15px 0; padding-left: 20px;">
                    <li>Вернитесь на страницу восстановления пароля</li>
                    <li>Введите код из этого письма в поле подтверждения</li>
                    <li>Придумайте новый надежный пароль и подтвердите его</li>
                    <li>Нажмите "Изменить пароль"</li>
                </ol>
            </div>
            
            <div class="steps">
                <div class="step">
                    <div class="step-number">1</div>
                    <div>Введите код</div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div>Новый пароль</div>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <div>Подтверждение</div>
                </div>
                <div class="step">
                    <div class="step-number">4</div>
                    <div>Готово!</div>
                </div>
            </div>
            
            <div class="warning">
                <strong>⚠️ Важно!</strong>
                <p style="margin: 10px 0 0 0;">
                    Если вы не запрашивали восстановление пароля, пожалуйста, проигнорируйте это письмо.<br>
                    Никогда не передавайте код подтверждения третьим лицам.
                </p>
            </div>
            
            <p style="margin-top: 30px;">
                С уважением,<br>
                <strong>Команда Neura Trading</strong>
            </p>
        </div>
        
        <div class="footer">
            <p>Это письмо было отправлено автоматически. Пожалуйста, не отвечайте на него.</p>
            <p>Если у вас возникли вопросы, свяжитесь с нашей службой поддержки.</p>
            <p style="margin-top: 20px; font-size: 12px; color: #adb5bd;">
                © ${new Date().getFullYear()} Neura Trading. Все права защищены.
            </p>
        </div>
    </div>
</body>
</html>
`;

// Текстовый вариант письма (для почтовых клиентов, которые не поддерживают HTML)
const generateResetPasswordEmailText = (code: string, email: string): string => `
ВОССТАНОВЛЕНИЕ ПАРОЛЯ - NEURA TRADING

Здравствуйте!

Мы получили запрос на восстановление пароля для вашего аккаунта в Neura Trading.

ВАШ КОД ПОДТВЕРЖДЕНИЯ: ${code}

Код действителен в течение 15 минут.

КАК ИСПОЛЬЗОВАТЬ КОД:
1. Вернитесь на страницу восстановления пароля
2. Введите код из этого письма в поле подтверждения
3. Придумайте новый надежный пароль и подтвердите его
4. Нажмите "Изменить пароль"

ВАЖНО!
Если вы не запрашивали восстановление пароля, пожалуйста, проигнорируйте это письмо.
Никогда не передавайте код подтверждения третьим лицам.

С уважением,
Команда Neura Trading

---
Это письмо было отправлено автоматически. Пожалуйста, не отвечайте на него.
© ${new Date().getFullYear()} Neura Trading. Все права защищены.
`;

// Основная функция отправки email с кодом восстановления
export async function sendResetPasswordEmail(
  email: string, 
  code: string
): Promise<{ success: boolean; message: string; error?: string }> {
  
  // Проверяем наличие необходимых переменных окружения
  const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    console.error('❌ Отсутствуют переменные окружения для отправки email:', missingEnvVars);
    return {
      success: false,
      message: 'Конфигурация email не настроена',
      error: `Отсутствуют: ${missingEnvVars.join(', ')}`
    };
  }

  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Neura Trading" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Восстановление пароля - Neura Trading',
      html: generateResetPasswordEmailHTML(code, email),
      text: generateResetPasswordEmailText(code, email),
    };

    console.log(`📤 Отправка email на ${email}...`);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email успешно отправлен! Message ID: ${info.messageId}`);
    console.log(`📧 Получатель: ${email}`);
    console.log(`🔑 Код: ${code}`);
    
    return {
      success: true,
      message: `Email отправлен на ${email}`
    };
    
  } catch (error: any) {
    console.error('❌ Ошибка отправки email:', error.message);
    
    // Детальный лог ошибки для отладки
    if (error.code) {
      console.error('Код ошибки:', error.code);
    }
    if (error.command) {
      console.error('Команда:', error.command);
    }
    
    return {
      success: false,
      message: 'Ошибка при отправке email',
      error: error.message
    };
  }
}

// Функция для проверки конфигурации email
export async function testEmailConfiguration(): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createTransporter();
    
    // Проверяем соединение с SMTP сервером
    await transporter.verify();
    
    console.log('✅ SMTP конфигурация проверена успешно');
    
    return {
      success: true,
      message: 'Конфигурация email корректна'
    };
    
  } catch (error: any) {
    console.error('❌ Ошибка проверки конфигурации email:', error.message);
    
    return {
      success: false,
      message: error.message
    };
  }
}