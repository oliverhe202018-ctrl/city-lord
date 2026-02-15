import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, User, Wifi, WifiOff } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface RoomChatProps {
  roomId: string;
  participants?: {
    id: string;
    nickname: string;
    avatar?: string;
  }[];
  currentUser?: {
      id: string;
      nickname: string;
      avatar?: string;
  };
}

const formatTime = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (e) {
    return '';
  }
};

export function RoomChat({ roomId, participants = [], currentUser }: RoomChatProps) {
  // ✅ FIX: Use useState lazy initializer to ensure singleton pattern within component
  const [supabase] = useState(() => createClient());
  const userId = useGameStore((state) => state.userId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // ✅ FIX: Store channel reference to ensure cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // 获取历史消息
  useEffect(() => {
    if (!roomId) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('room_messages' as any)
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true })
          .limit(50);

        if (!error && data) {
          setMessages(data);
          setTimeout(scrollToBottom, 100);
        }
      } catch (error) {
        console.error('[RoomChat] Fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [roomId, supabase]); // Separate effect for fetching history

  // 订阅实时消息 (Robust Connection Manager with Self-Healing)
  useEffect(() => {
    if (!roomId) return;

    let channel: RealtimeChannel | null = null;
    let isMounted = true; 
    let retryTimeout: NodeJS.Timeout;

    const connect = async () => {
        // 如果已经有连接，先清理
        if (channel) await supabase.removeChannel(channel);

        console.log('[RoomChat] Initiating connection for room:', roomId);
        setConnectionStatus('CONNECTING');
        
        // 2. 创建频道 - Include timestamp to force new channel
        const channelName = `room-chat-${roomId}-${Date.now()}`;
        channel = supabase.channel(channelName, {
            config: {
                broadcast: { self: true },
                presence: { key: userId || 'anon' },
            },
        });

        // 3. 绑定事件
        channel
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'room_messages',
                filter: `room_id=eq.${roomId}`,
              },
              (payload) => {
                if (!isMounted) return;
                console.log('[RoomChat] Received message:', payload);
                const newMsg = payload.new as Message;
                setMessages((prev) => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });
                setTimeout(scrollToBottom, 100);
              }
            )
            .subscribe((status, err) => {
                console.log(`[RoomChat] Status changed: ${status}`, err);
                
                if (!isMounted) return;

                if (status === 'SUBSCRIBED') {
                    setConnectionStatus('CONNECTED');
                } 
                else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                    setConnectionStatus('DISCONNECTED');
                    // 4. 遇到错误，3秒后自动重试
                    console.log('[RoomChat] Connection lost, retrying in 3s...');
                    clearTimeout(retryTimeout);
                    retryTimeout = setTimeout(() => {
                        if (isMounted) connect();
                    }, 3000);
                }
            });
    };

    connect();

    // 5. 严格的清理函数
    return () => {
        isMounted = false;
        clearTimeout(retryTimeout);
        if (channel) {
            console.log('[RoomChat] Cleaning up channel...');
            supabase.removeChannel(channel);
        }
    };
  }, [roomId, supabase, userId]); // 确保依赖项正确

  const handleSend = async () => {
    if (!newMessage.trim() || !userId) return;

    const content = newMessage.trim();
    setNewMessage(''); // 立即清空输入框

    const { error } = await supabase.from('room_messages' as any).insert({
      room_id: roomId,
      user_id: userId,
      content: content,
    });

    if (error) {
      console.error('发送失败:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 根据 user_id 获取用户信息
  const getUserInfo = (uid: string) => {
    const user = participants.find((p) => p.id === uid);
    if (user) {
        return {
            name: user.nickname,
            avatar: user.avatar,
            isMe: uid === userId,
        };
    }
    
    if (uid === userId && currentUser) {
        return {
            name: currentUser.nickname,
            avatar: currentUser.avatar,
            isMe: true
        }
    }

    return {
      name: '未知用户',
      avatar: undefined,
      isMe: uid === userId,
    };
  };

  return (
    <div className="flex flex-col h-full bg-black/20 rounded-xl overflow-hidden border border-white/5 relative">
        {/* Connection Status Indicator */}
        <div className="absolute top-2 right-2 z-10 pointer-events-none">
            {connectionStatus === 'CONNECTED' ? (
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-green-500/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <span className="text-[10px] font-medium text-green-400">LIVE</span>
                </div>
            ) : connectionStatus === 'CONNECTING' ? (
                 <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-yellow-500/30">
                    <Wifi className="w-3 h-3 text-yellow-500 animate-pulse" />
                    <span className="text-[10px] font-medium text-yellow-400">CONNECTING</span>
                </div>
            ) : (
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-red-500/30">
                    <WifiOff className="w-3 h-3 text-red-500" />
                    <span className="text-[10px] font-medium text-red-400">OFFLINE</span>
                </div>
            )}
        </div>

      {/* 消息列表区域 */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {isLoading && <div className="text-center text-white/30 text-xs py-4">加载消息中...</div>}
        
        {!isLoading && messages.length === 0 && (
          <div className="text-center text-white/30 text-xs py-10">
            暂无消息，打个招呼吧！
          </div>
        )}

        {messages.map((msg) => {
          const { name, avatar, isMe } = getUserInfo(msg.user_id);
          const timeStr = formatTime(msg.created_at);

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* 头像 */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 overflow-hidden border border-white/10 flex items-center justify-center">
                {avatar ? (
                  <img src={avatar} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-white/50" />
                )}
              </div>

              {/* 气泡 */}
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                 {/* Metadata Row: Name & Time */}
                 <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isMe && <span className="text-[10px] text-white/40">{name}</span>}
                    <span className="text-[10px] text-white/30 select-none">{timeStr}</span>
                 </div>

                 <div
                  className={`px-3 py-2 rounded-2xl text-sm break-all ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white/10 text-white/90 rounded-tl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部输入框 */}
      <div className="p-3 bg-white/5 border-t border-white/5 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="发送消息..."
          className="flex-1 bg-black/30 text-white text-sm rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder-white/30"
        />
        <button
          onClick={handleSend}
          disabled={!newMessage.trim()}
          className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-full text-white transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
