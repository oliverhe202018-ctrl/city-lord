import { NextRequest, NextResponse } from 'next/server';
import { claimAllMissionsRewards } from '@/app/actions/mission';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tasks } = body;

    if (!Array.isArray(tasks)) {
      return NextResponse.json(
        { success: false, message: '参数错误：tasks必须是数组' },
        { status: 400 }
      );
    }

    const result = await claimAllMissionsRewards(tasks);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('一键领取API错误:', error);
    return NextResponse.json(
      { success: false, message: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
