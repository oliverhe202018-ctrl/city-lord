"use client"

import React, { useState, useEffect } from "react"
import { CheckCircle2, Circle, Clock, MapPin, Trophy, Users, ChevronRight, Sparkles } from "lucide-react"
import { useCity } from "@/contexts/CityContext"
import { getChallengesByCityId } from "@/lib/mock-data"
import type { Challenge } from "@/types/city"
import { toast } from "sonner"
import { sendSystemNotification } from "@/app/actions/notification"

export type TaskStatus = "todo" | "in-progress" | "completed" | "claimed"

export interface Task {
  id: string
  title: string
  description: string
  type: "daily" | "city" | "weekly" | "special"
  icon: React.ReactNode
  target: number
  current: number
  reward: {
    points: number
    experience: number
  }
  status: TaskStatus
  isTimeLimited?: boolean
  timeRemaining?: string
  isMainQuest?: boolean
}

export interface TaskCenterProps {
  onTaskComplete?: (taskId: string) => void
  onTaskStart?: (taskId: string) => void
  defaultTab?: "daily" | "city"
}

// 模拟每日任务
const mockDailyTasks: Task[] = [
  {
    id: "daily-1",
    title: "占领 5 个六边形",
    description: "在今日的跑步过程中占领 5 个新的六边形区域",
    type: "daily",
    icon: <MapPin className="h-4 w-4" />,
    target: 5,
    current: 3,
    reward: { points: 100, experience: 50 },
    status: "in-progress",
  },
  {
    id: "daily-2",
    title: "完成 3 公里跑步",
    description: "跑步总距离达到 3 公里",
    type: "daily",
    icon: <Clock className="h-4 w-4" />,
    target: 3,
    current: 0,
    reward: { points: 150, experience: 75 },
    status: "todo",
  },
  {
    id: "daily-3",
    title: "邀请 1 位好友",
    description: "邀请好友加入游戏",
    type: "daily",
    icon: <Users className="h-4 w-4" />,
    target: 1,
    current: 0,
    reward: { points: 200, experience: 100 },
    status: "todo",
  },
  {
    id: "daily-4",
    title: "完成 1 次防守挑战",
    description: "成功防守你的领土",
    type: "daily",
    icon: <Trophy className="h-4 w-4" />,
    target: 1,
    current: 1,
    reward: { points: 250, experience: 125 },
    status: "completed",
  },
]

