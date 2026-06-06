"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { format } from 'date-fns'
import { Search, AlertCircle, Eye, ShieldAlert, Activity, Award, CheckCircle2, XCircle } from 'lucide-react'
import { getAdminUsers, toggleUserAntiCheatBypass, toggleUserActiveStatus } from '@/app/actions/admin'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

interface Profile {
  id: string
  nickname: string | null
  avatar_url: string | null
  created_at: string | null
  bypass_anti_cheat?: boolean
  level?: number
  total_area?: number
  xp?: number
  total_distance_km?: number
  coins?: number
  faction?: string | null
  is_active?: boolean
  total_runs_count?: number
  club_id?: string | null
  stamina?: number
  max_stamina?: number
  email?: string
  phone?: string
}

interface AdminUsersPageClientProps {
  initialProfiles: Profile[]
  initialSearchQuery?: string
  initialError?: string | null
}

export default function AdminUsersPageClient({
  initialProfiles,
  initialSearchQuery = '',
  initialError = null,
}: AdminUsersPageClientProps) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearchQuery)
  const hasMountedRef = useRef(false)

  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isTogglingBypass, setIsTogglingBypass] = useState(false)
  const [isTogglingActive, setIsTogglingActive] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await getAdminUsers(debouncedSearch)
      if (!res.success) throw new Error(res.error)
      setProfiles(res.data as Profile[])
    } catch (err: any) {
      setError(err?.message || '获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }

    fetchProfiles()
  }, [fetchProfiles])

  const handleViewDetails = (profile: Profile) => {
    console.log('handleViewDetails clicked', profile)
    setSelectedUser(profile)
    setIsModalOpen(true)
  }

  const handleToggleBypass = async (checked: boolean) => {
    if (!selectedUser) return
    setIsTogglingBypass(true)
    try {
      const res = await toggleUserAntiCheatBypass(selectedUser.id, checked)
      if (res.success) {
        toast.success(`已${checked ? '开启' : '关闭'}防作弊豁免`)
        setSelectedUser((prev) => prev ? { ...prev, bypass_anti_cheat: checked } : null)
        setProfiles((prev) =>
          prev.map((p) => (p.id === selectedUser.id ? { ...p, bypass_anti_cheat: checked } : p))
        )
      } else {
        toast.error('设置失败: ' + res.error)
      }
    } catch (err: any) {
      toast.error('请求失败: ' + err.message)
    } finally {
      setIsTogglingBypass(false)
    }
  }

  const handleToggleActive = async (checked: boolean) => {
    if (!selectedUser) return
    setIsTogglingActive(true)
    try {
      const res = await toggleUserActiveStatus(selectedUser.id, checked)
      if (res.success) {
        toast.success(`该账号已${checked ? '解封 (正常状态)' : '封禁 (禁止登录)'}`)
        setSelectedUser((prev) => prev ? { ...prev, is_active: checked } : null)
        setProfiles((prev) =>
          prev.map((p) => (p.id === selectedUser.id ? { ...p, is_active: checked } : p))
        )
      } else {
        toast.error('操作失败: ' + res.error)
      }
    } catch (err: any) {
      toast.error('请求失败: ' + err.message)
    } finally {
      setIsTogglingActive(false)
    }
  }

  if (loading && profiles.length === 0) {
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
        <Button onClick={fetchProfiles} variant="outline">重试</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">用户管理</h2>
          <p className="text-muted-foreground">查看和管理所有注册用户。</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="搜索昵称..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用户列表 ({profiles.length})</CardTitle>
          <CardDescription>
            {debouncedSearch ? `显示匹配 "${debouncedSearch}" 的用户` : '显示最近注册的用户'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-muted-foreground">
              {debouncedSearch ? '未找到匹配的用户' : '暂无用户数据'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">头像</TableHead>
                  <TableHead>昵称 / ID</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <Avatar>
                        <AvatarImage src={profile.avatar_url || undefined} alt={profile.nickname || 'User'} />
                        <AvatarFallback>{(profile.nickname || 'U').substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{profile.nickname || '未设置昵称'}</span>
                        <span className="font-mono text-xs text-muted-foreground">{profile.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {profile.created_at ? format(new Date(profile.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(profile)}>
                        <Eye className="mr-2 h-4 w-4" />
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>用户详情</DialogTitle>
            <DialogDescription>
              查看和管理用户 {selectedUser?.nickname || '未设置昵称'} 的详细信息。
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-center gap-4 border-b pb-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.avatar_url || undefined} />
                  <AvatarFallback>{(selectedUser.nickname || 'U').substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{selectedUser.nickname || '未设置昵称'}</span>
                    {selectedUser.is_active === false ? (
                      <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />已封禁</Badge>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1 text-green-600 bg-green-100 hover:bg-green-100"><CheckCircle2 className="h-3 w-3" />正常</Badge>
                    )}
                    {selectedUser.faction && (
                      <Badge variant="outline" className={selectedUser.faction === 'Red' ? 'text-red-500 border-red-200 bg-red-50' : 'text-blue-500 border-blue-200 bg-blue-50'}>
                        {selectedUser.faction === 'Red' ? '红方阵营' : '蓝方阵营'}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">{selectedUser.id}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded-lg border">
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground font-medium">绑定邮箱</span>
                  <span className="font-mono text-foreground break-all">{selectedUser.email || '未绑定'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground font-medium">绑定手机</span>
                  <span className="font-mono text-foreground">{selectedUser.phone || '未绑定'}</span>
                </div>
              </div>

              <Tabs defaultValue="stats" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="stats">数据统计</TabsTrigger>
                  <TabsTrigger value="settings">账号设置</TabsTrigger>
                </TabsList>
                
                <TabsContent value="stats" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-3 flex flex-col items-start gap-1">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">等级/经验</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">{selectedUser.level || 1}</span>
                        <span className="text-sm text-muted-foreground">级 ({selectedUser.xp || 0} XP)</span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 flex flex-col items-start gap-1">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">金币</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">{selectedUser.coins || 0}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 flex flex-col items-start gap-1">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">总占领面积</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">{((selectedUser.total_area || 0) / 1000000).toFixed(2)}</span>
                        <span className="text-sm text-muted-foreground">km²</span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 flex flex-col items-start gap-1">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">总运动里程</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">{(selectedUser.total_distance_km || 0).toFixed(2)}</span>
                        <span className="text-sm text-muted-foreground">km</span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 flex flex-col items-start gap-1">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">体力值</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">{selectedUser.stamina || 0}</span>
                        <span className="text-sm text-muted-foreground">/ {selectedUser.max_stamina || 100}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 flex flex-col items-start gap-1">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">总运动次数</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">{selectedUser.total_runs_count || 0}</span>
                        <span className="text-sm text-muted-foreground">次</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="settings" className="mt-4 space-y-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base flex items-center gap-2"><Award className="h-4 w-4" />开发者账号防作弊豁免</Label>
                        <p className="text-sm text-muted-foreground">
                          开启后，该账号提交的记录将跳过所有反作弊检测逻辑。
                        </p>
                      </div>
                      <Switch
                        checked={selectedUser.bypass_anti_cheat || false}
                        onCheckedChange={handleToggleBypass}
                        disabled={isTogglingBypass}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base flex items-center gap-2 text-destructive"><ShieldAlert className="h-4 w-4" />账号可用状态</Label>
                        <p className="text-sm text-muted-foreground">
                          关闭后将禁止该用户登录、拒绝任何 API 请求。
                        </p>
                      </div>
                      <Switch
                        checked={selectedUser.is_active !== false} // Default to true if undefined
                        onCheckedChange={handleToggleActive}
                        disabled={isTogglingActive}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-destructive"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

