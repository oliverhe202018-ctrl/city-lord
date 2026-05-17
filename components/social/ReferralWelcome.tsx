'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Gift, UserPlus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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

const getReferrerProfile = async (referralCode: string) => {
  const res = await fetchWithTimeout(`/api/referral/get-referrer-profile?referralCode=${referralCode}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch referrer profile')
  return await res.json()
}


export function ReferralWelcome() {
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  const [referrer, setReferrer] = useState<{ nickname: string | null, avatar_url: string | null } | null>(null)

  useEffect(() => {
    const refId = searchParams.get('ref')
    if (refId) {
      checkReferrer(refId)
    }
  }, [searchParams])

  const checkReferrer = async (refId: string) => {
    try {
      const profile = await getReferrerProfile(refId)
      if (profile) {
        setReferrer(profile)
        setIsOpen(true)
      }
    } catch (e) {
      console.error("Failed to fetch referrer info")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-purple-500/50 text-white">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center gap-4 text-center">
             <div className="relative">
                <div className="absolute -inset-4 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
                <Gift className="w-16 h-16 text-purple-400 relative z-10" />
             </div>
             <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
               你收到了邀请！
             </span>
          </DialogTitle>
          <DialogDescription className="text-center pt-2 text-slate-300">
            <div className="flex flex-col items-center gap-2 mb-4">
               {referrer && (
                 <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-white/10">
                    <Avatar className="w-6 h-6 border border-white/20">
                      <AvatarImage src={referrer.avatar_url || ''} />
                      <AvatarFallback className="bg-slate-700 text-xs">{referrer.nickname?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-white">{referrer.nickname || '一位朋友'}</span>
                 </div>
               )}
               <span>邀请你加入地盘争夺战。</span>
            </div>
            <div className="bg-gradient-to-br from-purple-900/30 to-slate-900 p-4 rounded-xl border border-purple-500/20">
               <p className="font-bold text-white mb-1">🎁 新玩家福利</p>
               <p className="text-sm">立即注册领取 <span className="text-yellow-400 font-bold">新手礼包</span> & <span className="text-yellow-400 font-bold">500 金币</span>！</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button 
             className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 text-lg shadow-[0_0_20px_rgba(147,51,234,0.3)]"
             onClick={() => setIsOpen(false)}
          >
            领取奖励并开始
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
