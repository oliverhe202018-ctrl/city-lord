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

    if (!runId) {
      return NextResponse.json({ error: 'runId required' }, { status: 400 });
    }

    // Update run summary
    await prisma.runs.update({
      where: { id: runId },
      data: { ai_summary: summary || null }
    });

    return NextResponse.json({ success: true, data: { runId } });
  } catch (error: any) {
    console.error('[POST /api/v1/runs/summary] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update run summary' },
      { status: 500 }
    );
  }
}
