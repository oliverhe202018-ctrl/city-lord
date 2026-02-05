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
import { AlertCircle, Ban, Unlock } from 'lucide-react'
import { Database } from '@/types/supabase'
import { toast } from 'sonner'

type Room = Database['public']['Tables']['rooms']['Row'] & {
  host_profile?: {
    nickname: string | null
  }
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const supabase = createClient()

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false })

      if (roomsError) throw roomsError

      if (!roomsData || roomsData.length === 0) {
        setRooms([])
        return
      }

      // Fetch host profiles manually
      const hostIds = Array.from(new Set(roomsData.map((room: any) => room.host_id)))
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', hostIds)

      const profileMap = new Map(profilesData?.map(p => [p.id, p]))

      const joinedRooms = roomsData.map((room: any) => ({
        ...room,
        host_profile: profileMap.get(room.host_id)
      }))

      setRooms(joinedRooms)
    } catch (err: any) {
      console.error('Error fetching rooms:', err)
      setError(err.message || '获取房间列表失败')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  const logAction = async (action: string, targetId: string, details: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('admin_logs').insert({
        admin_id: user.id,
        action,
        target_id: targetId,
        details
      } as any)
    } catch (err) {
      console.error('Failed to write log:', err)
    }
  }

  const toggleBan = async (room: Room) => {
    setProcessingId(room.id)
    const newBanStatus = !room.is_banned
    const action = newBanStatus ? 'ban_room' : 'unban_room'
    const details = newBanStatus ? '管理员封禁了房间' : '管理员解封了房间'

    try {
      // 1. Update room status
      const { error } = await supabase
        .from('rooms')
        .update({ is_banned: newBanStatus } as any)
        .eq('id', room.id)

      if (error) throw error

      // 2. Log action
      await logAction(action, room.id, details)

      // 3. Update local state
      setRooms(prev => prev.map(r => 
        r.id === room.id ? { ...r, is_banned: newBanStatus } : r
      ))

      toast.success(newBanStatus ? '房间已封禁' : '房间已解封')
    } catch (err: any) {
      console.error('Error toggling ban status:', err)
      toast.error('操作失败: ' + (err.message || '未知错误'))
    } finally {
      setProcessingId(null)
    }
  }

  if (loading && rooms.length === 0) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4 text-destructive">
        <AlertCircle className="h-12 w-12" />
        <p className="text-lg font-medium">{error}</p>
        <Button onClick={fetchRooms} variant="outline">重试</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">房间管理</h2>
          <p className="text-muted-foreground">管理游戏房间及监控违规内容。</p>
        </div>
        <Button variant="outline" onClick={fetchRooms}>刷新列表</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>房间列表 ({rooms.length})</CardTitle>
          <CardDescription>
            显示所有创建的房间。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground border rounded-md border-dashed">
              暂无房间数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>房间名称</TableHead>
                  <TableHead>房主</TableHead>
                  <TableHead>在线人数</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow 
                    key={room.id} 
                    className={room.is_banned ? 'bg-muted/50 opacity-60' : ''}
                  >
                    <TableCell className="font-medium">
                      {room.name}
                      {room.is_private && <Badge variant="outline" className="ml-2 text-[10px]">私密</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{room.host_profile?.nickname || '未知用户'}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {room.host_id.slice(0, 8)}...
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {room.participants_count} / {room.max_participants}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                      {format(new Date(room.created_at), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      {room.is_banned ? (
                        <Badge variant="destructive">已封禁</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">正常</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={room.is_banned ? "outline" : "destructive"}
                        onClick={() => toggleBan(room)}
                        disabled={processingId === room.id}
                      >
                        {processingId === room.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : room.is_banned ? (
                          <>
                            <Unlock className="mr-2 h-4 w-4" />
                            解封
                          </>
                        ) : (
                          <>
                            <Ban className="mr-2 h-4 w-4" />
                            封禁
                          </>
                        )}
                      </Button>
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
