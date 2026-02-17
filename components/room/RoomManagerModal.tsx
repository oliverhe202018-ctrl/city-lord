'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { AvatarUploader } from '@/components/ui/AvatarUploader';
import { Loader2, Users, MapPin, Clock, ArrowRight, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useGameActions } from '@/store/useGameStore';
import { Room } from '@/types/room';

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const joinRoomByCode = async (code: string) => {
  const res = await fetchWithTimeout('/api/room/join-room-by-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to join room by code')
  return await res.json()
}

const createRoom = async (payload: {
  name: string
  avatar_url: string
  allow_chat: boolean
  allow_imports: boolean
  allow_member_invite: boolean
  max_participants: number
  is_private: boolean
}) => {
  const res = await fetchWithTimeout('/api/room/create-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to create room')
  return await res.json()
}


interface RoomManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoomEnter?: (roomId: string) => void;
}

export function RoomManagerModal({ open, onOpenChange, onRoomEnter }: RoomManagerModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('join');
  const [isLoading, setIsLoading] = useState(false);

  // Join Room State
  const [inviteCode, setInviteCode] = useState('');
  const [foundRoom, setFoundRoom] = useState<Room | null>(null);

  // Create Room State
  const [roomName, setRoomName] = useState('');
  const [roomAvatar, setRoomAvatar] = useState('');
  const [allowChat, setAllowChat] = useState(true);
  const [allowImports, setAllowImports] = useState(true);
  const [allowMemberInvite, setAllowMemberInvite] = useState(true);
  const [maxMembers, setMaxMembers] = useState(10);
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);
  const [createdInviteCode, setCreatedInviteCode] = useState('');

  const { setCurrentRoom, addJoinedRoom } = useGameActions();

  useEffect(() => {
    if (createdRoom?.invite_code && !createdInviteCode) {
      setCreatedInviteCode(createdRoom.invite_code);
    }
  }, [createdRoom, createdInviteCode]);

  // Reset state when modal closes or tab changes
  const resetState = () => {
    setInviteCode('');
    setFoundRoom(null);
    setRoomName('');
    setRoomAvatar('');
    setAllowChat(true);
    setAllowImports(true);
    setAllowMemberInvite(true);
    setMaxMembers(10);
    setCreatedRoom(null);
    setCreatedInviteCode('');
    setIsLoading(false);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    resetState();
  };

  // Handle Join Room
  const handleJoinRoom = async (code: string) => {
    if (code.length !== 6) return;

    setIsLoading(true);
    try {
      const result = await joinRoomByCode(code);

      if (result.success && result.room) {
        setFoundRoom(result.room as Room);
        toast.success('找到房间！');
      } else {
        toast.error(result.error || '无法加入房间');
        setInviteCode(''); // Clear invalid code
      }
    } catch (error) {
      console.error(error);
      toast.error('发生错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmJoin = () => {
    if (foundRoom) {
      addJoinedRoom(foundRoom);
      setCurrentRoom(foundRoom);
      toast.success(`已加入房间: ${foundRoom.name}`);
      onOpenChange(false);
      resetState();
    }
  };

  // Handle Create Room
  const handleCreateRoom = async () => {
    // 校验逻辑
    if (!roomName || roomName.trim() === "") {
      toast.error("请输入房间名称");
      return;
    }
    if (!roomAvatar) {
      toast.error("请上传房间头像");
      return;
    }

    if (!roomName.trim()) {
      toast.error('请输入房间名称');
      return;
    }

    setIsLoading(true);
    try {
      const result = await createRoom({
        name: roomName,
        avatar_url: roomAvatar,
        allow_chat: allowChat,
        allow_imports: allowImports,
        allow_member_invite: allowMemberInvite,
        max_participants: maxMembers,
        is_private: true, // Default to private for invite code rooms
      });

      if (result.success && result.room) {
        setCreatedRoom(result.room as Room);
        setCreatedInviteCode(result.room.invite_code || '');
        toast.success('房间创建成功！');
      } else {
        toast.error(result.error || '创建失败');
      }
    } catch (error) {
      console.error(error);
      toast.error('发生错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmCreate = () => {
    if (createdRoom) {
      addJoinedRoom(createdRoom);
      setCurrentRoom(createdRoom);
      onOpenChange(false);
      resetState();

      // Trigger callback to open RoomDrawer
      if (onRoomEnter) {
        onRoomEnter(createdRoom.id);
      } else {
        router.push(`/game/room/${createdRoom.id}`);
      }
    }
  };

  const copyInviteCode = () => {
    const codeToCopy = createdInviteCode || createdRoom?.invite_code;
    if (codeToCopy) {
      navigator.clipboard.writeText(codeToCopy);
      toast.success('邀请码已复制');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) resetState();
    }}>
      <DialogContent className="sm:max-w-[425px] h-[90vh] sm:h-auto flex flex-col gap-0 p-0 bg-background/95 backdrop-blur-xl border-white/10">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            多人游戏大厅
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            加入现有房间或创建新的游戏房间
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50">
              <TabsTrigger value="join">加入房间</TabsTrigger>
              <TabsTrigger value="create">创建房间</TabsTrigger>
            </TabsList>
          </div>

          {/* Join Tab */}
          <TabsContent value="join" className="flex-1 p-6 flex flex-col items-center gap-6 mt-0">
            {!foundRoom ? (
              <div className="w-full flex flex-col items-center gap-8 py-8">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-medium text-foreground">输入邀请码</h3>
                  <p className="text-sm text-muted-foreground">请输入 6 位数字邀请码加入房间</p>
                </div>

                <InputOTP
                  maxLength={6}
                  value={inviteCode}
                  onChange={(val) => {
                    setInviteCode(val);
                    if (val.length === 6) handleJoinRoom(val);
                  }}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-12 h-14 text-2xl border-white/20 bg-zinc-800/80 text-white" />
                    <InputOTPSlot index={1} className="w-12 h-14 text-2xl border-white/20 bg-zinc-800/80 text-white" />
                    <InputOTPSlot index={2} className="w-12 h-14 text-2xl border-white/20 bg-zinc-800/80 text-white" />
                    <InputOTPSlot index={3} className="w-12 h-14 text-2xl border-white/20 bg-zinc-800/80 text-white" />
                    <InputOTPSlot index={4} className="w-12 h-14 text-2xl border-white/20 bg-zinc-800/80 text-white" />
                    <InputOTPSlot index={5} className="w-12 h-14 text-2xl border-white/20 bg-zinc-800/80 text-white" />
                  </InputOTPGroup>
                </InputOTP>

                {isLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>正在查找房间...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full space-y-6 py-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-24 h-24 rounded-2xl bg-muted overflow-hidden ring-4 ring-cyan-500/20 shadow-xl shadow-cyan-500/10">
                    <Image
                      src={foundRoom.avatar_url || `https://avatar.vercel.sh/${encodeURIComponent(foundRoom.name)}`}
                      alt={foundRoom.name}
                      fill
                      unoptimized={!!foundRoom.avatar_url?.startsWith('blob:')}
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground">{foundRoom.name}</h2>
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 mt-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      ID: {foundRoom.invite_code}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-md text-blue-400">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">成员</div>
                      <div className="font-medium">{foundRoom.participants_count} / {foundRoom.max_participants}</div>
                    </div>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-md text-purple-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">目标</div>
                      <div className="font-medium">{foundRoom.target_distance_km ? `${foundRoom.target_distance_km}km` : '无限制'}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => resetState()}>
                    返回
                  </Button>
                  <Button className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white" onClick={confirmJoin}>
                    进入房间
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Create Tab */}
          <TabsContent value="create" className="flex-1 p-6 flex flex-col gap-6 mt-0 overflow-y-auto max-h-[80vh] pb-40">
            {!createdRoom ? (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <AvatarUploader
                    currentAvatarUrl={roomAvatar}
                    onUploadComplete={(url) => {
                      console.log("Image uploaded:", url);
                      setRoomAvatar(url);
                    }}
                    className="w-24 h-24"
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="roomName">房间名称</Label>
                    <Input
                      id="roomName"
                      placeholder="给你的房间起个名字..."
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      className="bg-zinc-800/80 border-white/20 text-white placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>开启聊天</Label>
                        <p className="text-xs text-muted-foreground">允许成员在房间内发送消息</p>
                      </div>
                      <Switch checked={allowChat} onCheckedChange={setAllowChat} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>允许导入数据</Label>
                        <p className="text-xs text-muted-foreground">允许成员导入历史运动数据</p>
                      </div>
                      <Switch checked={allowImports} onCheckedChange={setAllowImports} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>成员邀请</Label>
                        <p className="text-xs text-muted-foreground">允许成员邀请其他人加入</p>
                      </div>
                      <Switch checked={allowMemberInvite} onCheckedChange={setAllowMemberInvite} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>最大人数限制</Label>
                        <p className="text-xs text-muted-foreground">设置房间内允许的最大成员数量</p>
                      </div>
                      <div className="flex items-center gap-3 bg-zinc-800/80 border border-white/20 rounded-lg p-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-zinc-400 hover:text-white hover:bg-white/10"
                          onClick={() => setMaxMembers(Math.max(2, maxMembers - 1))}
                          disabled={maxMembers <= 2}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center text-sm font-medium text-white">{maxMembers}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-zinc-400 hover:text-white hover:bg-white/10"
                          onClick={() => setMaxMembers(Math.min(100, maxMembers + 1))}
                          disabled={maxMembers >= 100}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white mt-4"
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  立即创建
                </Button>
              </div>
            ) : (
              <div className="w-full space-y-8 py-8 animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold">房间创建成功！</h3>
                  <p className="text-muted-foreground">快把邀请码分享给好友吧</p>
                </div>

                <div className="bg-muted/50 border border-dashed border-white/20 rounded-xl p-6 flex flex-col items-center gap-4">
                  <span className="text-sm text-muted-foreground">房间邀请码</span>
                  {(createdInviteCode || createdRoom?.invite_code) ? (
                    <>
                      <div className="text-4xl font-mono font-bold tracking-[0.5em] text-cyan-400">
                        {createdInviteCode || createdRoom?.invite_code}
                      </div>
                      <Button variant="ghost" size="sm" className="gap-2" onClick={copyInviteCode}>
                        <Copy className="w-4 h-4" />
                        复制邀请码
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>生成中...</span>
                    </div>
                  )}
                </div>

                <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" onClick={confirmCreate} disabled={!createdRoom}>
                  进入房间
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
