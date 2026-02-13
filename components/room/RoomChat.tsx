'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    nickname: string | null;
    avatar_url: string | null;
  };
}

interface RoomChatProps {
  roomId: string;
  currentUser: {
    id: string;
    nickname?: string;
    avatar?: string;
  };
}

export function RoomChat({ roomId, currentUser }: RoomChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 使用 useMemo 或 useEffect 来初始化客户端，避免重新渲染问题
  // 或者直接在组件外部或 useMemo 中创建
  const supabase = createClient();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load initial messages and subscribe
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('room_messages')
          .select('*, profiles(nickname, avatar_url)')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true }) // Load oldest first for chat history flow
          .limit(50);

        if (error) throw error;

        // Sort by created_at ascending (oldest at top)
        const sortedData = (data as any[]).sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        setMessages(sortedData);
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error('无法加载聊天记录');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`room_chat:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // We need to fetch the profile for the new message because the payload doesn't have joined data
          // Optimization: If it's the current user, we already know the details
          let messageWithProfile = { ...newMessage };

          if (newMessage.user_id === currentUser.id) {
            messageWithProfile.profiles = {
              nickname: currentUser.nickname || 'Unknown',
              avatar_url: currentUser.avatar || null
            };
          } else {
             // Fetch sender profile
             const { data: profile } = await supabase
               .from('profiles')
               .select('nickname, avatar_url')
               .eq('id', newMessage.user_id)
               .single();
             
             if (profile) {
               messageWithProfile.profiles = profile;
             }
          }

          setMessages((prev) => [...prev, messageWithProfile]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUser, supabase]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from('room_messages')
        .insert({
          room_id: roomId,
          user_id: currentUser.id,
          content: newMessage.trim(),
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('发送失败');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/20 rounded-xl overflow-hidden border border-border">
      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-full text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
            <div className="p-3 bg-muted rounded-full">
              <Send className="w-6 h-6 opacity-50" />
            </div>
            <p className="text-sm">暂无消息，打个招呼吧！</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUser.id;
            const senderName = msg.profiles?.nickname || 'Unknown';
            const senderAvatar = msg.profiles?.avatar_url;

            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <Avatar className="w-8 h-8 border border-border">
                  <AvatarImage src={senderAvatar || undefined} />
                  <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                    {senderName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="text-[10px] text-muted-foreground mb-1 ml-1">
                      {senderName}
                    </span>
                  )}
                  <div 
                    className={`px-3 py-2 rounded-2xl text-sm break-words ${
                      isMe 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                        : 'bg-muted text-foreground rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground/70 mt-1 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-muted/20 border-t border-border">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="发送消息..."
            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50"
            disabled={isSending}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
