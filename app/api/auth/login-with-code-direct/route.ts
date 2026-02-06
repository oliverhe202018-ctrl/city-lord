import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const SECRET_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'temp-secret-key';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  
  // Determine the correct origin for redirection
  // Priority: 
  // 1. In Development: Try to use Host header or request origin
  // 2. NEXT_PUBLIC_SITE_URL (e.g., set in Vercel env)
  // 3. VERCEL_URL (automatically set by Vercel, but needs https:// prefix)
  // 4. request.url origin (fallback)
  
  let origin = '';
  
  if (process.env.NODE_ENV === 'development') {
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    if (host) {
        origin = `${protocol}://${host}`;
    } else {
        origin = new URL(request.url).origin;
    }
    console.log('[Login with Code Direct] Development mode detected, using origin:', origin);
  } else {
    origin = process.env.NEXT_PUBLIC_SITE_URL || '';
    if (!origin && process.env.VERCEL_URL) {
        origin = `https://${process.env.VERCEL_URL}`;
    }
    if (!origin) {
        origin = new URL(request.url).origin;
    }
  }
  
  console.log('[Login with Code Direct] Resolved Origin:', origin);

  try {
    // Parse request body - could be JSON or form data
    let email: string | undefined;
    let code: string | undefined;
    let token: string | undefined;

    const contentType = request.headers.get('content-type') || '';
    console.log('[Login with Code Direct] Incoming Content-Type:', contentType);

    if (contentType.includes('application/json')) {
      const text = await request.text();
      try {
        const body = JSON.parse(text);
        email = body.email;
        code = body.code;
        token = body.token;
      } catch (e) {
        console.warn('[Login with Code Direct] Failed to parse JSON, trying URL search params', e);
        const params = new URLSearchParams(text);
        email = params.get('email') || undefined;
        code = params.get('code') || undefined;
        token = params.get('token') || undefined;
      }
    } else {
      // Parse form data
      const formData = await request.formData();
      email = formData.get('email') as string;
      code = formData.get('code') as string;
      token = formData.get('token') as string;
    }

    const cleanEmail = email?.trim().toLowerCase();

    console.log('[Login with Code Direct] Processing request for:', cleanEmail);

    if (!email || !code || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify HMAC Token
    let payload;
    try {
      const json = Buffer.from(token, 'base64').toString('utf-8');
      payload = JSON.parse(json);
    } catch (e) {
      console.error('[Login with Code Direct] Token parsing error:', e);
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

    console.log('[Login with Code Direct] Signature verified successfully');

    // 2. Look up user with Service Role Key
    // NOTE: This route requires the Service Role Key because it needs to list users by email (admin action)
    // to find the user ID, which is not possible with the anon key.
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL) {
      console.error('[Login with Code Direct] NEXT_PUBLIC_SUPABASE_URL not configured');
      return NextResponse.json({ error: 'Server misconfiguration: Missing Supabase URL' }, { status: 500 });
    }

    if (!SERVICE_ROLE_KEY) {
      console.error('[Login with Code Direct] SUPABASE_SERVICE_ROLE_KEY not configured. This is required for verify-code-login.');
      return NextResponse.json({ error: 'Server misconfiguration: Missing Service Role Key' }, { status: 500 });
    }

    const cleanServiceRoleKey = SERVICE_ROLE_KEY.trim().split(/\s+/)[0];
    const supabaseAdmin = createSupabaseClient(SUPABASE_URL, cleanServiceRoleKey);

    console.log('[Login with Code Direct] Looking up user by email...');
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers();

    if (userError) {
      throw new Error(`Failed to lookup user: ${userError.message}`);
    }

    const user = users.find(u => u.email?.toLowerCase() === cleanEmail.toLowerCase());

    if (!user) {
      console.log('[Login with Code Direct] User not found for email:', cleanEmail);
      return NextResponse.json({ error: 'User not found. Please register first.' }, { status: 404 });
    }

    console.log('[Login with Code Direct] User found:', user.id);

    // 3. Generate a Magic Link
    console.log('[Login with Code Direct] Generating magic link...');
    const redirectTo = `${origin}/auth/callback`;
    console.log('[Login with Code Direct] Using redirectTo:', redirectTo);

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: cleanEmail,
      options: {
        redirectTo: redirectTo,
      }
    });

    if (linkError) {
      console.error('[Login with Code Direct] Generate link error:', linkError);
      throw new Error(`Failed to generate session: ${linkError.message}`);
    }

    // Extract the action_link
    const actionLink = linkData.properties?.action_link || (linkData as any).action_link;

    if (!actionLink) {
      throw new Error('Failed to generate session link');
    }
    
    // Check if Supabase respected our redirect_to
    try {
        const generatedUrl = new URL(actionLink);
        const generatedRedirectTo = generatedUrl.searchParams.get('redirect_to');
        if (generatedRedirectTo && generatedRedirectTo !== redirectTo) {
            console.warn('⚠️ [Login with Code Direct] WARNING: Supabase rejected the redirect URL!');
            console.warn(`   Requested: ${redirectTo}`);
            console.warn(`   Returned:  ${generatedRedirectTo}`);
            console.warn('   Please check your Supabase "Redirect URLs" whitelist. Ensure it includes: ' + origin + '/**');
        }
    } catch (e) {
        // Ignore URL parsing errors
    }

    console.log('[Login with Code Direct] Magic link generated successfully');
    console.log('[Login with Code Direct] Action link:', actionLink);

    // 4. Initialize user game data
    try {
      await supabaseAdmin.rpc('init_user_game_data', {
        target_user_id: user.id
      })
      console.log('[Login with Code Direct] User game data initialized successfully')
    } catch (e) {
      console.error('[Login with Code Direct] Init failed:', e)
      // Don't fail on init error
    }

    // 5. Return JSON response instead of redirect
    // This allows the frontend to handle the navigation and error display gracefully
    console.log('[Login with Code Direct] Returning redirect URL...')
    
    return NextResponse.json({ 
        success: true,
        redirectUrl: actionLink 
    });

  } catch (error: any) {
    console.error('[Login with Code Direct] Error:', error);
    const safeError = error.message ? error.message.replace(/[^\x00-\x7F]/g, "") : 'Login failed';
    // Ensure we return a JSON error response
    return NextResponse.json({ error: safeError }, { status: 500 });
  }
}
// fix: switch to resend
