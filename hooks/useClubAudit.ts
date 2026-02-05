"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Database } from '@/types/supabase'
import { approveClub as approveClubAction, rejectClub as rejectClubAction } from '@/app/actions/club'

export type Club = Database['public']['Tables']['clubs']['Row']

export function useClubAudit() {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const supabase = createClient()

  const logAction = async (action: string, targetId: string, details: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('admin_logs').insert({
        admin_id: user.id,
        action,
        target_id: targetId,
        details
      })

      if (error) {
        console.error('Failed to write admin log:', error)
      }
    } catch (err) {
      console.error('Unexpected error writing admin log:', err)
    }
  }

  const approveClub = async (clubId: string, onSuccess?: () => void) => {
    setProcessingId(clubId)
    try {
      // 1. Call Server Action
      const result = await approveClubAction(clubId)

      if (!result.success) throw new Error(result.error)

      // 2. Log action (non-blocking for UI success)
      logAction('approve_club', clubId, '管理员通过了审核')

      toast.success('已通过俱乐部申请')
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error('Error approving club:', err)
      toast.error('操作失败: ' + (err.message || '未知错误'))
    } finally {
      setProcessingId(null)
    }
  }

  const rejectClub = async (clubId: string, reason: string, onSuccess?: () => void) => {
    if (!reason || !reason.trim()) {
      toast.error('必须填写拒绝原因')
      return
    }

    setProcessingId(clubId)
    try {
      // 1. Call Server Action
      const result = await rejectClubAction(clubId, reason)

      if (!result.success) throw new Error(result.error)

      // 2. Log action (non-blocking for UI success)
      logAction('reject_club', clubId, reason)

      toast.success('已拒绝俱乐部申请')
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error('Error rejecting club:', err)
      toast.error('操作失败: ' + (err.message || '未知错误'))
    } finally {
      setProcessingId(null)
    }
  }

  return {
    processingId,
    approveClub,
    rejectClub
  }
}
