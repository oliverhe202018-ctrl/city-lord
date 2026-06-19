import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { runId, summary } = body;

    if (!runId || !summary) {
      return NextResponse.json({ error: 'runId and summary required' }, { status: 400 });
    }

    // Update run summary
    await prisma.runs.update({
      where: { id: runId },
      data: { ai_summary: summary }
    });

    return NextResponse.json({ success: true, data: { runId, summary } });
  } catch (error: any) {
    console.error('[POST /api/v1/runs/update-summary] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update run summary' },
      { status: 500 }
    );
  }
}

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

    // Get settlement status
    const run = await prisma.runs.findUnique({
      where: { id: runId },
      select: {
        id: true,
        user_id: true,
        status: true,
        new_territories_count: true,
        reinforced_territories_count: true,
        updated_at: true
      }
    });

    if (!run) {
      return NextResponse.json({ success: true, data: null });
    }

    const isSettled = run.status === 'settled';

    return NextResponse.json({
      success: true,
      data: {
        newTerritories: run.new_territories_count || 0,
        reinforcedTerritories: run.reinforced_territories_count || 0,
        isSettled
      }
    });
  } catch (error: any) {
    console.error('[GET /api/v1/runs/settlement-status] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch settlement status' },
      { status: 500 }
    );
  }
}
