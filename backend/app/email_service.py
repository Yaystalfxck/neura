import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import get_settings
from typing import Dict, List

settings = get_settings()


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: str = ""
) -> Dict[str, bool]:
    """Отправка email"""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to

        if text:
            msg.attach(MIMEText(text, "plain", "utf-8"))
        
        msg.attach(MIMEText(html, "html", "utf-8"))

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )

        return {"success": True, "message": f"Email отправлен на {to}"}
    
    except Exception as e:
        import traceback
        print(f"❌ Email send error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def generate_reset_password_html(code: str, email: str) -> str:
    """HTML шаблон письма для сброса пароля"""
    return f"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Восстановление пароля - Neura Trading</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .code-container {{
            background-color: #f8f9fa;
            border-radius: 10px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
            border: 2px solid #e9ecef;
        }}
        .code {{
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
        }}
        .warning {{
            background-color: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border: 1px solid #f5c6cb;
        }}
        .footer {{
            text-align: center;
            padding: 25px;
            color: #6c757d;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
            background-color: #f8f9fa;
        }}
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
                <div class="code">{code}</div>
                <p style="color: #6c757d; font-size: 14px; margin-top: 10px;">
                    ⏰ Код действителен в течение <strong>15 минут</strong>
                </p>
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
            <p>© 2024 Neura Trading. Все права защищены.</p>
        </div>
    </div>
</body>
</html>
"""


def generate_reset_password_text(code: str, email: str) -> str:
    """Текстовый вариант письма"""
    return f"""
ВОССТАНОВЛЕНИЕ ПАРОЛЯ - NEURA TRADING

Ваш код подтверждения: {code}

Код действителен в течение 15 минут.

Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.

© 2024 Neura Trading. Все права защищены.
"""
