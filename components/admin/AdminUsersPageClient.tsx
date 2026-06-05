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
import { Search, AlertCircle, Eye } from 'lucide-react'
import { getAdminUsers, toggleUserAntiCheatBypass } from '@/app/actions/admin'
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

interface Profile {
  id: string
  nickname: string | null
  avatar_url: string | null
  created_at: string | null
  bypass_anti_cheat?: boolean
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>用户详情</DialogTitle>
            <DialogDescription>
              查看和管理用户 {selectedUser?.nickname || '未设置昵称'} 的详细信息。
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.avatar_url || undefined} />
                  <AvatarFallback>{(selectedUser.nickname || 'U').substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-lg font-semibold">{selectedUser.nickname || '未设置昵称'}</span>
                  <span className="text-sm font-mono text-muted-foreground">{selectedUser.id}</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">开发者账号防作弊豁免</Label>
                  <p className="text-sm text-muted-foreground">
                    开启后，该账号提交的记录将跳过所有反作弊检测。
                  </p>
                </div>
                <Switch
                  checked={selectedUser.bypass_anti_cheat || false}
                  onCheckedChange={handleToggleBypass}
                  disabled={isTogglingBypass}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

