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
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Edit, Save, Coins, Plus } from 'lucide-react'
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

type MissionConfig = Database['public']['Tables']['mission_configs']['Row']

export default function MissionsPage() {
  const [missions, setMissions] = useState<MissionConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Edit Dialog State
  const [editingMission, setEditingMission] = useState<MissionConfig | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<Partial<MissionConfig>>({})

  // Create Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createData, setCreateData] = useState({
    code: '',
    title: '',
    description: '',
    points_reward: 0,
    frequency: 'daily'
  })

  const supabase = createClient()

  const fetchMissions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('mission_configs')
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

  const handleEditClick = (mission: MissionConfig) => {
    setEditingMission(mission)
    setFormData({
      title: mission.title,
      description: mission.description,
      points_reward: mission.points_reward,
      is_active: mission.is_active,
      frequency: mission.frequency
    })
  }

  const logAction = async (action: string, targetId: string, details: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('admin_logs').insert({
        admin_id: user.id,
        action,
        target_id: targetId,
        details
      })
    } catch (err) {
      console.error('Failed to write log:', err)
    }
  }

  const handleSave = async () => {
    if (!editingMission) return
    setIsSaving(true)

    try {
      // 1. Update mission
      const { error } = await supabase
        .from('mission_configs')
        .update(formData)
        .eq('id', editingMission.id)

      if (error) throw error

      // 2. Calculate changes for log
      const changes: string[] = []
      if (formData.title !== editingMission.title) changes.push(`标题: ${editingMission.title} -> ${formData.title}`)
      if (formData.points_reward !== editingMission.points_reward) changes.push(`积分: ${editingMission.points_reward} -> ${formData.points_reward}`)
      if (formData.is_active !== editingMission.is_active) changes.push(`状态: ${editingMission.is_active ? '启用' : '禁用'} -> ${formData.is_active ? '启用' : '禁用'}`)
      
      const logDetails = changes.length > 0 ? `修改了任务 [${editingMission.code}]: ${changes.join(', ')}` : `修改了任务 [${editingMission.code}] 的参数`

      // 3. Log action
      await logAction('update_mission_config', editingMission.id, logDetails)

      // 4. Update local state
      setMissions(prev => prev.map(m => 
        m.id === editingMission.id ? { ...m, ...formData } : m
      ))

      toast.success('任务配置已更新')
      setEditingMission(null)
    } catch (err: any) {
      console.error('Error updating mission:', err)
      toast.error('保存失败: ' + (err.message || '未知错误'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!createData.code || !createData.title) {
      toast.error('请填写必填项 (代号和标题)')
      return
    }

    setIsSaving(true)
    try {
      const { data, error } = await supabase
        .from('mission_configs')
        .insert({
          code: createData.code,
          title: createData.title,
          description: createData.description,
          points_reward: Number(createData.points_reward),
          frequency: createData.frequency,
          is_active: true
        })
        .select()
        .single()

      if (error) throw error

      await logAction('create_mission', data.id, `创建新任务: ${data.title} (${data.code})`)

      setMissions(prev => [data, ...prev])
      toast.success('任务创建成功')
      setIsCreateOpen(false)
      // Reset form
      setCreateData({
        code: '',
        title: '',
        description: '',
        points_reward: 0,
        frequency: 'daily'
      })
    } catch (err: any) {
      console.error('Error creating mission:', err)
      toast.error('创建失败: ' + (err.message || '未知错误'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (mission: MissionConfig) => {
    const newState = !mission.is_active
    try {
      const { error } = await supabase
        .from('mission_configs')
        .update({ is_active: newState })
        .eq('id', mission.id)

      if (error) throw error

      await logAction('update_mission_config', mission.id, `快速切换状态: ${mission.is_active ? '启用' : '禁用'} -> ${newState ? '启用' : '禁用'}`)

      setMissions(prev => prev.map(m => 
        m.id === mission.id ? { ...m, is_active: newState } : m
      ))
      toast.success(newState ? '任务已启用' : '任务已禁用')
    } catch (err: any) {
      toast.error('操作失败')
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
          <h2 className="text-3xl font-bold tracking-tight">任务配置</h2>
          <p className="text-muted-foreground">管理系统中的任务参数和奖励规则。</p>
        </div>
        <div className="flex items-center gap-2">
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
            注意：修改积分奖励会立即影响新完成的任务，已完成的记录不会改变。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务名称</TableHead>
                <TableHead>代号 (Code)</TableHead>
                <TableHead>频次</TableHead>
                <TableHead>奖励积分</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missions.map((mission) => (
                <TableRow key={mission.id}>
                  <TableCell className="font-medium">{mission.title}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{mission.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{mission.frequency}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center font-bold text-amber-500">
                      <Coins className="mr-1.5 h-4 w-4" />
                      {mission.points_reward}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={mission.is_active} 
                      onCheckedChange={() => handleToggleActive(mission)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(mission)}>
                      <Edit className="mr-2 h-4 w-4" />
                      编辑
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建任务</DialogTitle>
            <DialogDescription>添加一个新的任务配置到系统。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-code" className="text-right">
                任务代号 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-code"
                value={createData.code}
                onChange={(e) => setCreateData({ ...createData, code: e.target.value })}
                className="col-span-3"
                placeholder="unique_code_123"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-title" className="text-right">
                任务标题 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-title"
                value={createData.title}
                onChange={(e) => setCreateData({ ...createData, title: e.target.value })}
                className="col-span-3"
                placeholder="例如：每日晨跑"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-desc" className="text-right">
                任务描述
              </Label>
              <Textarea
                id="create-desc"
                value={createData.description}
                onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                className="col-span-3"
                placeholder="任务详情描述..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-points" className="text-right">
                奖励积分
              </Label>
              <Input
                id="create-points"
                type="number"
                value={createData.points_reward}
                onChange={(e) => setCreateData({ ...createData, points_reward: Number(e.target.value) })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-freq" className="text-right">
                任务频次
              </Label>
              <Select 
                value={createData.frequency} 
                onValueChange={(val) => setCreateData({ ...createData, frequency: val })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择频次" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">一次性 (Once)</SelectItem>
                  <SelectItem value="daily">每日 (Daily)</SelectItem>
                  <SelectItem value="infinite">无限 (Infinite)</SelectItem>
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>编辑任务配置</DialogTitle>
            <DialogDescription>
              修改任务的显示内容和奖励参数。代号 ({editingMission?.code}) 不可修改。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                标题
              </Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="points" className="text-right">
                奖励积分
              </Label>
              <div className="col-span-3 relative">
                <Coins className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="points"
                  type="number"
                  value={formData.points_reward || 0}
                  onChange={(e) => setFormData({ ...formData, points_reward: parseInt(e.target.value) || 0 })}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                描述
              </Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="active" className="text-right">
                启用状态
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.is_active || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <span className="text-sm text-muted-foreground">
                  {formData.is_active ? '启用中' : '已禁用'}
                </span>
              </div>
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
