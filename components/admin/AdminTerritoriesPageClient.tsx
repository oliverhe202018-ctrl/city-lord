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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Search,
  AlertCircle,
  RotateCw,
  UserRound,
  Trash2,
  Shield,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  getAdminTerritories,
  resetTerritoryHp,
  transferTerritory,
  deleteTerritory,
  type AdminTerritory,
  type AdminTerritoryFilters,
} from '@/app/actions/admin/territories'
import { getAdminUsers } from '@/app/actions/admin'

export default function AdminTerritoriesPageClient({
  initialTerritories,
  initialTotal,
  initialCities,
}: {
  initialTerritories: AdminTerritory[]
  initialTotal: number
  initialCities: Array<{ id: string; name: string }>
}) {
  const [territories, setTerritories] = useState<AdminTerritory[]>(initialTerritories)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState<AdminTerritoryFilters>({})
  const [cities, setCities] = useState(initialCities)
  const [users, setUsers] = useState<Array<{ id: string; nickname: string | null }>>([])
  const hasMountedRef = useRef(false)

  // 分页和筛选
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchTerritories = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await getAdminTerritories(filters, page, pageSize)
      if (!res.success) throw new Error(res.error)
      setTerritories(res.data || [])
      setTotal(res.total || 0)
    } catch (err: any) {
      setError(err?.message || '获取领地列表失败')
    } finally {
      setLoading(false)
    }
  }, [filters, page, pageSize])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await getAdminUsers('')
      if (res.success) {
        setUsers(res.data || [])
      }
    } catch (err: any) {
      console.error('Failed to fetch users:', err)
    }
  }, [])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      fetchUsers()
      return
    }

    fetchTerritories()
  }, [fetchTerritories, fetchUsers])

  const handleResetHp = async (territoryId: string, resetShield: boolean = true) => {
    try {
      const res = await resetTerritoryHp(territoryId, resetShield)
      if (!res.success) throw new Error(res.error)
      await fetchTerritories()
    } catch (err: any) {
      alert(err?.message || '重置HP失败')
    }
  }

  const handleTransfer = async (territoryId: string, newOwnerId: string) => {
    try {
      const res = await transferTerritory(territoryId, newOwnerId)
      if (!res.success) throw new Error(res.error)
      await fetchTerritories()
    } catch (err: any) {
      alert(err?.message || '转让领地失败')
    }
  }

  const handleDelete = async (territoryId: string) => {
    try {
      const res = await deleteTerritory(territoryId)
      if (!res.success) throw new Error(res.error)
      await fetchTerritories()
    } catch (err: any) {
      alert(err?.message || '删除领地失败')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading && territories.length === 0) {
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
        <Button onClick={fetchTerritories} variant="outline">重试</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-[var(--safe-top,0px)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">领地管理</h2>
          <p className="text-muted-foreground">管理所有领地，包括HP重置、转让等操作。</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
          <CardDescription>按条件筛选和查找领地</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="搜索领地ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefix={<Search className="h-4 w-4 text-muted-foreground" />}
            />
            <Select
              value={filters.cityId || ''}
              onValueChange={(v) => setFilters({ ...filters, cityId: v || undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择城市" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status || ''}
              onValueChange={(v) => setFilters({ ...filters, status: v || undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">活跃</SelectItem>
                <SelectItem value="INACTIVE">非活跃</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="最小HP"
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    minHp: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                placeholder="最大HP"
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    maxHp: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>领地列表</CardTitle>
            <div className="text-sm text-muted-foreground">
              总计 {total} 个领地
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>领地ID</TableHead>
                <TableHead>城市</TableHead>
                <TableHead>所有者</TableHead>
                <TableHead>HP / 护盾</TableHead>
                <TableHead>面积</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {territories.map((territory) => (
                <TableRow key={territory.id}>
                  <TableCell className="font-mono text-xs">
                    {territory.id.slice(0, 12)}...
                  </TableCell>
                  <TableCell>
                    {territory.city?.name || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {territory.owner ? (
                        <>
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={territory.owner.avatar_url || ''} />
                            <AvatarFallback>
                              <UserRound className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <span>{territory.owner.nickname || '匿名'}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">无主领地</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-red-500" />
                      <span>{territory.health}</span>
                      {territory.current_hp !== null && (
                        <>
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span>{territory.current_hp}</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {territory.area_m2 ? `${Math.round(territory.area_m2 / 10000)}万㎡` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        territory.status === 'ACTIVE'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }
                    >
                      {territory.status === 'ACTIVE' ? '活跃' : '非活跃'}
                    </Badge>
                    {territory.neutral_until && new Date(territory.neutral_until) > new Date() && (
                      <Badge variant="outline" className="ml-1 bg-yellow-500/10 text-yellow-500">
                        冷却中
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(territory.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <RotateCw className="h-4 w-4 mr-1" />
                            重置HP
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>重置领地HP</DialogTitle>
                            <DialogDescription>
                              将领地HP重置为最大值，同时可以选择重置护盾
                            </DialogDescription>
                          </DialogHeader>
                          <Tabs defaultValue="both">
                            <TabsList>
                              <TabsTrigger value="both">HP + 护盾</TabsTrigger>
                              <TabsTrigger value="hp">仅HP</TabsTrigger>
                            </TabsList>
                            <TabsContent value="both">
                              <div className="py-4">
                                确定要将领地的HP和护盾都重置为最大值吗？
                              </div>
                            </TabsContent>
                            <TabsContent value="hp">
                              <div className="py-4">
                                确定要将领地的HP重置为最大值吗？（护盾保持不变）
                              </div>
                            </TabsContent>
                          </Tabs>
                          <DialogFooter>
                            <Button
                              onClick={async () => {
                                await handleResetHp(territory.id, true)
                              }}
                            >
                              重置HP + 护盾
                            </Button>
                            <Button
                              variant="outline"
                              onClick={async () => {
                                await handleResetHp(territory.id, false)
                              }}
                            >
                              仅重置HP
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <UserRound className="h-4 w-4 mr-1" />
                            转让
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>转让领地</DialogTitle>
                            <DialogDescription>
                              选择新的所有者，转让后领地HP和护盾将重置
                            </DialogDescription>
                          </DialogHeader>
                          <Select onValueChange={(v) => {
                            if (v) {
                              handleTransfer(territory.id, v)
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="选择新所有者" />
                            </SelectTrigger>
                            <SelectContent>
                              {users
                                .filter((u) => u.id !== territory.owner_id)
                                .map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.nickname || user.id.slice(0, 12)}...
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-1" />
                            删除
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确定要删除这个领地吗？</AlertDialogTitle>
                            <AlertDialogDescription>
                              此操作不可恢复，领地及其所有相关数据将被永久删除
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(territory.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="ghost"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                第 {page} 页 / 共 {totalPages} 页
              </span>
              <Button
                variant="ghost"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
              >
                下一页
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
