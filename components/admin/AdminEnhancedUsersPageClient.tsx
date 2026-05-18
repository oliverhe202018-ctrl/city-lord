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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Search,
  AlertCircle,
  UserRound,
  Ban,
  Unlock,
  Coins,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react'
import { getAdminUsers } from '@/app/actions/admin'
import {
  getAdminUserDetail,
  updateUserProfile,
  banUser,
  unbanUser,
  adjustUserResources,
} from '@/app/actions/admin/users'

interface Profile {
  id: string
  nickname: string | null
  avatar_url: string | null
  created_at: string | null
  is_active: boolean
  level: number | null
  coins: number | null
  faction: string | null
}

export default function AdminEnhancedUsersPageClient({
  initialProfiles,
  initialSearchQuery = '',
  initialError = null,
}: {
  initialProfiles: Profile[]
  initialSearchQuery?: string
  initialError?: string | null
}) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearchQuery)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [userDetail, setUserDetail] = useState<any>(null)
  const [userDetailLoading, setUserDetailLoading] = useState(false)
  const hasMountedRef = useRef(false)

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

  const fetchUserDetail = useCallback(async (userId: string) => {
    setUserDetailLoading(true)
    try {
      const res = await getAdminUserDetail(userId)
      if (!res.success) throw new Error(res.error)
      setUserDetail(res.data)
    } catch (err: any) {
      alert(err?.message || '获取用户详情失败')
    } finally {
      setUserDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    fetchProfiles()
  }, [fetchProfiles])

  const handleViewUser = async (user: Profile) => {
    setSelectedUser(user)
    await fetchUserDetail(user.id)
  }

  const handleBanUser = async (userId: string, reason: string, duration: number) => {
    try {
      const res = await banUser(userId, reason, duration)
      if (!res.success) throw new Error(res.error)
      await fetchProfiles()
      if (userDetail?.id === userId) {
        await fetchUserDetail(userId)
      }
    } catch (err: any) {
      alert(err?.message || '封禁用户失败')
    }
  }

  const handleUnbanUser = async (userId: string) => {
    try {
      const res = await unbanUser(userId)
      if (!res.success) throw new Error(res.error)
      await fetchProfiles()
      if (userDetail?.id === userId) {
        await fetchUserDetail(userId)
      }
    } catch (err: any) {
      alert(err?.message || '解封用户失败')
    }
  }

  const handleUpdateProfile = async (userId: string, updates: any) => {
    try {
      const res = await updateUserProfile(userId, updates)
      if (!res.success) throw new Error(res.error)
      await fetchProfiles()
      if (userDetail?.id === userId) {
        await fetchUserDetail(userId)
      }
    } catch (err: any) {
      alert(err?.message || '更新用户信息失败')
    }
  }

  const handleAdjustResources = async (userId: string, adjustments: any) => {
    try {
      const res = await adjustUserResources(userId, adjustments)
      if (!res.success) throw new Error(res.error)
      await fetchProfiles()
      if (userDetail?.id === userId) {
        await fetchUserDetail(userId)
      }
    } catch (err: any) {
      alert(err?.message || '调整资源失败')
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
    <div className="space-y-6 pt-[var(--safe-top,0px)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">用户管理 (增强版)</h2>
          <p className="text-muted-foreground">查看和管理所有注册用户，包括编辑、封禁、资源调整。</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>搜索用户</CardTitle>
          <CardDescription>按昵称或用户ID搜索用户</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              placeholder="搜索用户昵称或ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefix={<Search className="h-4 w-4 text-muted-foreground" />}
            />
            <Button onClick={fetchProfiles}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>用户列表</CardTitle>
              <div className="text-sm text-muted-foreground">
                共 {profiles.length} 个用户
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>头像</TableHead>
                  <TableHead>昵称</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead>金币</TableHead>
                  <TableHead>阵营</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile.avatar_url || ''} />
                        <AvatarFallback>
                          <UserRound className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      {profile.nickname || '匿名'}
                    </TableCell>
                    <TableCell>
                      {profile.level || 1}
                    </TableCell>
                    <TableCell>
                      {profile.coins || 0}
                    </TableCell>
                    <TableCell>
                      {profile.faction ? (
                        <Badge
                          className={
                            profile.faction === 'Red'
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-blue-500/10 text-blue-500'
                          }
                        >
                          {profile.faction === 'Red' ? '红方' : '蓝方'}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {profile.is_active ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500">
                          正常
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500">
                          已封禁
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewUser(profile)}
                      >
                        详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedUser && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={userDetail?.avatar_url || selectedUser.avatar_url || ''} />
                  <AvatarFallback>
                    <UserRound className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle>{userDetail?.nickname || selectedUser.nickname || '匿名'}</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {selectedUser.id}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {userDetailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              ) : userDetail ? (
                <div className="space-y-6">
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">等级</span>
                      <span className="font-medium">{userDetail.level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">金币</span>
                      <span className="font-medium flex items-center gap-1">
                        <Coins className="h-4 w-4 text-yellow-500" />
                        {userDetail.coins}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">体力</span>
                      <span className="font-medium flex items-center gap-1">
                        <Zap className="h-4 w-4 text-green-500" />
                        {userDetail.stamina} / {userDetail.max_stamina}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">领地面积</span>
                      <span className="font-medium">
                        {Math.round((userDetail.total_area || 0) / 10000)}万㎡
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <Tabs defaultValue="profile">
                    <TabsList className="w-full">
                      <TabsTrigger value="profile" className="flex-1">
                        <Settings className="h-4 w-4 mr-1" />
                        编辑信息
                      </TabsTrigger>
                      <TabsTrigger value="resources" className="flex-1">
                        <Coins className="h-4 w-4 mr-1" />
                        资源调整
                      </TabsTrigger>
                      <TabsTrigger value="ban" className="flex-1">
                        <Shield className="h-4 w-4 mr-1" />
                        状态管理
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>昵称</Label>
                        <Input
                          defaultValue={userDetail.nickname || ''}
                          placeholder="输入新昵称"
                          id="edit-nickname"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>阵营</Label>
                        <Select
                          defaultValue={userDetail.faction || ''}
                          onValueChange={(v) => {
                            handleUpdateProfile(selectedUser.id, { faction: v })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择阵营" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Red">红方</SelectItem>
                            <SelectItem value="Blue">蓝方</SelectItem>
                            <SelectItem value="">无阵营</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => {
                          const nicknameInput = document.getElementById('edit-nickname') as HTMLInputElement
                          if (nicknameInput) {
                            handleUpdateProfile(selectedUser.id, {
                              nickname: nicknameInput.value,
                            })
                          }
                        }}
                      >
                        保存更改
                      </Button>
                    </TabsContent>

                    <TabsContent value="resources" className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>金币调整 (+/-)</Label>
                        <Input
                          type="number"
                          placeholder="例如：+100 或 -50"
                          id="adjust-coins"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>体力调整 (+/-)</Label>
                        <Input
                          type="number"
                          placeholder="例如：+20 或 -10"
                          id="adjust-stamina"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>等级设置</Label>
                        <Input
                          type="number"
                          placeholder="设置等级"
                          id="set-level"
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => {
                          const coinsInput = document.getElementById('adjust-coins') as HTMLInputElement
                          const staminaInput = document.getElementById('adjust-stamina') as HTMLInputElement
                          const levelInput = document.getElementById('set-level') as HTMLInputElement
                          
                          const adjustments: any = {}
                          if (coinsInput.value) adjustments.coins = Number(coinsInput.value)
                          if (staminaInput.value) adjustments.stamina = Number(staminaInput.value)
                          if (levelInput.value) adjustments.level = Number(levelInput.value)

                          if (Object.keys(adjustments).length > 0) {
                            handleAdjustResources(selectedUser.id, adjustments)
                          }
                        }}
                      >
                        应用调整
                      </Button>
                    </TabsContent>

                    <TabsContent value="ban" className="space-y-4 pt-4">
                      {userDetail.is_active ? (
                        <>
                          <div className="space-y-2">
                            <Label>封禁原因</Label>
                            <Input
                              placeholder="输入封禁原因"
                              id="ban-reason"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>封禁时长 (小时)</Label>
                            <Input
                              type="number"
                              placeholder="例如：24"
                              defaultValue="24"
                              id="ban-duration"
                            />
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" className="w-full">
                                <Ban className="h-4 w-4 mr-2" />
                                封禁用户
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确定要封禁这个用户吗？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  用户将被禁止访问系统，直到封禁结束
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    const reasonInput = document.getElementById('ban-reason') as HTMLInputElement
                                    const durationInput = document.getElementById('ban-duration') as HTMLInputElement
                                    handleBanUser(
                                      selectedUser.id,
                                      reasonInput.value || '违反规则',
                                      Number(durationInput.value) || 24
                                    )
                                  }}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  确认封禁
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <>
                          <div className="rounded-lg bg-yellow-500/10 p-4">
                            <p className="text-sm text-yellow-600">
                              该用户当前处于封禁状态
                            </p>
                            {userDetail.banned_reason && (
                              <p className="text-xs text-yellow-600 mt-1">
                                原因：{userDetail.banned_reason}
                              </p>
                            )}
                            {userDetail.banned_until && (
                              <p className="text-xs text-yellow-600">
                                解封时间：{new Date(userDetail.banned_until).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button className="w-full">
                                <Unlock className="h-4 w-4 mr-2" />
                                解封用户
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确定要解封这个用户吗？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  用户将恢复正常访问权限
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleUnbanUser(selectedUser.id)}
                                >
                                  确认解封
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
