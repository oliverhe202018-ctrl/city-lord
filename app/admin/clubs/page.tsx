"use client"

import { useEffect, useState, useCallback } from 'react'
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { format } from 'date-fns'
import { Check, X, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useClubAudit } from '@/hooks/useClubAudit'
import { getPendingClubs, Club } from '@/app/actions/club'

// --- Components ---

interface ClubTableProps {
  clubs: Club[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  processingId: string | null
}

function ClubTable({ clubs, onApprove, onReject, processingId }: ClubTableProps) {
  if (clubs.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground border rounded-md border-dashed">
        暂无数据
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">头像</TableHead>
          <TableHead>申请时间</TableHead>
          <TableHead>俱乐部名称</TableHead>
          <TableHead>省份</TableHead>
          <TableHead>权限</TableHead>
          <TableHead>简介</TableHead>
          <TableHead>创建者 ID</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clubs.map((club) => (
          <TableRow key={club.id}>
             <TableCell>
                <div className="h-10 w-10 rounded-full overflow-hidden bg-muted border border-border">
                  {club.avatar_url ? (
                    <img 
                      src={club.avatar_url} 
                      alt={club.name} 
                      className="h-full w-full object-cover" 
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                      无
                    </div>
                  )}
                </div>
            </TableCell>
             <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
              {format(new Date(club.created_at), 'yyyy-MM-dd')}
            </TableCell>
            <TableCell className="font-medium">
              {club.name}
            </TableCell>
            <TableCell>
              {club.province || <span className="text-muted-foreground text-sm">-</span>}
            </TableCell>
            <TableCell>
              <Badge variant={club.is_public ? "secondary" : "outline"}>
                {club.is_public ? '公开' : '私密'}
              </Badge>
            </TableCell>
            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={club.description || ''}>
              {club.description || '-'}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground max-w-[100px] truncate" title={club.owner_id || ''}>
              {club.owner_id}
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button 
                size="sm" 
                variant="default" 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => onApprove(club.id)}
                disabled={processingId === club.id}
              >
                {processingId === club.id ? <Spinner className="mr-2 h-4 w-4" /> : <Check className="mr-1 h-4 w-4" />}
                通过
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => onReject(club.id)}
                disabled={processingId === club.id}
              >
                <X className="mr-1 h-4 w-4" />
                拒绝
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface RejectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  processing: boolean
}

function RejectDialog({ open, onOpenChange, onConfirm, processing }: RejectDialogProps) {
  const [reason, setReason] = useState('')

  // Reset reason when dialog opens
  useEffect(() => {
    if (open) setReason('')
  }, [open])

  const handleConfirm = () => {
    onConfirm(reason)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>拒绝俱乐部申请</DialogTitle>
          <DialogDescription>
            请输入拒绝原因，该原因将对用户可见。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">拒绝原因 <span className="text-destructive">*</span></Label>
            <Textarea 
              id="reason" 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如：名称包含违规词汇 / 描述不当..." 
              className="h-24"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>取消</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={processing || !reason.trim()}>
            {processing ? <Spinner className="mr-2 h-4 w-4" /> : null}
            确认拒绝
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Main Page ---

export default function ClubAuditPage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { approveClub, rejectClub, processingId } = useClubAudit()

  // Reject Dialog State
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null)

  const fetchClubs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPendingClubs()
      setClubs(data)
    } catch (err: any) {
      console.error('Error fetching clubs:', err)
      setError(err.message || '获取俱乐部列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClubs()
  }, [fetchClubs])

  const handleApprove = (id: string) => {
    approveClub(id, () => {
      setClubs(prev => prev.filter(club => club.id !== id))
    })
  }

  const openRejectDialog = (id: string) => {
    setSelectedClubId(id)
    setRejectDialogOpen(true)
  }

  const handleRejectConfirm = (reason: string) => {
    if (!selectedClubId) return

    rejectClub(selectedClubId, reason, () => {
      setRejectDialogOpen(false)
      setClubs(prev => prev.filter(club => club.id !== selectedClubId))
    })
  }

  if (loading && clubs.length === 0) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4 text-destructive">
        <AlertCircle className="h-12 w-12" />
        <p className="text-lg font-medium">{error}</p>
        <Button onClick={fetchClubs} variant="outline">重试</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">俱乐部审核</h2>
          <p className="text-muted-foreground">审批待处理的俱乐部创建申请。</p>
        </div>
        <Button variant="outline" onClick={fetchClubs}>刷新列表</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>待审核列表 ({clubs.length})</CardTitle>
          <CardDescription>
            {clubs.length > 0 ? '以下俱乐部正在等待审核。' : '目前没有待审核的俱乐部。'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClubTable 
            clubs={clubs} 
            onApprove={handleApprove} 
            onReject={openRejectDialog} 
            processingId={processingId} 
          />
        </CardContent>
      </Card>

      <RejectDialog 
        open={rejectDialogOpen} 
        onOpenChange={setRejectDialogOpen} 
        onConfirm={handleRejectConfirm} 
        processing={processingId === selectedClubId}
      />
    </div>
  )
}
