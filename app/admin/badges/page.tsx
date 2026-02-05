'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { syncBadges, fetchAllBadges, upsertBadge, deleteBadge, Badge } from '@/app/actions/badge'
import { toast } from 'sonner'
import { Loader2, Plus, Edit, Trash2, Upload } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge as UIBadge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from '@/lib/supabase/client'

export default function AdminBadgesPage() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  
  // Data State
  const [badges, setBadges] = useState<Badge[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form State
  const [formData, setFormData] = useState<Partial<Badge>>({
      code: '',
      name: '',
      description: '',
      category: 'endurance',
      level: 'common',
      requirement_type: 'count',
      requirement_value: 1,
      icon_path: ''
  })

  // Load badges
  const loadBadges = async () => {
      setIsLoading(true)
      try {
          const data = await fetchAllBadges()
          setBadges(data)
      } catch (e) {
          toast.error('加载失败')
      } finally {
          setIsLoading(false)
      }
  }

  useEffect(() => {
      loadBadges()
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const res = await syncBadges()
      if (res.success) {
        toast.success(`同步成功！共更新 ${res.count} 个勋章。`)
        setSyncResult(`Success: Synced ${res.count} badges.`)
        loadBadges()
      } else {
        toast.error('同步失败: ' + res.error)
        setSyncResult('Error: ' + res.error)
      }
    } catch (e: any) {
      toast.error('Sync failed: ' + e.message)
      setSyncResult('Exception: ' + e.message)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDelete = async (id: string) => {
      if (!confirm('确定要删除这个勋章吗？')) return
      
      const res = await deleteBadge(id)
      if (res.success) {
          toast.success('删除成功')
          setBadges(prev => prev.filter(b => b.id !== id))
      } else {
          toast.error('删除失败: ' + res.error)
      }
  }

  const openEdit = (badge: Badge) => {
      setEditingBadge(badge)
      setFormData({
          ...badge,
          // Map tier to level if level is missing, or vice versa
          level: badge.level || badge.tier
      })
      setIsDialogOpen(true)
  }

  const openCreate = () => {
      setEditingBadge(null)
      setFormData({
        code: '',
        name: '',
        description: '',
        category: 'endurance',
        level: 'common',
        requirement_type: 'count',
        requirement_value: 1,
        icon_path: ''
      })
      setIsDialogOpen(true)
  }

  const handleSave = async () => {
      setIsSaving(true)
      try {
          const res = await upsertBadge(formData)
          if (res.success) {
              toast.success(editingBadge ? '更新成功' : '创建成功')
              setIsDialogOpen(false)
              loadBadges()
          } else {
              toast.error('保存失败: ' + res.error)
          }
      } catch (e: any) {
          toast.error('保存异常: ' + e.message)
      } finally {
          setIsSaving(false)
      }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `uploads/${fileName}`

      try {
          const { error: uploadError } = await supabase.storage
              .from('badges')
              .upload(filePath, file)

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
              .from('badges')
              .getPublicUrl(filePath)

          setFormData(prev => ({ ...prev, icon_path: publicUrl }))
          toast.success('图片上传成功')
      } catch (error: any) {
          toast.error('上传失败: ' + error.message)
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">勋章管理</h2>
          <p className="text-muted-foreground">管理系统中的成就与勋章配置。</p>
        </div>
        <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增勋章
        </Button>
      </div>

      {/* Main Table */}
      <Card>
          <CardHeader>
              <CardTitle>勋章列表 ({badges.length})</CardTitle>
          </CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="w-[60px]">图标</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>名称</TableHead>
                          <TableHead>等级</TableHead>
                          <TableHead>类别</TableHead>
                          <TableHead>达成条件</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {badges.map(badge => (
                          <TableRow key={badge.id}>
                              <TableCell>
                                  <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center overflow-hidden border">
                                      {badge.icon_path ? (
                                          <img src={badge.icon_path} alt={badge.name} className="w-full h-full object-contain" />
                                      ) : (
                                          <span className="text-xs text-muted-foreground">无</span>
                                      )}
                                  </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{badge.code}</TableCell>
                              <TableCell className="font-medium">{badge.name}</TableCell>
                              <TableCell>
                                  <UIBadge variant="outline">{badge.level || badge.tier}</UIBadge>
                              </TableCell>
                              <TableCell>
                                  <UIBadge variant="secondary">{badge.category}</UIBadge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={badge.description}>
                                  {badge.description}
                                  <div className="text-xs opacity-70">
                                      {badge.requirement_type}: {badge.requirement_value}
                                  </div>
                              </TableCell>
                              <TableCell className="text-right space-x-2">
                                  <Button size="sm" variant="ghost" onClick={() => openEdit(badge)}>
                                      <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(badge.id)}>
                                      <Trash2 className="h-4 w-4" />
                                  </Button>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
          </CardContent>
      </Card>

      {/* Sync Card (Legacy) */}
      <Card>
        <CardHeader>
          <CardTitle>从代码同步</CardTitle>
          <CardDescription>
            将本地代码中的静态定义同步到数据库（适用于开发阶段）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Button 
                onClick={handleSync} 
                disabled={isSyncing}
                variant="outline"
                className="w-fit"
            >
                {isSyncing ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        同步中...
                    </>
                ) : (
                    '执行全量同步'
                )}
            </Button>
            
            {syncResult && (
                <div className="p-4 bg-muted rounded-md text-sm font-mono">
                    {syncResult}
                </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                  <DialogTitle>{editingBadge ? '编辑勋章' : '新增勋章'}</DialogTitle>
                  <DialogDescription>
                      {editingBadge ? '修改现有勋章的属性。' : '创建一个新的成就勋章。'}
                  </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Code (ID)</Label>
                          <Input 
                              value={formData.code} 
                              onChange={(e) => setFormData({...formData, code: e.target.value})}
                              disabled={!!editingBadge}
                              placeholder="unique_code_id"
                          />
                      </div>
                      <div className="space-y-2">
                          <Label>名称</Label>
                          <Input 
                              value={formData.name} 
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                              placeholder="勋章名称"
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>等级 (Level)</Label>
                          <Select 
                              value={formData.level} 
                              onValueChange={(val) => setFormData({...formData, level: val})}
                          >
                              <SelectTrigger>
                                  <SelectValue placeholder="选择等级" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="common">普通 (Common)</SelectItem>
                                  <SelectItem value="rare">稀有 (Rare)</SelectItem>
                                  <SelectItem value="epic">史诗 (Epic)</SelectItem>
                                  <SelectItem value="legendary">传说 (Legendary)</SelectItem>
                                  <SelectItem value="limited">限定 (Limited)</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label>类别 (Category)</Label>
                          <Select 
                              value={formData.category} 
                              onValueChange={(val) => setFormData({...formData, category: val as any})}
                          >
                              <SelectTrigger>
                                  <SelectValue placeholder="选择类别" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="endurance">耐力 (Endurance)</SelectItem>
                                  <SelectItem value="territory">探索 (Territory)</SelectItem>
                                  <SelectItem value="conquest">征服 (Conquest)</SelectItem>
                                  <SelectItem value="event">活动 (Event)</SelectItem>
                                  <SelectItem value="special">特殊 (Special)</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                  </div>

                  <div className="space-y-2">
                      <Label>图标 (Icon)</Label>
                      <div className="flex items-center gap-4">
                          <div className="w-16 h-16 border rounded-md flex items-center justify-center bg-muted overflow-hidden relative">
                              {formData.icon_path ? (
                                  <img src={formData.icon_path} alt="Preview" className="w-full h-full object-contain" />
                              ) : (
                                  <span className="text-xs text-muted-foreground">无</span>
                              )}
                          </div>
                          <div className="flex-1">
                              <Input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={handleFileUpload} 
                                  className="cursor-pointer"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                  支持 PNG, JPG, SVG. 上传后自动填入 URL.
                              </p>
                          </div>
                      </div>
                      <Input 
                          value={formData.icon_path || ''} 
                          onChange={(e) => setFormData({...formData, icon_path: e.target.value})}
                          placeholder="或直接输入图片 URL"
                          className="font-mono text-xs"
                      />
                  </div>

                  <div className="space-y-2">
                      <Label>达成条件文案</Label>
                      <Textarea 
                          value={formData.description} 
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          placeholder="例如：参与五一活动并完成3次打卡"
                      />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>判定类型</Label>
                          <Select 
                              value={formData.requirement_type} 
                              onValueChange={(val) => setFormData({...formData, requirement_type: val})}
                          >
                              <SelectTrigger>
                                  <SelectValue placeholder="选择类型" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="distance">距离 (Distance)</SelectItem>
                                  <SelectItem value="area">面积 (Area)</SelectItem>
                                  <SelectItem value="count">次数/数量 (Count)</SelectItem>
                                  <SelectItem value="manual">人工判定 (Manual)</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label>阈值 (Value)</Label>
                          <Input 
                              type="number" 
                              value={formData.requirement_value} 
                              onChange={(e) => setFormData({...formData, requirement_value: parseFloat(e.target.value)})}
                          />
                      </div>
                  </div>
              </div>

              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>取消</Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      保存
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  )
}
