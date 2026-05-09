import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await prisma.$executeRaw`
      UPDATE public.profiles
      SET stamina = LEAST(max_stamina, stamina + 10),
          updated_at = NOW()
      WHERE stamina < max_stamina
        AND stamina IS NOT NULL
        AND max_stamina IS NOT NULL
    `;

    console.log(`[cron/stamina-recovery] Recovered stamina for ${result} players`);

    return NextResponse.json({
      success: true,
      recoveredCount: result,
      recoveryAmount: 10,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/stamina-recovery] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
