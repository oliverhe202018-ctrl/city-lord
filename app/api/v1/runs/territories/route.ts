import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // [P5 Fix] JWT 验签
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json({ error: 'runId required' }, { status: 400 });
    }

    // Get territories created by this run
    const territories = await prisma.territories.findMany({
      where: { source_run_id: runId },
      select: {
        id: true,
        city_id: true,
        area_m2_exact: true,
        captured_at: true,
        custom_name: true
      }
    });

    return NextResponse.json({ success: true, data: territories });
  } catch (error: any) {
    console.error('[GET /api/v1/runs/territories] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch territories' },
      { status: 500 }
    );
  }
}
