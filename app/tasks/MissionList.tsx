'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MissionDto, claimReward } from '@/app/actions/mission';

interface MissionListProps {
  initialMissions: MissionDto[];
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: '每日',
  weekly: '每周',
  achievement: '成就',
  one_time: '一次性',
};

export default function MissionList({ initialMissions }: MissionListProps) {
  const router = useRouter();
  const [missions, setMissions] = useState<MissionDto[]>(initialMissions);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ALL');

  const handleClaim = async (missionId: string) => {
    setClaimingId(missionId);
    try {
      const result = await claimReward(missionId);
      if (result.success) {
        setMissions((prev) =>
          prev.map((m) =>
            m.id === missionId
              ? { ...m, status: 'completed', claimedAt: new Date() }
              : m
          )
        );
      } else {
        alert(result.error === 'PROGRESS_INSUFFICIENT' ? '进度不足，无法领取奖励' : '领取失败，请重试');
      }
    } catch {
      alert('网络错误，请重试');
    } finally {
      setClaimingId(null);
    }
  };

  const filteredMissions =
    activeTab === 'ALL'
      ? missions
      : missions.filter((m) => m.frequency === activeTab);

  const tabs = [
    { key: 'ALL', label: '全部' },
    { key: 'daily', label: '每日' },
    { key: 'weekly', label: '每周' },
    { key: 'achievement', label: '成就' },
  ];

  return (
    <div className="max-w-md mx-auto p-4 pb-24">
      <h1 className="text-2xl font-bold mb-6 select-none tracking-tight">任务中心</h1>

      <div className="sticky flex space-x-2 bg-zinc-50/80 dark:bg-black/50 backdrop-blur-md p-1 rounded-xl mb-6 z-10 top-0 border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredMissions.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">暂无任务</div>
      ) : (
        <div className="space-y-3">
          {filteredMissions.map((mission) => {
            const isCompleted = mission.status === 'completed';
            const canClaim = mission.status === 'in-progress' && mission.progress >= mission.targetValue;
            const isClaiming = claimingId === mission.id;

            return (
              <div
                key={mission.id}
                className={`rounded-xl border p-4 transition-all ${
                  isCompleted
                    ? 'bg-zinc-100/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 opacity-70'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {FREQUENCY_LABELS[mission.frequency ?? ''] ?? mission.frequency}
                      </span>
                      <h3 className="font-semibold text-zinc-900 dark:text-white truncate">
                        {mission.title}
                      </h3>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                      {mission.description}
                    </p>

                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 mb-1">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isCompleted
                            ? 'bg-green-500'
                            : canClaim
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${mission.percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>
                        {mission.progress} / {mission.targetValue}
                      </span>
                      <span>{mission.percent}%</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="text-xs text-zinc-400 text-right">
                      <div>+{mission.rewardCoins} 勋章</div>
                      <div>+{mission.rewardXp} XP</div>
                    </div>

                    {isCompleted ? (
                      <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                        已完成
                      </span>
                    ) : canClaim ? (
                      <button
                        onClick={() => handleClaim(mission.id)}
                        disabled={isClaiming}
                        className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white font-medium active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isClaiming ? '领取中...' : '领取'}
                      </button>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                        进行中
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
