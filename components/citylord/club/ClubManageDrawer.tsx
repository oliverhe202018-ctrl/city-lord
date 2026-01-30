'use client'

import { useState, useEffect } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { 
  updateClubInfo, 
  getClubJoinRequests, 
  processJoinRequest, 
  getClubMembers, 
  kickMember, 
  disbandClub 
} from '@/app/actions/club'
import { useGameStore } from '@/store/useGameStore'
import { 
  Settings, 
  Users, 
  UserPlus, 
  Trash2, 
  ArrowLeft, 
  Loader2, 
  Save, 
  ShieldAlert,
  Check,
  X,
  LogOut
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AvatarUploader } from '@/components/ui/AvatarUploader'

type View = 'menu' | 'edit' | 'requests' | 'members' | 'disband'

interface JoinRequest {
  requestId: string
  user: {
    id: string
    nickname: string
    avatar_url: string | null
    level: number
  }
  appliedAt: string
}

interface Member {
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
  user: {
    id: string
    nickname: string
    avatar_url: string | null
    level: number
  }
}

interface ClubManageDrawerProps {
  isOpen: boolean
  onClose: () => void
  club?: {
    id: string
    name: string
    description?: string | null
    avatar_url?: string | null
    owner_id?: string | null
  }
}

export function ClubManageDrawer({ isOpen, onClose, club }: ClubManageDrawerProps) {
  const { myClub, setMyClub, updateMyClubInfo } = useGameStore()
  const { toast } = useToast()
  
  const targetClub = club || (myClub ? { ...myClub, description: '', avatar_url: '' } : null)

  const [view, setView] = useState<View>('menu')
  const [isLoading, setIsLoading] = useState(false)
  
  // Data State
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [members, setMembers] = useState<Member[]>([])
  
  // Edit Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatarUrl: ''
  })
  
  // Disband State
  const [confirmText, setConfirmText] = useState('')

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (isOpen) {
      setView('menu')
      if (targetClub) {
        setFormData({
          name: targetClub.name || '',
          description: targetClub.description || '', 
          avatarUrl: targetClub.avatar_url || ''    
        })
      }
    }
  }, [isOpen, targetClub])

  // Fetch data when switching views
  useEffect(() => {
    if (!targetClub) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        if (view === 'requests') {
          const res = await getClubJoinRequests(targetClub.id)
          if (res.success) setRequests(res.data)
          else toast({ title: '加载失败', description: res.error, variant: 'destructive' })
        } else if (view === 'members') {
          const res = await getClubMembers(targetClub.id)
          if (res.success) setMembers(res.data)
          else toast({ title: '加载失败', description: res.error, variant: 'destructive' })
        }
      } catch (error) {
        toast({ title: '发生错误', description: '无法加载数据', variant: 'destructive' })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [view, targetClub, toast])

  const handleUpdateInfo = async () => {
    if (!targetClub) return
    setIsLoading(true)
    try {
      const res = await updateClubInfo(targetClub.id, formData)
      if (res.success) {
        toast({ title: '更新成功', description: '俱乐部信息已保存' })
        // Update local store if it's my club
        if (myClub && myClub.id === targetClub.id) {
          updateMyClubInfo({
            name: formData.name,
            description: formData.description,
            avatar_url: formData.avatarUrl
          })
        }
        setView('menu')
      } else {
        toast({ title: '更新失败', description: res.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: '错误', description: '请求失败', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleProcessRequest = async (requestId: string, action: 'approve' | 'reject') => {
    if (!targetClub) return
    // Optimistic update
    setRequests(prev => prev.filter(r => r.requestId !== requestId))
    
    try {
      const res = await processJoinRequest(targetClub.id, requestId, action)
      if (res.success) {
        toast({ title: action === 'approve' ? '已批准' : '已拒绝' })
      } else {
        // Revert on failure (simplified, usually would re-fetch)
        toast({ title: '操作失败', description: res.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: '错误', description: '操作异常', variant: 'destructive' })
    }
  }

  const handleKickMember = async (memberId: string) => {
    if (!targetClub || !confirm('确定要移除该成员吗？')) return
    
    try {
      const res = await kickMember(targetClub.id, memberId)
      if (res.success) {
        setMembers(prev => prev.filter(m => m.userId !== memberId))
        toast({ title: '已移除成员' })
      } else {
        toast({ title: '移除失败', description: res.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: '错误', description: '操作异常', variant: 'destructive' })
    }
  }

  const handleDisband = async () => {
    if (!targetClub || confirmText !== 'CONFIRM') return
    setIsLoading(true)
    try {
      const res = await disbandClub(targetClub.id)
      if (res.success) {
        toast({ title: '俱乐部已解散' })
        if (myClub && myClub.id === targetClub.id) {
           setMyClub(null)
        }
        onClose()
      } else {
        toast({ title: '解散失败', description: res.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: '错误', description: '操作异常', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  if (!targetClub) return null

  // --- Sub-Views ---

  const renderMenu = () => (
    <div className="grid grid-cols-2 gap-4 p-4">
      <Button 
        variant="outline" 
        className="h-32 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary"
        onClick={() => setView('edit')}
      >
        <Settings className="h-8 w-8 text-primary" />
        <span className="font-semibold">编辑信息</span>
      </Button>
      
      <Button 
        variant="outline" 
        className="h-32 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary"
        onClick={() => setView('requests')}
      >
        <div className="relative">
          <UserPlus className="h-8 w-8 text-blue-500" />
          {/* Badge could go here if we had count */}
        </div>
        <span className="font-semibold">成员审核</span>
      </Button>

      <Button 
        variant="outline" 
        className="h-32 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary"
        onClick={() => setView('members')}
      >
        <Users className="h-8 w-8 text-green-500" />
        <span className="font-semibold">成员管理</span>
      </Button>

      <Button 
        variant="outline" 
        className="h-32 flex flex-col gap-2 hover:bg-destructive/5 hover:border-destructive group"
        onClick={() => setView('disband')}
      >
        <ShieldAlert className="h-8 w-8 text-destructive group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-destructive">解散俱乐部</span>
      </Button>
    </div>
  )

  const renderEdit = () => (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">俱乐部名称</label>
        <Input 
          value={formData.name} 
          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="输入名称"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">简介</label>
        <Textarea 
          value={formData.description} 
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="介绍一下你的俱乐部..."
          rows={4}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">俱乐部头像</label>
        <div className="flex items-center gap-4">
          <AvatarUploader
            currentAvatarUrl={formData.avatarUrl}
            onUploadComplete={(url) => setFormData(prev => ({ ...prev, avatarUrl: url }))}
            size={80}
          />
          <div className="text-xs text-muted-foreground flex-1">
            点击头像上传新图片。<br/>
            支持 JPG, PNG 格式，最大 2MB。
          </div>
        </div>
      </div>
      <Button className="w-full mt-4" onClick={handleUpdateInfo} disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        保存更改
      </Button>
    </div>
  )

  const renderRequests = () => (
    <ScrollArea className="h-[50vh] px-4">
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">暂无申请</div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.requestId} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={req.user?.avatar_url || ''} />
                  <AvatarFallback>{req.user?.nickname?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{req.user?.nickname || '未知用户'}</div>
                  <div className="text-xs text-muted-foreground">Lv.{req.user?.level || 1} • {new Date(req.appliedAt).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleProcessRequest(req.requestId, 'reject')}>
                  <X className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="default" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={() => handleProcessRequest(req.requestId, 'approve')}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  )

  const renderMembers = () => (
    <ScrollArea className="h-[50vh] px-4">
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.userId} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={member.user?.avatar_url || ''} />
                  <AvatarFallback>{member.user?.nickname?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {member.user?.nickname || '未知用户'}
                    {member.role === 'owner' && <Badge variant="secondary" className="text-xs">会长</Badge>}
                    {member.role === 'admin' && <Badge variant="outline" className="text-xs">管理员</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">加入于 {new Date(member.joinedAt).toLocaleDateString()}</div>
                </div>
              </div>
              {member.role !== 'owner' && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-destructive opacity-50 hover:opacity-100"
                  onClick={() => handleKickMember(member.userId)}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  )

  const renderDisband = () => (
    <div className="p-4 space-y-6">
      <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20 text-destructive space-y-2">
        <div className="flex items-center gap-2 font-bold text-lg">
          <ShieldAlert className="h-5 w-5" />
          警告
        </div>
        <p className="text-sm">
          解散俱乐部是不可逆的操作。所有成员将被移除，俱乐部等级、领地和所有数据将被永久删除。
        </p>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          请输入 <span className="font-mono font-bold text-foreground">CONFIRM</span> 以确认
        </label>
        <Input 
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="CONFIRM"
          className="font-mono"
        />
      </div>

      <Button 
        variant="destructive" 
        className="w-full" 
        disabled={confirmText !== 'CONFIRM' || isLoading}
        onClick={handleDisband}
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
        确认解散俱乐部
      </Button>
    </div>
  )

  const getTitle = () => {
    switch (view) {
      case 'edit': return '编辑信息'
      case 'requests': return '入会申请'
      case 'members': return '成员管理'
      case 'disband': return '解散俱乐部'
      default: return '俱乐部管理'
    }
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center gap-2">
            {view !== 'menu' && (
              <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setView('menu')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DrawerTitle>{getTitle()}</DrawerTitle>
          </div>
          <DrawerDescription className="sr-only">
            管理您的俱乐部
          </DrawerDescription>
        </DrawerHeader>

        <div className="pb-8">
          {view === 'menu' && renderMenu()}
          {view === 'edit' && renderEdit()}
          {view === 'requests' && renderRequests()}
          {view === 'members' && renderMembers()}
          {view === 'disband' && renderDisband()}
        </div>

        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">关闭</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
