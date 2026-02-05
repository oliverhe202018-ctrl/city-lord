"use client"

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { AlertCircle } from 'lucide-react'
import { Database } from '@/types/supabase'

type AdminLog = Database['public']['Tables']['admin_logs']['Row'] & {
  admin_profile?: {
    nickname: string | null
    email?: string // email is in auth.users, usually not accessible via simple join unless view created, stick to profile
  }
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch logs and try to join with profiles to get admin nickname
      // Note: Foreign key is to auth.users, but we usually have a profile with same ID.
      // We'll try to fetch profiles manually or via join if relation exists to profiles (it might not be explicit in schema as FK is to users)
      // Since our schema.ts shows FK to 'users', standard join to 'profiles' might fail unless we define it.
      // For now, let's fetch logs first, then fetch profile names in a batch if needed, 
      // OR just rely on the fact that if profile id = user id, we can try to join if Supabase allows.
      
      // Let's stick to simple fetch first to avoid Postgrest errors if relation isn't perfect.
      const { data: logsData, error: logsError } = await supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (logsError) throw logsError

      if (!logsData || logsData.length === 0) {
        setLogs([])
        return
      }

      // Fetch admin profiles manually to get nicknames
      const adminIds = Array.from(new Set(logsData.map(log => log.admin_id)))
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', adminIds)

      const profileMap = new Map(profilesData?.map(p => [p.id, p]))

      const joinedLogs = logsData.map(log => ({
        ...log,
        admin_profile: profileMap.get(log.admin_id)
      }))

      setLogs(joinedLogs)
    } catch (err: any) {
      console.error('Error fetching logs:', err)
      setError(err.message || '获取日志失败')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'approve_club':
        return <Badge className="bg-green-600 hover:bg-green-700">通过审核</Badge>
      case 'reject_club':
        return <Badge variant="destructive">拒绝申请</Badge>
      case 'suspend_club':
        return <Badge variant="destructive">封禁</Badge>
      default:
        return <Badge variant="secondary">{action}</Badge>
    }
  }

  const getRowClass = (action: string) => {
    if (action === 'reject_club' || action === 'suspend_club') return 'bg-red-50/50 dark:bg-red-950/10'
    if (action === 'approve_club') return 'bg-green-50/50 dark:bg-green-950/10'
    return ''
  }

  if (loading && logs.length === 0) {
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
        <Button onClick={fetchLogs} variant="outline">重试</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">系统日志</h2>
          <p className="text-muted-foreground">查看管理员的操作记录。</p>
        </div>
        <Button variant="outline" onClick={fetchLogs}>刷新</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近操作 ({logs.length})</CardTitle>
          <CardDescription>
            显示最近 50 条操作记录。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground border rounded-md border-dashed">
              暂无日志数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>操作人</TableHead>
                  <TableHead>动作</TableHead>
                  <TableHead>目标 ID</TableHead>
                  <TableHead>详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className={getRowClass(log.action)}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {log.admin_profile?.nickname || '未知管理员'}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {log.admin_id.slice(0, 8)}...
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getActionBadge(log.action)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.target_id || '-'}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm" title={log.details || ''}>
                      {log.details || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
