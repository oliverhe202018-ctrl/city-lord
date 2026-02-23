import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeRun = await prisma.runs.findFirst({
      where: {
        user_id: user.id,
        status: 'active'
      },
      orderBy: { updated_at: 'desc' }
    });

    if (!activeRun) {
      return NextResponse.json({ active: false });
    }

    // Calculate Duration based on start time
    const startTime = activeRun.created_at ? new Date(activeRun.created_at).getTime() : Date.now();
    const duration = Math.floor((Date.now() - startTime) / 1000);

    return NextResponse.json({
      active: true,
      run: {
        ...activeRun,
        duration: duration // Override DB duration with real-time calc
      }
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
