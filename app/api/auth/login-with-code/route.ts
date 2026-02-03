
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SECRET_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'temp-secret-key';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function POST(request: Request) {
  try {
    const { email: rawEmail, code, token, redirectTo } = await request.json();
    const email = rawEmail?.trim().toLowerCase();

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

    // SANITIZE THE KEY: Remove any whitespace or non-ASCII characters that might have been pasted in
    // This is critical to prevent "ByteString" errors if the env var has comments or hidden chars
    const cleanServiceRoleKey = SERVICE_ROLE_KEY.trim().split(/\s+/)[0];

    // Use raw fetch instead of supabase-js to avoid "ByteString" errors with headers
    // (This error happens if supabase-js sends any header with non-ASCII chars)
    try {
      // Use 'recovery' type instead of 'magiclink' because it is more robust for programmatic logins
      // and less likely to hit PKCE/Hash mismatch issues in verifyOtp
      const adminUrl = `${SUPABASE_URL}/auth/v1/admin/generate_link`;
      const response = await fetch(adminUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cleanServiceRoleKey,
          'Authorization': `Bearer ${cleanServiceRoleKey}`,
          // Explicitly set User-Agent to ASCII to avoid any issues
          'User-Agent': 'city-lord-auth-service'
        },
        body: JSON.stringify({
          type: 'recovery', // CHANGED FROM magiclink TO recovery
          email: email,
          options: {
            redirectTo: redirectTo || undefined
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || errorData.msg || 'Failed to generate session link');
      }

      const linkData = await response.json();
      const actionLink = linkData.properties?.action_link || linkData.action_link; // Check both structures

      if (!actionLink) {
        return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 });
      }

      // Instead of extracting token and verifying manually (which fails due to PKCE/Hash mismatch),
      // we return the full actionLink and let the frontend redirect the user to it.
      // This ensures Supabase handles the session creation and cookie setting correctly.
      
      return NextResponse.json({ 
        success: true, 
        redirectUrl: actionLink
      });

    } catch (err: any) {
      console.error('Supabase raw fetch error:', err);
      return NextResponse.json({ error: err.message || 'Failed to generate session' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Login error:', error);
    // Ensure error message is safe
    const safeError = error.message ? error.message.replace(/[^\x00-\x7F]/g, "") : 'Login failed';
    return NextResponse.json({ error: safeError }, { status: 500 });
  }
}
