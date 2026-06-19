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
    const { territoryId, customName } = body;

    if (!territoryId) {
      return NextResponse.json({ error: 'territoryId required' }, { status: 400 });
    }

    if (typeof customName !== 'string' || customName.length > 50) {
      return NextResponse.json({ error: 'Invalid customName (max 50 chars)' }, { status: 400 });
    }

    // Verify ownership
    const territory = await prisma.territories.findUnique({
      where: { id: territoryId },
      select: { owner_id: true }
    });

    if (!territory) {
      return NextResponse.json({ error: 'Territory not found' }, { status: 404 });
    }

    if (territory.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: not the owner' }, { status: 403 });
    }

    // Update custom name
    await prisma.territories.update({
      where: { id: territoryId },
      data: { custom_name: customName }
    });

    return NextResponse.json({ success: true, data: { territoryId, customName } });
  } catch (error: any) {
    console.error('[POST /api/v1/territory/rename] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to rename territory' },
      { status: 500 }
    );
  }
}
