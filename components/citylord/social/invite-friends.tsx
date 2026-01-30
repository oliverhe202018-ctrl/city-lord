"use client"

import { useState } from "react"
import {
  QrCode,
  Link2,
  Copy,
  Check,
  Share2,
  MessageCircle,
  Users,
  Gift,
  Sparkles,
  ChevronRight,
} from "lucide-react"

interface InviteFriendsProps {
  inviteCode: string
  inviteLink: string
  invitedCount?: number
  rewards?: {
    perInvite: number
    milestone: { count: number; reward: string }[]
  }
  onShare?: (platform: string) => void
}

export function InviteFriends({
  inviteCode = "CITY2025",
  inviteLink = "https://citylord.app/invite/CITY2025",
  invitedCount = 3,
  rewards = {
    perInvite: 50,
    milestone: [
      { count: 5, reward: "专属头像框" },
      { count: 10, reward: "限定称号" },
      { count: 20, reward: "传奇徽章" },
    ],
  },
  onShare,
}: InviteFriendsProps) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null)
  const [showQR, setShowQR] = useState(false)

  const handleCopy = async (type: "code" | "link") => {
    const text = type === "code" ? inviteCode : inviteLink
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const socialPlatforms = [
    { id: "wechat", name: "微信", icon: MessageCircle, color: "bg-green-500" },
    { id: "weibo", name: "微博", icon: Share2, color: "bg-red-500" },
    { id: "qq", name: "QQ", icon: Users, color: "bg-blue-500" },
  ]

  const nextMilestone = rewards.milestone.find((m) => m.count > invitedCount)

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#22c55e]/10 to-cyan-500/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/60">已邀请好友</p>
            <p className="text-3xl font-bold text-[#22c55e]">{invitedCount}</p>
          </div>
          <div className="rounded-2xl bg-[#22c55e]/20 p-3">
            <Gift className="h-8 w-8 text-[#22c55e]" />
          </div>
        </div>
        {nextMilestone && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">
                再邀请 {nextMilestone.count - invitedCount} 人获得
              </span>
              <span className="font-medium text-[#22c55e]">{nextMilestone.reward}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-cyan-400 transition-all"
                style={{ width: `${(invitedCount / nextMilestone.count) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Invite Code */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
          你的邀请码
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl bg-white/5 p-3 font-mono text-xl font-bold tracking-widest text-[#22c55e]">
            {inviteCode}
          </div>
          <button
            onClick={() => handleCopy("code")}
            className={`rounded-xl p-3 transition-all ${
              copied === "code"
                ? "bg-[#22c55e]/20 text-[#22c55e]"
                : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
            }`}
          >
            {copied === "code" ? (
              <Check className="h-5 w-5" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Invite Link */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
          邀请链接
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 truncate rounded-xl bg-white/5 p-3 text-sm text-white/70">
            {inviteLink}
          </div>
          <button
            onClick={() => handleCopy("link")}
            className={`rounded-xl p-3 transition-all ${
              copied === "link"
                ? "bg-[#22c55e]/20 text-[#22c55e]"
                : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
            }`}
          >
            {copied === "link" ? (
              <Check className="h-5 w-5" />
            ) : (
              <Link2 className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* QR Code */}
      <button
        onClick={() => setShowQR(!showQR)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/40 p-4 text-left transition-all hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/10 p-2.5">
            <QrCode className="h-5 w-5 text-white/60" />
          </div>
          <div>
            <p className="font-medium text-white">二维码邀请</p>
            <p className="text-sm text-white/50">好友扫码即可加入</p>
          </div>
        </div>
        <ChevronRight
          className={`h-5 w-5 text-white/40 transition-transform ${showQR ? "rotate-90" : ""}`}
        />
      </button>

      {showQR && (
        <div className="flex justify-center rounded-2xl border border-white/10 bg-white p-6">
          <div className="h-48 w-48 rounded-xl bg-[#1a1a1a] p-4">
            {/* Placeholder QR pattern */}
            <div className="grid h-full w-full grid-cols-7 gap-1">
              {[...Array(49)].map((_, i) => (
                <div
                  key={i}
                  className={`rounded-sm ${Math.random() > 0.5 ? "bg-white" : "bg-transparent"}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Social Share Buttons */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">
          分享到社交平台
        </p>
        <div className="flex gap-2">
          {socialPlatforms.map((platform) => {
            const Icon = platform.icon
            return (
              <button
                key={platform.id}
                onClick={() => onShare?.(platform.id)}
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl ${platform.color}/20 py-3 transition-all hover:${platform.color}/30 active:scale-95`}
              >
                <div className={`rounded-full ${platform.color}/30 p-2`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs font-medium text-white/70">{platform.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Rewards Info */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-400" />
          <p className="text-sm font-medium text-white">邀请奖励</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
            <span className="text-sm text-white/70">每邀请1位好友</span>
            <span className="font-semibold text-[#22c55e]">+{rewards.perInvite} 金币</span>
          </div>
          {rewards.milestone.map((milestone, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-xl p-3 ${
                invitedCount >= milestone.count
                  ? "bg-[#22c55e]/10 border border-[#22c55e]/30"
                  : "bg-white/5"
              }`}
            >
              <span className="text-sm text-white/70">邀请 {milestone.count} 人</span>
              <div className="flex items-center gap-2">
                <span
                  className={`font-semibold ${
                    invitedCount >= milestone.count ? "text-[#22c55e]" : "text-yellow-400"
                  }`}
                >
                  {milestone.reward}
                </span>
                {invitedCount >= milestone.count && (
                  <Check className="h-4 w-4 text-[#22c55e]" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
