
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const SECRET_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'temp-secret-key';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function POST(request: Request) {
  try {
    const { email, password, code, token } = await request.json();

    if (!email || !password || !code || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify Token
    let payload;
    try {
      const json = Buffer.from(token, 'base64').toString('utf-8');
      payload = JSON.parse(json);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
    }

    const { expiresAt, signature } = payload;

    // Check expiration
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: 'Verification code expired' }, { status: 400 });
    }

    // Verify Signature
    const data = `${email}|${code}|${expiresAt}`;
    const expectedSignature = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // 2. Register User in Supabase
    
    // Scenario A: If we have Service Role Key, we can create a confirmed user directly
    if (SERVICE_ROLE_KEY && SUPABASE_URL) {
        const supabaseAdmin = createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: email.split('@')[0],
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
            }
        });

        if (adminError) {
            return NextResponse.json({ error: adminError.message }, { status: 400 });
        }

        // Now sign in to get the session
        const cookieStore = await cookies()
        const supabase = createClient(cookieStore);
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError) {
             // This is weird, but fallback
             return NextResponse.json({ 
                success: true, 
                message: 'Registered but failed to auto-login. Please login manually.',
                user: adminData.user
             });
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Registration successful',
            user: signInData.user,
            session: signInData.session
        });
    }

    // Scenario B: Normal flow (might require email confirmation)
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          email_verified_by_code: true,
          full_name: email.split('@')[0],
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
        }
      }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // If session is null, it means email confirmation is required by Supabase
    if (!authData.session) {
      return NextResponse.json({ 
        success: true, 
        message: 'Registered successfully. Please check your email to activate your account via the link.',
        requiresEmailConfirmation: true
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Registration successful',
      user: authData.user,
      session: authData.session
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 500 });
  }
}
