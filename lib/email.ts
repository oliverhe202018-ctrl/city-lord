
import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.126.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || 'citylord@126.com';
const SMTP_PASS = process.env.SMTP_PASS || 'WEwHMh7zJXcsiqSx';

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  // 优化连接设置
  connectionTimeout: 10000, // 10秒连接超时
  greetingTimeout: 5000,    // 5秒握手超时
  socketTimeout: 10000,     // 10秒 Socket 超时
  dnsTimeout: 5000,         // 5秒 DNS 超时
});

export async function sendVerificationCode(to: string, code: string, type: 'register' | 'login' = 'register') {
  const subject = type === 'login' ? '【City Lord】登录验证码' : '【City Lord】注册验证码';
  const title = type === 'login' ? 'City Lord 登录验证' : 'City Lord 注册验证';

  const info = await transporter.sendMail({
    from: `"City Lord Game" <${SMTP_USER}>`,
    to,
    subject,
    text: `您的验证码是：${code}。有效期5分钟，请勿泄露给他人。`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #22c55e;">${title}</h2>
        <p>您好！</p>
        <p>您的验证码是：</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0f172a; margin: 20px 0;">
          ${code}
        </div>
        <p>有效期5分钟，请勿泄露给他人。</p>
        <p style="font-size: 12px; color: #666; margin-top: 30px;">
          如果这不是您的操作，请忽略此邮件。
        </p>
      </div>
    `,
  });

  return info;
}
