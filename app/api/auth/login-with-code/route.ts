import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SECRET_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'temp-secret-key';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function POST(request: Request) {
  // Determine the correct origin for redirection
  let origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin && process.env.VERCEL_URL) {
      origin = `https://${process.env.VERCEL_URL}`;
  }
  if (!origin) {
      origin = new URL(request.url).origin;
  }
  
  console.log('[Login with Code] Resolved Origin:', origin);

  try {
    const { email: rawEmail, code, token } = await request.json();
    const email = rawEmail?.trim().toLowerCase();

    console.log('[Login with Code] Processing request for:', email);

    if (!email || !code || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify HMAC Token (Stateless Verification)
    let payload;
    try {
      const json = Buffer.from(token, 'base64').toString('utf-8');
      payload = JSON.parse(json);
    } catch (e) {
      console.error('[Login with Code] Token parsing error:', e);
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

    console.log('[Login with Code] Signature verified successfully');

    // 2. Use Service Role Key to generate magic link
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SERVICE_ROLE_KEY) {
      console.error('[Login with Code] Service Role Key not configured');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const cleanServiceRoleKey = SERVICE_ROLE_KEY.trim().split(/\s+/)[0];
    const supabaseAdmin = createSupabaseClient(SUPABASE_URL, cleanServiceRoleKey);

    // Get user by email
    console.log('[Login with Code] Looking up user by email...');
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers();

    if (userError) {
      throw new Error(`Failed to lookup user: ${userError.message}`);
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.log('[Login with Code] User not found for email:', email);
      return NextResponse.json({ error: 'User not found. Please register first.' }, { status: 404 });
    }

    console.log('[Login with Code] User found:', user.id);

    // Generate a magic link using admin API
    const adminUrl = `${SUPABASE_URL}/auth/v1/admin/generate_link`;
    console.log('[Login with Code] Calling admin API:', adminUrl);

    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cleanServiceRoleKey,
        'Authorization': `Bearer ${cleanServiceRoleKey}`,
        'User-Agent': 'city-lord-auth-service'
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: `${origin}/auth/callback`
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Login with Code] Admin API error:', errorData);
      throw new Error(errorData.error_description || errorData.msg || 'Failed to generate session link');
    }

    const linkData = await response.json();
    const actionLink = linkData.properties?.action_link || linkData.action_link;

    if (!actionLink) {
      throw new Error('Failed to generate login link');
    }

    console.log('[Login with Code] Magic link generated successfully');
    console.log('[Login with Code] Action link:', actionLink);

    return NextResponse.json({
      success: true,
      redirectUrl: actionLink
    });

  } catch (error: any) {
    console.error('[Login with Code] Error:', error);
    const safeError = error.message ? error.message.replace(/[^\x00-\x7F]/g, "") : 'Login failed';
    return NextResponse.json({ safeError }, { status: 500 });
  }
}
