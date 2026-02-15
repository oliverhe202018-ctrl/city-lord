'use client'

import { useEffect, useState } from 'react'
import type { ReportStats, ReportPeriod } from '@/app/actions/report'
import { PosterLayout } from './PosterLayout'

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const getRunReport = async (period: ReportPeriod) => {
  const res = await fetchWithTimeout(`/api/report/get-run-report?period=${period}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch report')
  return await res.json()
}
import { Button } from '@/components/ui/button'
import { Loader2, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { useGameStore } from '@/store/useGameStore'

interface ReportButtonProps {
  userId?: string
  period?: ReportPeriod
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
}

export function ReportButton({ userId, period = 'daily', className, variant = 'outline' }: ReportButtonProps) {
  const currentUserId = useGameStore(state => state.userId)
  const [isOpen, setIsOpen] = useState(false)
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [loading, setLoading] = useState(false)

  const targetUserId = userId || currentUserId

  const handleOpen = async () => {
    if (!targetUserId) {
        toast.error('无法获取用户信息')
        return
    }

    setLoading(true)
    try {
      const data = await getRunReport(targetUserId, period)
      if (data) {
        setStats(data)
        setIsOpen(true)
      } else {
        toast.error('生成战报失败')
      }
    } catch (e) {
      console.error(e)
      toast.error('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button 
        variant={variant} 
        size="sm" 
        className={className} 
        onClick={handleOpen}
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
        {period === 'daily' ? '今日战报' : period === 'weekly' ? '周报' : '月报'}
      </Button>

      {isOpen && stats && (
        <PosterLayout stats={stats} onClose={() => setIsOpen(false)} />
      )}
    </>
  )
}
