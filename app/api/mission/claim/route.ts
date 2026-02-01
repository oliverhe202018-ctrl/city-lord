import { NextRequest, NextResponse } from 'next/server';
import { claimMissionReward } from '@/app/actions/mission';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { missionId, taskTitle, rewardType, rewardAmount } = body;

    if (!missionId) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数: missionId' },
        { status: 400 }
      );
    }

    const result = await claimMissionReward(missionId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('领取奖励API错误:', error);
    return NextResponse.json(
      { success: false, message: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
