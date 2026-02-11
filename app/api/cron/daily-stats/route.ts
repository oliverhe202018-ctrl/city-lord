import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'; // Ensure the route is not cached

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Validate authorization
    // Vercel Cron sends "Bearer <CRON_SECRET>"
    // We also allow direct match if user manually sets header without Bearer prefix
    if (
      authHeader !== `Bearer ${cronSecret}` && 
      authHeader !== cronSecret
    ) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Initialize Supabase client with Service Role Key for admin privileges
    // This bypasses RLS and ensures we can execute the RPC function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' }, 
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the RPC function to refresh the materialized view
    const { error } = await supabase.rpc('refresh_faction_stats');

    if (error) {
      console.error('Error refreshing faction stats:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Faction stats refreshed successfully' });
  } catch (error) {
    console.error('Unexpected error in cron job:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
