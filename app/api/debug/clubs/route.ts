import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('clubs')
        .select('id, name, status')
        .eq('status', 'active')
        .limit(5)
    return NextResponse.json({ data, error })
}
