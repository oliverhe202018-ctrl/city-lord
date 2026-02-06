import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendResult {
  success: boolean;
  data?: any;
  error?: any;
}

export async function sendVerificationCode(
  to: string, 
  code: string, 
  type: 'register' | 'login' = 'register'
): Promise<SendResult> {
  const subject = type === 'login' ? '【City Lord】登录验证码' : '【City Lord】注册验证码';
  const title = type === 'login' ? 'City Lord 登录验证' : 'City Lord 注册验证';

  try {
    const { data, error } = await resend.emails.send({
      from: '安全中心 <system@mail.city-tour.dev>',
      to: [to],
      subject: subject,
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

    if (error) {
      console.error('Resend API Error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('Email sending exception:', err);
    return { success: false, error: err.message || err };
  }
}
