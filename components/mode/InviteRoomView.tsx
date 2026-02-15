import React from 'react';
import { Copy, Share2, ArrowLeft, Check, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Room } from '@/app/actions/room';

interface InviteRoomViewProps {
  room: Room;
  onBack: () => void;
}

export function InviteRoomView({ room, onBack }: InviteRoomViewProps) {
  const [hasCopied, setHasCopied] = React.useState(false);

  // 生成模拟的分享链接（您可以根据实际域名修改）
  const inviteLink = `https://citylord.app/invite/${room.invite_code || room.id}`;

  const handleCopyCode = async () => {
    if (!room.invite_code) return;
    try {
      await navigator.clipboard.writeText(room.invite_code);
      setHasCopied(true);
      toast.success('邀请码已复制');
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      toast.error('复制失败');
    }
  };

  const handleShareLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success('链接已复制到剪贴板');
    } catch (err) {
      toast.error('复制失败');
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
      {/* 顶部导航栏 */}
      <div className="px-6 pb-2 flex items-center gap-2 mb-4">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-white">邀请好友加入</h2>
      </div>

      <div className="px-6 space-y-6">
        {/* 邀请码卡片 */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center text-center space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
              <Copy className="w-4 h-4" />
              <span>房间邀请码</span>
            </div>
            <p className="text-xs text-white/30">将此 6 位代码发送给您的朋友</p>
          </div>

          <div className="w-full py-4 bg-gradient-to-br from-white/5 to-transparent rounded-xl border border-white/5">
            <span className="font-mono text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 tracking-widest select-all">
              {room.invite_code || '------'}
            </span>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-bold text-sm hover:bg-white/90 active:scale-95 transition-all"
          >
            {hasCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {hasCopied ? '已复制' : '复制邀请码'}
          </button>
        </div>

        {/* 分享链接卡片 */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
            <Share2 className="w-4 h-4" />
            <span>分享邀请链接</span>
          </div>

          <div className="space-y-3">
             <p className="text-xs text-white/40 leading-relaxed">
               适合尚未下载应用的朋友，或者直接通过社交软件分享。
             </p>
             
             <div className="flex items-center gap-2 p-1.5 pl-4 rounded-xl bg-black/20 border border-white/5">
                <LinkIcon className="w-4 h-4 text-white/30 flex-shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs text-white/50 truncate font-mono">{inviteLink}</p>
                </div>
             </div>

             <button
               onClick={handleShareLink}
               className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
             >
               <Share2 className="w-4 h-4" />
               分享链接
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}