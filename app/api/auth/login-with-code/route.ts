
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SECRET_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'temp-secret-key';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function POST(request: Request) {
  try {
    const { email: rawEmail, code, token } = await request.json();
    const email = rawEmail?.trim();

    if (!email || !code || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify HMAC Token (Stateless Verification)
    let payload;
    try {
      const json = Buffer.from(token, 'base64').toString('utf-8');
      payload = JSON.parse(json);
    } catch (e) {
      console.error('Token parsing error:', e);
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

    // 2. Generate Supabase Session
    if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
      return NextResponse.json({ 
        error: 'Server misconfiguration: Missing Service Role Key' 
      }, { status: 500 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Generate a Magic Link to get a valid token
    // We use try-catch specifically for the Supabase call
    let linkData;
    try {
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email,
        });
        if (error) throw error;
        linkData = data;
    } catch (err: any) {
        console.error('Supabase generateLink error:', err);
        return NextResponse.json({ error: err.message || 'Failed to generate session' }, { status: 500 });
    }

    const actionLink = linkData.properties?.action_link;
    if (!actionLink) {
      return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 });
    }

    // Extract token from action_link
    // Format: https://.../verify?token=XYZ&type=magiclink&redirect_to=...
    const url = new URL(actionLink);
    const magicLinkToken = url.searchParams.get('token_hash') || url.searchParams.get('token');

    if (!magicLinkToken) {
      return NextResponse.json({ error: 'Failed to extract login token' }, { status: 500 });
    }

    // Return the token to the client so they can exchange it for a session
    return NextResponse.json({ 
      success: true, 
      token: magicLinkToken,
      type: 'magiclink'
    });

  } catch (error: any) {
    console.error('Login error:', error);
    // Ensure error message is safe
    const safeError = error.message ? error.message.replace(/[^\x00-\x7F]/g, "") : 'Login failed';
    return NextResponse.json({ error: safeError }, { status: 500 });
  }
}
