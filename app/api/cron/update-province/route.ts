import { NextRequest, NextResponse } from 'next/server';
import { updateProvinceStats } from '@/app/actions/leaderboard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 验证 Vercel Cron 的鉴权 Header
  // 注意：需要在 Vercel 项目设置的环境变量中配置 CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    console.log('Starting scheduled province stats update...');
    const result = await updateProvinceStats();
    
    if (result.success) {
      console.log(`Province stats updated successfully. Count: ${result.count}`);
      return NextResponse.json({ success: true, count: result.count });
    } else {
      console.error('Province stats update failed:', result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Unhandled error in cron job:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
