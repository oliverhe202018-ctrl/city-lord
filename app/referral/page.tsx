'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Copy, 
  Share2, 
  Users, 
  ChevronRight, 
  Gift, 
  Link as LinkIcon,
  Shield,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useGameStore } from '@/store/useGameStore';
import { getReferralData, ReferralData } from '@/app/actions/referral';
import { cn } from '@/lib/utils';

export default function ReferralPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReferralData | null>(null);
  
  // Toggles
  const [linkLobby, setLinkLobby] = useState(false);
  const [linkClub, setLinkClub] = useState(false);
  
  const { currentRoom, myClub } = useGameStore();

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getReferralData();
        if (result.success && result.data) {
          setData(result.data);
        } else {
          toast.error(result.error || '加载失败');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Generate Link
  const getInviteLink = () => {
    if (!data?.referralCode) return '';
    
    // In a real app, use window.location.origin
    // For now, assuming current domain or a hardcoded one
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let link = `${origin}/login?r=${data.referralCode}`;
    
    if (linkLobby && currentRoom?.id) {
      link += `&lobby=${currentRoom.id}`;
    }
    
    if (linkClub && myClub?.id) {
      link += `&club=${myClub.id}`;
    }
    
    return link;
  };

  const inviteLink = getInviteLink();

  const handleCopyCode = () => {
    if (data?.referralCode) {
      navigator.clipboard.writeText(data.referralCode);
      toast.success('推广码已复制');
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast.success('邀请链接已复制');
    }
  };

  const handleShare = async () => {
    if (navigator.share && inviteLink) {
      try {
        await navigator.share({
          title: '加入 City Lord',
          text: '和我一起在现实世界中攻城略地！使用我的邀请码加入：',
          url: inviteLink,
        });
      } catch (err) {
        console.error('Share failed', err);
      }
    } else {
      handleCopyLink();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md p-4 flex items-center gap-4 border-b border-white/10">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()}
          className="hover:bg-white/10"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-lg font-bold">邀请推广</h1>
      </div>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        {/* Hero Card */}
        <div className="bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] rounded-2xl p-6 shadow-lg shadow-orange-500/20 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full -ml-5 -mb-5 blur-xl" />
          
          <div className="relative z-10">
            <h2 className="text-white/90 text-sm font-medium mb-1">您的专属推广码</h2>
            <div className="flex items-center justify-between gap-4">
              <span className="text-4xl font-bold tracking-wider font-mono text-white">
                {data?.referralCode || '------'}
              </span>
              <Button 
                size="icon" 
                variant="ghost" 
                className="hover:bg-white/20 text-white rounded-full"
                onClick={handleCopyCode}
              >
                <Copy className="w-5 h-5" />
              </Button>
            </div>
            
            <div 
              className="mt-6 flex items-center gap-2 text-xs text-white/80 cursor-pointer hover:text-white transition-colors"
              onClick={() => toast.info('功能暂未开放')}
            >
              <span>想成为合作伙伴？</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground ml-1">自定义邀请</h3>
          
          <div className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">关联私人房间</div>
                  <div className="text-xs text-muted-foreground">
                    {currentRoom ? `当前: ${currentRoom.name}` : '未加入房间'}
                  </div>
                </div>
              </div>
              <Switch 
                checked={linkLobby} 
                onCheckedChange={(v) => {
                  if (v && !currentRoom) {
                    toast.error('请先加入一个房间');
                    return;
                  }
                  setLinkLobby(v);
                }}
              />
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">关联俱乐部</div>
                  <div className="text-xs text-muted-foreground">
                    {myClub ? `当前: ${myClub.name}` : '未加入俱乐部'}
                  </div>
                </div>
              </div>
              <Switch 
                checked={linkClub} 
                onCheckedChange={(v) => {
                  if (v && !myClub) {
                    toast.error('请先加入一个俱乐部');
                    return;
                  }
                  setLinkClub(v);
                }}
              />
            </div>
          </div>
        </div>

        {/* Share Area */}
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">邀请链接</label>
            <div className="relative">
              <Input 
                readOnly 
                value={inviteLink} 
                className="bg-black/50 border-white/10 pr-10 font-mono text-xs text-muted-foreground"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="border-white/10 hover:bg-white/5"
              onClick={handleCopyLink}
            >
              <Copy className="w-4 h-4 mr-2" />
              复制链接
            </Button>
            <Button 
              className="bg-white text-black hover:bg-white/90"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4 mr-2" />
              系统分享
            </Button>
          </div>
        </div>

        {/* Milestone */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Gift className="w-4 h-4 text-orange-500" />
              里程碑奖励
            </h3>
            <span className="text-xs text-muted-foreground">
              已邀请 {data?.invitedCount || 0} 人
            </span>
          </div>
          
          <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">再邀请 {Math.max(0, (data?.milestoneTarget || 3) - (data?.invitedCount || 0))} 位好友即可解锁...</span>
              <span className="text-white font-medium">{data?.invitedCount}/{data?.milestoneTarget}</span>
            </div>
            <Progress 
              value={Math.min(100, ((data?.invitedCount || 0) / (data?.milestoneTarget || 1)) * 100)} 
              className="h-2 bg-white/10" 
              // Custom indicator color would be done via class or inline style if component supports it,
              // assuming default shadcn progress uses primary color.
            />
          </div>
        </div>

        {/* Invite List */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground ml-1">已邀请好友</h3>
          
          <div className="bg-zinc-900/30 rounded-xl border border-white/5 divide-y divide-white/5">
            {data?.invitedUsers && data.invitedUsers.length > 0 ? (
              data.invitedUsers.map((user) => (
                <div key={user.id} className="p-3 flex items-center gap-3">
                  <Avatar className="w-10 h-10 border border-white/10">
                    <AvatarImage src={user.avatar_url || ''} />
                    <AvatarFallback className="bg-zinc-800 text-xs">
                      {user.nickname.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{user.nickname}</div>
                    <div className="text-xs text-muted-foreground">
                      加入时间: {new Date(user.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center space-y-2">
                <Users className="w-8 h-8 text-white/10 mx-auto" />
                <p className="text-sm text-muted-foreground">暂无邀请记录</p>
                <p className="text-xs text-white/20">快去分享给好友吧</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
