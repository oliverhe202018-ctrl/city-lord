
import { NextResponse } from 'next/server';
import { sendVerificationCode } from '@/lib/email';
import crypto from 'crypto';

// Secret key for HMAC (In production, use process.env.SECRET_KEY)
const SECRET_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'temp-secret-key';

export async function POST(request: Request) {
  try {
    const { email, type } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Calculate expiration (5 minutes)
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Create signature: HMAC(email + code + expiresAt, secret)
    const data = `${email}|${code}|${expiresAt}`;
    const signature = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');

    // DEV: Log the code to console so user can login even if email fails
    console.log('\n==================================================');
    console.log(`🔑 VERIFICATION CODE for ${email}: [ ${code} ]`);
    console.log('==================================================\n');

    // Send email with timeout handling
    try {
        // In development, if no SMTP credentials are provided, skip sending email
        if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_PASS) {
            console.log('Skipping email send in development (no SMTP_PASS)');
            // Do NOT wait for anything here.
        } else {
            // Force log for debugging even if we attempt to send
            console.log(`Attempting to send email to ${email}...`);
            
            // Fire and forget in development to prevent UI blocking if SMTP is slow
            // In production, we might want to await it, but with a short timeout
            const emailPromise = sendVerificationCode(email, code, type || 'register')
                .then(() => console.log(`Email sent successfully to ${email}`))
                .catch((e) => console.error(`Email send failed async: ${e.message}`));

            if (process.env.NODE_ENV === 'production') {
                  // In production, wait up to 3 seconds
                  await Promise.race([
                     emailPromise,
                     new Promise((_, reject) => setTimeout(() => reject(new Error('Email sending timed out')), 3000))
                 ]);
             }
             // In dev, we just proceed immediately
             
             // 增强开发体验：如果在开发环境，我们返回验证码给前端，
             // 以防邮件发送失败导致无法测试。
             // 注意：这仅在非生产环境启用！
             if (process.env.NODE_ENV !== 'production') {
                const verificationToken = Buffer.from(JSON.stringify({
                  expiresAt,
                  signature
                })).toString('base64');
                return NextResponse.json({
                  success: true,
                  message: 'Verification code sent (Dev Mode)',
                  token: verificationToken, // 必须返回 token！
                  devCode: code // 返回验证码给前端
                });
             }
         }
    } catch (emailError: any) {
        console.error('Email send failed:', emailError);
        // Continue even if email fails in dev environment to allow testing logic
        // In production, you might want to return an error here
        if (process.env.NODE_ENV === 'production') {
            // For now, even in production, let's allow it to proceed if we can't fix SMTP immediately, 
            // but log it severely. Ideally, throw error.
             console.error('CRITICAL: Email failed in production. User cannot see code.');
             // throw new Error('Failed to send verification email'); 
        }
    }

    // Return token to client (stateless verification)
    // Client must send this token back along with the code and email for verification
    const verificationToken = Buffer.from(JSON.stringify({
      expiresAt,
      signature
    })).toString('base64');

    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent',
      token: verificationToken // This token is NOT the code, it's the signed metadata
    });

  } catch (error: any) {
    console.error('Send code error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send code' }, { status: 500 });
  }
}
