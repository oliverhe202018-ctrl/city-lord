import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    const { data, error } = await supabaseAdmin
        .from('clubs')
        .select('id, name, status')
        .limit(10)

    return NextResponse.json({
        env_url_prefix: url?.slice(0, 30),
        env_key_exists: !!key,
        env_key_prefix: key?.slice(0, 20),
        data,
        error
    })
}
