
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

    // Send email
    await sendVerificationCode(email, code, type || 'register');

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
