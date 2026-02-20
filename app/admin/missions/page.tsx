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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Edit, Save, Coins, Plus, Zap, RefreshCw } from 'lucide-react'
import { Database } from '@/types/supabase'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Import default missions to use for seeding
import { DEFAULT_MISSIONS } from '@/lib/game-logic/mission-service'

type Mission = Database['public']['Tables']['missions']['Row']

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit Dialog State
  const [editingMission, setEditingMission] = useState<Mission | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [formData, setFormData] = useState<Partial<Mission>>({})

  // Create Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createData, setCreateData] = useState({
    id: '',
    title: '',
    description: '',
    type: 'DISTANCE',
    target: 0,
    reward_coins: 0,
    reward_experience: 0,
    frequency: 'daily'
  })

  const supabase = createClient()

  const fetchMissions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setMissions(data || [])
    } catch (err: any) {
      console.error('Error fetching missions:', err)
      setError(err.message || '获取任务列表失败')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchMissions()
  }, [fetchMissions])

  const handleEditClick = (mission: Mission) => {
    setEditingMission(mission)
    setFormData({
      title: mission.title,
      description: mission.description || '',
      type: mission.type,
      target: mission.target || 0,
      reward_coins: mission.reward_coins || 0,
      reward_experience: mission.reward_experience || 0,
      frequency: mission.frequency || 'daily'
    })
  }

  const logAction = async (action: string, targetId: string, details: string) => {
    try {
      // In this version, admin is logged in via cookie, not supabase Auth.
      // But we will attempt to get a user if one exists (or log it as 'admin').
      const { data: { user } } = await supabase.auth.getUser()
      const adminId = user?.id || 'system-admin'

      await supabase.from('admin_logs').insert({
        admin_id: adminId,
        action,
        target_id: targetId,
        details
      })
    } catch (err) {
      console.error('Failed to write log:', err)
    }
  }

  const handleSeedDefaults = async () => {
    setIsSeeding(true)
    try {
      // Insert DEFAULT_MISSIONS ignoring conflicts
      const { data, error } = await supabase
        .from('missions')
        .upsert(DEFAULT_MISSIONS as any, { onConflict: 'id' })

      if (error) throw error

      toast.success('默认任务初始化成功！')
      await logAction('seed_default_missions', 'all', '初始化了系统默认游戏任务')
      fetchMissions()
    } catch (err: any) {
      console.error('Seed error:', err)
      toast.error('初始化失败: ' + (err.message || '未知错误'))
    } finally {
      setIsSeeding(false)
    }
  }

  const handleSave = async () => {
    if (!editingMission) return
    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('missions')
        .update(formData)
        .eq('id', editingMission.id)

      if (error) throw error

      await logAction('update_mission', editingMission.id, `修改了任务参数`)

      setMissions(prev => prev.map(m =>
        m.id === editingMission.id ? { ...m, ...formData } : m
      ))

      toast.success('任务已更新')
      setEditingMission(null)
    } catch (err: any) {
      console.error('Error updating mission:', err)
      toast.error('保存失败: ' + (err.message || '未知错误'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!createData.id || !createData.title || !createData.type) {
      toast.error('请填写必填项')
      return
    }

    setIsSaving(true)
    try {
      const { data, error } = await supabase
        .from('missions')
        .insert({
          id: createData.id,
          title: createData.title,
          description: createData.description,
          type: createData.type,
          target: Number(createData.target),
          reward_coins: Number(createData.reward_coins),
          reward_experience: Number(createData.reward_experience),
          frequency: createData.frequency,
        })
        .select()
        .single()

      if (error) throw error

      await logAction('create_mission', data.id, `创建新任务: ${data.title} (${data.id})`)

      setMissions(prev => [data, ...prev])
      toast.success('任务创建成功')
      setIsCreateOpen(false)
      // Reset form
      setCreateData({
        id: '',
        title: '',
        description: '',
        type: 'DISTANCE',
        target: 0,
        reward_coins: 0,
        reward_experience: 0,
        frequency: 'daily'
      })
    } catch (err: any) {
      console.error('Error creating mission:', err)
      toast.error('创建失败: ' + (err.message || '未知错误'))
    } finally {
      setIsSaving(false)
    }
  }

  if (loading && missions.length === 0) {
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
        <Button onClick={fetchMissions} variant="outline">重试</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">任务配置 (游戏引擎)</h2>
          <p className="text-muted-foreground">管理控制前后台同步的实际物理任务与判定阈值。</p>
        </div>
        <div className="flex items-center gap-2">
          {missions.length === 0 && (
            <Button onClick={handleSeedDefaults} variant="secondary" disabled={isSeeding} className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
              {isSeeding ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              初始化默认任务
            </Button>
          )}
          <Button onClick={() => setIsCreateOpen(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="mr-2 h-4 w-4" />
            新建任务
          </Button>
          <Button variant="outline" onClick={fetchMissions}>刷新列表</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>任务列表 ({missions.length})</CardTitle>
          <CardDescription>
            直接关联到数据库 missions 表，游戏引擎将基于此表的 type 和 target 参数进行每日/每周打卡判定。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务名称</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>触发逻辑 (Type)</TableHead>
                <TableHead>完成阈值 (Target)</TableHead>
                <TableHead>频次</TableHead>
                <TableHead>奖励</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    暂无任务数据，请点击右上角「初始化默认任务」注入预设配置。
                  </TableCell>
                </TableRow>
              ) : (
                missions.map((mission) => (
                  <TableRow key={mission.id}>
                    <TableCell className="font-medium">{mission.title}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{mission.id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{mission.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{mission.target}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{mission.frequency}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        {mission.reward_coins ? (
                          <div className="flex items-center text-amber-500 font-bold">
                            <Coins className="mr-1 h-3 w-3" /> {mission.reward_coins}
                          </div>
                        ) : null}
                        {mission.reward_experience ? (
                          <div className="flex items-center text-blue-400 font-bold">
                            <Zap className="mr-1 h-3 w-3" /> {mission.reward_experience}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(mission)}>
                        <Edit className="mr-2 h-4 w-4" />
                        编辑
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建任务</DialogTitle>
            <DialogDescription>新任务需要匹配服务器判定逻辑，请仔细确认 Type 和 Target。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 grid-cols-2">
            <div className="space-y-2">
              <Label>任务 ID (唯一标志) <span className="text-red-500">*</span></Label>
              <Input
                value={createData.id}
                onChange={(e) => setCreateData({ ...createData, id: e.target.value })}
                placeholder="例如: daily_run_2"
              />
            </div>
            <div className="space-y-2">
              <Label>任务标题 <span className="text-red-500">*</span></Label>
              <Input
                value={createData.title}
                onChange={(e) => setCreateData({ ...createData, title: e.target.value })}
                placeholder="例如：每日晨跑"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>任务描述</Label>
              <Textarea
                value={createData.description}
                onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                placeholder="任务详情描述..."
              />
            </div>

            <div className="space-y-2">
              <Label>判定类型 (Type) <span className="text-red-500">*</span></Label>
              <Select
                value={createData.type}
                onValueChange={(val) => setCreateData({ ...createData, type: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择逻辑类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DISTANCE">距离 (meters)</SelectItem>
                  <SelectItem value="RUN_COUNT">跑步次数</SelectItem>
                  <SelectItem value="HEX_COUNT">占领/访问地块数</SelectItem>
                  <SelectItem value="UNIQUE_HEX">探索新地块数</SelectItem>
                  <SelectItem value="SPEED_BURST">配速达标</SelectItem>
                  <SelectItem value="ACTIVE_DAYS">活跃天数</SelectItem>
                  <SelectItem value="NIGHT_RUN">夜跑次数</SelectItem>
                  <SelectItem value="HEX_TOTAL">累计拥有地块数</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>完成阈值 (Target) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={createData.target}
                onChange={(e) => setCreateData({ ...createData, target: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>奖励金币 (Coins)</Label>
              <Input
                type="number"
                value={createData.reward_coins}
                onChange={(e) => setCreateData({ ...createData, reward_coins: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>奖励经验 (XP)</Label>
              <Input
                type="number"
                value={createData.reward_experience}
                onChange={(e) => setCreateData({ ...createData, reward_experience: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>循环频次 / 类型</Label>
              <Select
                value={createData.frequency}
                onValueChange={(val) => setCreateData({ ...createData, frequency: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择频次" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">每日 (Daily)</SelectItem>
                  <SelectItem value="weekly">每周 (Weekly)</SelectItem>
                  <SelectItem value="achievement">成就 (Achievement)</SelectItem>
                  <SelectItem value="one_time">一次性 (One Time)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? <Spinner size="sm" className="mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
              创建任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingMission} onOpenChange={(open) => !open && setEditingMission(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑任务配置</DialogTitle>
            <DialogDescription>
              修改任务的显示内容和参数。ID ({editingMission?.id}) 不可修改。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 grid-cols-2">
            <div className="space-y-2 col-span-2">
              <Label>标题</Label>
              <Input
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>描述</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>判定类型 (Type)</Label>
              <Select
                value={formData.type || ''}
                onValueChange={(val) => setFormData({ ...formData, type: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择逻辑类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DISTANCE">距离 (meters)</SelectItem>
                  <SelectItem value="RUN_COUNT">跑步次数</SelectItem>
                  <SelectItem value="HEX_COUNT">占领/访问地块数</SelectItem>
                  <SelectItem value="UNIQUE_HEX">探索新地块数</SelectItem>
                  <SelectItem value="SPEED_BURST">配速达标</SelectItem>
                  <SelectItem value="ACTIVE_DAYS">活跃天数</SelectItem>
                  <SelectItem value="NIGHT_RUN">夜跑次数</SelectItem>
                  <SelectItem value="HEX_TOTAL">累计拥有地块数</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>完成阈值 (Target)</Label>
              <Input
                type="number"
                value={formData.target || 0}
                onChange={(e) => setFormData({ ...formData, target: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label>奖励金币 (Coins)</Label>
              <div className="relative">
                <Coins className="absolute left-2.5 top-2.5 h-4 w-4 text-amber-500" />
                <Input
                  type="number"
                  value={formData.reward_coins || 0}
                  onChange={(e) => setFormData({ ...formData, reward_coins: parseInt(e.target.value) || 0 })}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>奖励经验 (XP)</Label>
              <div className="relative">
                <Zap className="absolute left-2.5 top-2.5 h-4 w-4 text-blue-400" />
                <Input
                  type="number"
                  value={formData.reward_experience || 0}
                  onChange={(e) => setFormData({ ...formData, reward_experience: parseInt(e.target.value) || 0 })}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>循环频次</Label>
              <Select
                value={formData.frequency || 'daily'}
                onValueChange={(val) => setFormData({ ...formData, frequency: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">每日 (Daily)</SelectItem>
                  <SelectItem value="weekly">每周 (Weekly)</SelectItem>
                  <SelectItem value="achievement">成就 (Achievement)</SelectItem>
                  <SelectItem value="one_time">一次性 (One Time)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMission(null)} disabled={isSaving}>取消</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