export function TaskCenter({
  onTaskComplete,
  onTaskStart,
  defaultTab = "daily",
}: TaskCenterProps) {
  const [activeTab, setActiveTab] = useState<"daily" | "city">(defaultTab)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [claimedTasks, setClaimedTasks] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const { currentCity } = useCity()

  // 从本地存储加载已领取状态
  useEffect(() => {
    const saved = localStorage.getItem('claimedTasks')
    if (saved) {
      setClaimedTasks(new Set(JSON.parse(saved)))
    }
  }, [])

  // 保存已领取状态到本地存储
  const saveClaimedTasks = (tasks: Set<string>) => {
    setClaimedTasks(tasks)
    localStorage.setItem('claimedTasks', JSON.stringify([...tasks]))
  }

  // 获取城市专属任务
  const cityChallenges: Challenge[] = currentCity
    ? getChallengesByCityId(currentCity.id)
    : []

  const cityTasks: Task[] = cityChallenges.map((challenge) => ({
    id: challenge.id,
    title: challenge.name,
    description: challenge.description,
    type: "city" as const,
    icon: challenge.type === "conquest" ? <MapPin className="h-4 w-4" /> :
           challenge.type === "defense" ? <Trophy className="h-4 w-4" /> :
           <Sparkles className="h-4 w-4" />,
    target: challenge.objective.target,
    current: Math.floor(Math.random() * challenge.objective.target * 0.6),
    reward: {
      points: challenge.rewards.points,
      experience: challenge.rewards.experience,
    },
    status: challenge.status === "completed" ? "completed" : "todo",
    isTimeLimited: challenge.isTimeLimited,
    isMainQuest: challenge.isMainQuest,
  }))

  const tasks = activeTab === "daily" ? mockDailyTasks : cityTasks

  const handleTaskClick = (task: Task) => {
    if (task.status === "completed") return
    setSelectedTask(task)
  }

  const handleStartTask = () => {
    if (selectedTask) {
      onTaskStart?.(selectedTask.id)
      setSelectedTask(null)
    }
  }

  const handleCompleteTask = (taskId: string) => {
    setCompletedTasks(new Set([...completedTasks, taskId]))
    onTaskComplete?.(taskId)
  }

  // 领取单个任务奖励
  const handleClaimReward = async (task: Task) => {
    if (claimedTasks.has(task.id)) {
      toast.info('该任务奖励已领取')
      return
    }

    setIsLoading(true)
    try {
      // 调用后端API领取奖励
      const response = await fetch('/api/mission/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId: task.id,
          taskTitle: task.title,
          rewardType: 'xp',
          rewardAmount: task.reward.experience
        })
      })

      const result = await response.json()

      if (result.success) {
        // 更新本地状态
        const newClaimedTasks = new Set([...claimedTasks, task.id])
        saveClaimedTasks(newClaimedTasks)

        // 发送系统通知
        toast.success(`恭喜完成任务 ${task.title}，获得 ${task.reward.points} 积分和 ${task.reward.experience} 经验`)

        // 可以在这里调用通知服务发送到消息中心
        // await sendSystemNotification(userId, `恭喜完成任务 ${task.title}，获得 ${task.reward.points} 积分和 ${task.reward.experience} 经验`, 'mission')
      } else {
        toast.error(result.message || '领取失败')
      }
    } catch (error) {
      console.error('领取奖励失败:', error)
      toast.error('领取失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  // 一键领取所有可领取的奖励
  const handleClaimAll = async () => {
    const currentTasks = activeTab === "daily" ? mockDailyTasks : cityTasks
    const completedTasksList = currentTasks.filter(t => t.status === "completed" && !claimedTasks.has(t.id))

    if (completedTasksList.length === 0) {
      toast.info('没有可领取的奖励')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/mission/claim-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: completedTasksList })
      })

      const result = await response.json()

      if (result.success) {
        // 更新所有已领取状态
        const newClaimedTasks = new Set([...claimedTasks, ...result.claimed])
        saveClaimedTasks(newClaimedTasks)

        toast.success(`成功领取 ${result.claimed.length} 个任务的奖励！`)

        // 发送系统通知
        if (result.claimed.length > 0) {
          // await sendSystemNotification(userId, `恭喜！一键领取了 ${result.claimed.length} 个任务的奖励`, 'mission')
        }
      } else {
        toast.error(result.message || '领取失败')
      }
    } catch (error) {
      console.error('一键领取失败:', error)
      toast.error('一键领取失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "todo":
        return <Circle className="h-5 w-5 text-white/30" />
      case "in-progress":
        return (
          <div className="relative h-5 w-5">
            <svg className="h-5 w-5 transform -rotate-90">
              <circle
                cx="10"
                cy="10"
                r="8"
                fill="none"
                strokeWidth="2"
                className="stroke-white/20"
              />
              <circle
                cx="10"
                cy="10"
                r="8"
                fill="none"
                strokeWidth="2"
                strokeDasharray="50.27"
                strokeDashoffset={20.11}
                className="stroke-[currentColor]"
                style={{
                  color: currentCity?.themeColors.primary || "#3b82f6",
                }}
              />
            </svg>
          </div>
        )
      case "completed":
        return (
          <div className="relative">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            {/* 完成动画效果 */}
            <div className="absolute inset-0 h-5 w-5 animate-ping rounded-full bg-green-500/50" />
          </div>
        )
    }
  }

  const getStatusText = (status: TaskStatus) => {
    switch (status) {
      case "todo":
        return "未开始"
      case "in-progress":
        return "进行中"
      case "completed":
        return "已完成"
    }
  }

  const getProgressColor = (status: TaskStatus) => {
    switch (status) {
      case "todo":
        return "bg-white/10"
      case "in-progress":
        return `bg-gradient-to-r from-[${currentCity?.themeColors.primary}] to-[${currentCity?.themeColors.secondary}]`
      case "completed":
        return "bg-gradient-to-r from-green-500 to-emerald-500"
    }
  }

  const visibleTasks = activeTab === "daily" ? mockDailyTasks : cityTasks

  // 计算可领取的任务数量
  const claimableCount = visibleTasks.filter(t => t.status === "completed" && !claimedTasks.has(t.id)).length

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-xl">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">任务中心</h2>
        <div className="flex items-center gap-2">
          {/* 一键领取按钮 */}
          {claimableCount > 0 && (
            <button
              onClick={handleClaimAll}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              一键领取 ({claimableCount})
            </button>
          )}
          <button
            onClick={() => setActiveTab("daily")}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === "daily"
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5"
            }`}
          >
            每日任务
          </button>
          <button
            onClick={() => setActiveTab("city")}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === "city"
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5"
            }`}
          >
            城市任务
          </button>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => handleTaskClick(task)}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-4 transition-all duration-300 ${
              task.status === "completed" ? "opacity-60" : "hover:scale-[1.02] hover:border-white/20 cursor-pointer"
            } ${task.isMainQuest ? "ring-2 ring-yellow-500/50" : ""}`}
          >
            {/* 主线任务标记 */}
            {task.isMainQuest && (
              <div className="absolute top-2 right-2">
                <Sparkles className="h-4 w-4 text-yellow-400" />
              </div>
            )}

            {/* 限时标记 */}
            {task.isTimeLimited && (
              <div className="absolute top-2 left-2">
                <Clock className="h-3 w-3 text-orange-400" />
              </div>
            )}

            {/* 任务内容 */}
            <div className="flex items-start gap-3">
              {/* 状态图标 */}
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(task.status)}
              </div>

              {/* 任务信息 */}
              <div className="flex-1 min-w-0">
                {/* 标题和图标 */}
                <div className="flex items-center gap-2">
                  <div
                    className="rounded-lg p-1.5"
                    style={{
                      backgroundColor: `${currentCity?.themeColors.primary}30`,
                      color: currentCity?.themeColors.primary,
                    }}
                  >
                    {task.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {task.title}
                    </h3>
                    <p className="text-xs text-white/60 truncate">{task.description}</p>
                  </div>
                </div>

                {/* 进度条 */}
                {task.status !== "completed" && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-white/50">
                      <span>
                        进度: {task.current} / {task.target}
                      </span>
                      <span className="font-medium" style={{ color: currentCity?.themeColors.primary }}>
                        {getStatusText(task.status)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(task.current / task.target) * 100}%`,
                          background: task.status === "in-progress"
                            ? `linear-gradient(90deg, ${currentCity?.themeColors.primary}, ${currentCity?.themeColors.secondary})`
                            : "rgba(255,255,255,0.2)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 完成状态 */}
                {task.status === "completed" && !claimedTasks.has(task.id) && (
                  <button
                    onClick={() => handleClaimReward(task)}
                    disabled={isLoading}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-2 text-xs font-semibold text-white transition-all hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    <span>{isLoading ? '领取中...' : '领取奖励'}</span>
                  </button>
                )}

                {task.status === "completed" && claimedTasks.has(task.id) && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>已领取</span>
                  </div>
                )}

                {/* 奖励 */}
                <div className="mt-2 flex items-center gap-3 text-[10px] text-white/50">
                  <div className="flex items-center gap-1">
                    <Trophy className="h-3 w-3" />
                    <span>{task.reward.points} 积分</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>{task.reward.experience} 经验</span>
                  </div>
                </div>
              </div>

              {/* 箭头 */}
              {task.status !== "completed" && (
                <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/60 transition-colors" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 任务详情弹窗 */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-t-3xl bg-gradient-to-br from-gray-900 to-black border-t border-white/10 p-6 animate-in slide-in-from-bottom-4">
            {/* 头部 */}
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="rounded-xl p-2.5"
                  style={{
                    backgroundColor: `${currentCity?.themeColors.primary}30`,
                    color: currentCity?.themeColors.primary,
                  }}
                >
                  {selectedTask.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedTask.title}</h3>
                  <p className="text-sm text-white/60">{selectedTask.description}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="rounded-xl p-2 text-white/60 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* 任务进度 */}
            <div className="mb-6 rounded-2xl bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-white/80">当前进度</span>
                <span className="font-semibold text-white">
                  {selectedTask.current} / {selectedTask.target}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(selectedTask.current / selectedTask.target) * 100}%`,
                    background: `linear-gradient(90deg, ${currentCity?.themeColors.primary}, ${currentCity?.themeColors.secondary})`,
                  }}
                />
              </div>
            </div>

            {/* 奖励 */}
            <div className="mb-6 rounded-2xl bg-white/5 p-4">
              <h4 className="mb-3 text-sm font-semibold text-white">任务奖励</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-white/5 p-3">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  <div>
                    <p className="text-[10px] text-white/50">积分</p>
                    <p className="text-base font-bold text-white">{selectedTask.reward.points}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/5 p-3">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="text-[10px] text-white/50">经验</p>
                    <p className="text-base font-bold text-white">{selectedTask.reward.experience}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 操作按钮 - 根据任务状态显示不同按钮 */}
            {selectedTask.status === 'completed' && !claimedTasks.has(selectedTask.id) ? (
              <button
                onClick={() => handleClaimReward(selectedTask)}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, #fbbf24, #f59e0b)`,
                }}
              >
                <Trophy className="h-5 w-5" />
                {isLoading ? '领取中...' : '领取奖励'}
              </button>
            ) : selectedTask.status === 'completed' && claimedTasks.has(selectedTask.id) ? (
              <button
                disabled
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold text-white/60 bg-white/10 cursor-not-allowed"
              >
                <CheckCircle2 className="h-5 w-5" />
                已领取
              </button>
            ) : (
              <button
                onClick={handleStartTask}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${currentCity?.themeColors.primary}, ${currentCity?.themeColors.secondary})`,
                }}
              >
                开始任务
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
