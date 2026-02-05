'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Share2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Room } from '@/types/room';

interface InviteRoomViewProps {
  room: Room;
  onBack?: () => void;
}

export function InviteRoomView({ room, onBack }: InviteRoomViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (room.invite_code) {
      navigator.clipboard.writeText(room.invite_code);
      setCopied(true);
      toast.success('房间码已复制');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    // Placeholder for share functionality
    toast.info('分享功能即将上线');
  };

  return (
    <div className="flex flex-col h-full px-6 py-4 space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-white">邀请好友加入</h2>
        <p className="text-sm text-white/50">分享房间码或链接给你的好友</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-6">
        <div className="text-center space-y-2">
           <span className="text-xs font-medium text-white/40 uppercase tracking-widest">房间邀请码</span>
           <div 
             className="text-5xl font-mono font-bold text-cyan-400 tracking-wider cursor-pointer hover:scale-105 transition-transform"
             onClick={handleCopyCode}
           >
             {room.invite_code || '------'}
           </div>
        </div>
        
        <Button 
          variant={copied ? "default" : "outline"}
          className={`w-full ${copied ? 'bg-green-600 hover:bg-green-700 text-white border-none' : 'border-white/20 text-white hover:bg-white/10'}`}
          onClick={handleCopyCode}
        >
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? '已复制' : '复制房间码'}
        </Button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 text-white/70">
           <Share2 className="w-4 h-4" />
           <span className="text-sm font-medium">分享链接</span>
        </div>
        
        <div className="flex gap-2">
           <Input 
             readOnly 
             value={`https://citylord.game/room/${room.invite_code}`}
             className="bg-black/20 border-white/10 text-white/50 text-xs font-mono"
           />
           <Button className="bg-cyan-600 hover:bg-cyan-700 text-white shrink-0" onClick={handleShare}>
             分享
           </Button>
        </div>
        <p className="text-[10px] text-white/30 text-center">
          好友未安装 App 也可以通过链接查看房间信息
        </p>
      </div>
      
      {onBack && (
        <div className="mt-auto">
           <Button variant="ghost" className="w-full text-white/50 hover:text-white" onClick={onBack}>
             返回房间详情
           </Button>
        </div>
      )}
    </div>
  );
}
