import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Shield, Zap, User, Users } from 'lucide-react'
import type { Faction } from '@/app/actions/faction'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = input
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = `${process.env.NEXT_PUBLIC_API_SERVER || ''}${url}`
    }
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const joinFaction = async (faction: Faction) => {
  const res = await fetchWithTimeout('/api/faction/join-faction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faction }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to join faction')
  return await res.json()
}





interface FactionSelectorProps {
  initialUser?: any
}

export function FactionSelector({ initialUser }: FactionSelectorProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [stats, setStats] = useState({ RED: 0, BLUE: 0, bonus: { RED: 0, BLUE: 0 } })
  const [loading, setLoading] = useState(false)
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/faction/stats', { credentials: 'include' })

      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`)
      }
      const data = await res.json()
      setStats({
        RED: Number(data?.red_faction || data?.RED || 0),
        BLUE: Number(data?.blue_faction || data?.BLUE || 0),
        bonus: data?.bonus || { RED: 0, BLUE: 0 }
      })
    } catch (error) {
      setStats({ RED: 0, BLUE: 0, bonus: { RED: 0, BLUE: 0 } })
    }
  }, [])

  const checkFactionStatus = useCallback(async (currentUser?: any) => {
    const supabase = createClient()
    let user = currentUser

    // 只有当 currentUser 为空时才发起请求
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (user) {
      // 检查 profiles 表
      const { data: profile } = await supabase.from('profiles').select('faction').eq('id', user.id).single()
      if (!profile?.faction) {
        setIsOpen(true)
        loadStats()
      }
    }
  }, [loadStats])

  useEffect(() => {
    // 优先使用传入的 initialUser 避免重复请求
    checkFactionStatus(initialUser)

    // 监听登录事件，如果用户之前未登录现在登录了，再次检查
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          checkFactionStatus(session.user)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [initialUser, checkFactionStatus])

  const handleJoin = async (faction: Faction) => {
    setLoading(true)
    try {
      const result = await joinFaction(faction)
      if (result.success) {
        // 1. 立即关闭弹窗 (Optimistic UI)
        setIsOpen(false)
        
        // 2. 显示成功提示
        toast.success(`欢迎加入 ${faction === 'RED' ? '赤红先锋' : '蔚蓝联盟'} 阵营！`)
        
        // 3. 刷新路由以更新服务端数据 (如个人资料卡片中的阵营图标)
        router.refresh()
      } else {
        toast.error(result.error || '加入阵营失败')
      }
    } catch (e) {
      toast.error('发生了意外错误')
    } finally {
      setLoading(false)
    }
  }

  const recommendedFaction = stats.RED < stats.BLUE ? 'RED' : stats.BLUE < stats.RED ? 'BLUE' : null

  return (
    <Dialog open={isOpen} onOpenChange={() => { /* Prevent closing */ }}>
      <DialogContent className="max-w-[360px] w-[85%] rounded-3xl bg-slate-950 border-slate-800 text-white p-0 overflow-hidden max-h-[85vh] flex flex-col shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-slate-950 pointer-events-none" />
        
        <div className="p-5 relative z-10 overflow-y-auto custom-scrollbar">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
              选择你的阵营
            </DialogTitle>
            <DialogDescription className="text-center text-slate-400 text-xs">
              城市已分裂。你的选择将决定你的盟友与命运。
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            {/* Red Faction */}
            <Card 
              className={cn(
                "group relative border-2 bg-slate-900/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden",
                selectedFaction === 'RED' ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]" : "border-red-900/30 hover:border-red-500/50"
              )}
              onClick={() => setSelectedFaction('RED')}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-4 flex items-center text-left space-x-4">
                <div className="w-16 h-16 shrink-0 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30 group-hover:border-red-500 transition-colors">
                  <Shield className="w-8 h-8 text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                     <div>
                        <h3 className="text-xl font-bold text-red-500 mb-0.5">赤红先锋</h3>
                        <p className="text-red-300/60 text-xs font-mono">力量与荣耀</p>
                     </div>
                     <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full">
                        <Users className="w-3 h-3" />
                        <span>{stats.RED.toLocaleString()}</span>
                     </div>
                  </div>
                  <p className="text-slate-400 text-xs mt-2 line-clamp-2">
                    以力量与团结统御一切。我们用不屈的意志征服领地。
                  </p>
                </div>

                {stats.bonus.RED > 0 && (
                  <div className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-500 text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/30 animate-pulse">
                    +{stats.bonus.RED}% 加成
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Blue Faction */}
            <Card 
              className={cn(
                "group relative border-2 bg-slate-900/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden",
                selectedFaction === 'BLUE' ? "border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]" : "border-blue-900/30 hover:border-blue-500/50"
              )}
              onClick={() => setSelectedFaction('BLUE')}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-4 flex items-center text-left space-x-4">
                <div className="w-16 h-16 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30 group-hover:border-blue-500 transition-colors">
                  <Zap className="w-8 h-8 text-blue-500" />
                </div>
                <div className="flex-1">
                   <div className="flex justify-between items-start">
                     <div>
                        <h3 className="text-xl font-bold text-blue-500 mb-0.5">蔚蓝联盟</h3>
                        <p className="text-blue-300/60 text-xs font-mono">科技与速度</p>
                     </div>
                     <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full">
                        <Users className="w-3 h-3" />
                        <span>{stats.BLUE.toLocaleString()}</span>
                     </div>
                  </div>
                  <p className="text-slate-400 text-xs mt-2 line-clamp-2">
                    以敏捷与尖端科技智取对手。速度是我们的武器。
                  </p>
                </div>

                {stats.bonus.BLUE > 0 && (
                  <div className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-500 text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/30 animate-pulse">
                    +{stats.bonus.BLUE}% 加成
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex justify-center sticky bottom-0 pt-4 bg-gradient-to-t from-slate-950 to-transparent">
            <Button 
              size="lg"
              className={cn(
                "w-full max-w-sm font-bold text-lg transition-all",
                selectedFaction === 'RED' ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20" :
                selectedFaction === 'BLUE' ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20" :
                "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
              disabled={!selectedFaction || loading}
              onClick={() => selectedFaction && handleJoin(selectedFaction)}
            >
              {loading ? (
                <span className="animate-pulse">正在建立神经连接...</span>
              ) : selectedFaction ? (
                `加入 ${selectedFaction === 'RED' ? '赤红先锋' : '蔚蓝联盟'}`
              ) : (
                "请选择阵营"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}