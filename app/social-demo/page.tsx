"use client"

import React, { useState } from "react"
import { ActivityFeed, FriendsList } from "@/components/citylord/social"
import { TaskCenter, TaskCompletionAnimation } from "@/components/tasks"
import { BottomNav } from "@/components/citylord/bottom-nav"
import { MapHeader } from "@/components/map/MapHeader"
import { useCity } from "@/contexts/CityContext"
import type { Task } from "@/components/tasks"
import { useHydration } from "@/hooks/useHydration"

export default function SocialDemoPage() {
  const [isCityDrawerOpen, setIsCityDrawerOpen] = useState(false)
  const [showTaskCompletion, setShowTaskCompletion] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const { currentCity, isLoading: isCityLoading } = useCity()
  const hydrated = useHydration()

  const mockMessages = [
    {
      id: "1",
      type: "capture" as const,
      user: { name: "CyberStride" },
      content: { zh: "占领了 <b>金融街</b> 的一个新六边形", en: "captured a new hex in <b>Financial Street</b>" },
      timestamp: "5分钟前",
      cityId: "beijing",
    },
    {
      id: "2",
      type: "challenge" as const,
      user: { name: "NightRunner" },
      content: { zh: "向你发起了 <b>5公里竞速</b> 挑战", en: "challenged you to a <b>5km race</b>" },
      timestamp: "1小时前",
      cityId: "shanghai",
    },
    {
      id: "3",
      type: "achievement" as const,
      user: { name: "GridMaster" },
      content: { zh: "解锁了 <b>“城市探险家”</b> 成就", en: "unlocked the <b>'Urban Explorer'</b> achievement" },
      timestamp: "3小时前",
      cityId: "guangzhou",
    },
  ];

  const handleTaskComplete = (taskId: string) => {
    const mockTask: Task = {
      id: taskId,
      title: "占领 5 个六边形",
      description: "在今日的跑步过程中占领 5 个新的六边形区域",
      type: "daily",
      icon: null,
      target: 5,
      current: 5,
      reward: { points: 100, experience: 50 },
      status: "completed",
    }
    setSelectedTask(mockTask)
    setShowTaskCompletion(true)
  }

  const handleChallengeAccept = (challengeId: string) => {
    console.log("接受挑战:", challengeId)
    // 这里可以添加接受挑战的逻辑
  }

  const handleChallengeReject = (challengeId: string) => {
    console.log("拒绝挑战:", challengeId)
    // 这里可以添加拒绝挑战的逻辑
  }

  const handleTaskStart = (taskId: string) => {
    console.log("开始任务:", taskId)
    // 这里可以添加开始任务的逻辑
  }

  // 等待 hydration 和城市加载完成
  if (!hydrated || isCityLoading) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-white/60">加载中...</div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-gray-900 to-black">
      {/* 地图头部 */}
      <MapHeader isCityDrawerOpen={isCityDrawerOpen} setIsCityDrawerOpen={setIsCityDrawerOpen} setShowThemeSwitcher={() => {}} />

      {/* 主内容区 */}
      <div className="relative h-[calc(100vh-7rem)] overflow-hidden">
        {/* 地图背景模拟 */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="text-center text-white/20">
            <p className="text-6xl font-bold">地图区域</p>
            <p className="mt-4 text-sm">（这里显示真实地图）</p>
          </div>
        </div>

        {/* 社交动态流 */}
        <ActivityFeed
          messages={mockMessages}
        />

        {/* 好友挑战列表 */}
        <div className="absolute top-24 right-4 z-[70] w-80">
          <div className="rounded-2xl bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-xl border border-white/10 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">好友挑战</h3>
            <FriendsList />
          </div>
        </div>

        {/* 测试按钮 */}
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[60]">
          <button
            onClick={() => {
              const demoTask: Task = {
                id: "demo-task",
                title: "占领 5 个六边形",
                description: "在今日的跑步过程中占领 5 个新的六边形区域",
                type: "daily",
                icon: null,
                target: 5,
                current: 5,
                reward: { points: 100, experience: 50 },
                status: "completed",
              }
              setSelectedTask(demoTask)
              setShowTaskCompletion(true)
            }}
            className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:opacity-90 transition-opacity"
          >
            测试任务完成动画
          </button>
        </div>
      </div>

      {/* 任务完成动画 */}
      {showTaskCompletion && selectedTask && (
        <TaskCompletionAnimation
          isActive={showTaskCompletion}
          taskTitle={selectedTask.title}
          rewardPoints={selectedTask.reward.points}
          rewardExperience={selectedTask.reward.experience}
          onComplete={() => setShowTaskCompletion(false)}
        />
      )}

      {/* 底部导航 */}
      <BottomNav activeTab="play" onTabChange={() => {}} />
    </div>
  )
}
