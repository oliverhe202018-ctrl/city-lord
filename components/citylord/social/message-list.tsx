"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Send, User, Bell, AlertCircle, Check, X, Swords, Clock, MapPin, Mic, Keyboard } from "lucide-react"
import { toast } from "sonner"
import useSWR from 'swr'
import { VoiceRecorder } from "@/components/chat/voice/VoiceRecorder"
import { VoiceBubble } from "@/components/chat/voice/VoiceBubble"
import type { VoiceRecordResult } from "@/hooks/useAudioRecorder"
import { useRouter } from 'next/navigation'
import { openUserProfile } from '@/lib/utils/nav'

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = input
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = `${process.env.NEXT_PUBLIC_API_SERVER || ''}${url}`
    }
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// sendMessage is used in the component
const sendMessage = async (receiverId: string, content: string, type: 'text' | 'system' | 'challenge' | 'voice' = 'text', audioInfo?: any) => {
  const res = await fetchWithTimeout('/api/message/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId, content, type, audioInfo }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to send message')
  return await res.json()
}

import { GlassCard } from "@/components/ui/GlassCard"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

interface Message {
  id: string
  content: string
  type: 'text' | 'system' | 'challenge' | 'voice'
  sender_id: string | null
  user_id: string
  created_at: string
  is_read: boolean
  audio_url?: string
  duration_ms?: number
  sender?: {
    nickname: string
    avatar_url: string
  }
}

interface MessageListProps {
  initialFriendId?: string
  mode?: 'system' | 'friend'
}

// 定义 fetcher
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch messages')
  return res.json()
})

export function MessageList({ initialFriendId, mode = 'system' }: MessageListProps) {
  const { data: messages = [], mutate, isLoading } = useSWR<Message[]>('/api/message/get-messages', fetcher, {
    revalidateOnFocus: true,
  })

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true;
    let receivedChannel: any = null;
    let sentChannel: any = null;
    const supabase = createClient();

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted || !session?.user?.id) return;

      const userId = session.user.id;
      setCurrentUserId(userId);

      receivedChannel = supabase.channel('messages-received')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${userId}`
        }, () => mutate())
        .subscribe();

      sentChannel = supabase.channel('messages-sent')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId}`
        }, () => mutate())
        .subscribe();
    };

    setup();

    return () => {
      isMounted = false;
      if (receivedChannel) supabase.removeChannel(receivedChannel);
      if (sentChannel) supabase.removeChannel(sentChannel);
    };
  }, [mutate]);

  const [input, setInput] = useState("")
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [activeChat, setActiveChat] = useState<string | null>(initialFriendId || null)

  const handleSend = async () => {
    if (!input.trim() || !activeChat) return

    try {
      const result = await sendMessage(activeChat, input)
      if (result && 'error' in result) {
        throw new Error(result.error);
      }
      setInput("")
      mutate() // Refresh messages via SWR
      toast.success("消息已发送")
    } catch (error: any) {
      toast.error(error.message || "发送失败")
    }
  }

  const handleSendVoice = async (result: VoiceRecordResult) => {
    if (!activeChat) return
    try {
      const resp = await sendMessage(activeChat, '[语音]', 'voice', {
        audioUrl: result.audioUrl,
        durationMs: result.durationMs,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes
      })
      if (resp && 'error' in resp) {
        throw new Error(resp.error);
      }
      mutate()
      toast.success("语音发送成功")
    } catch (error: any) {
      toast.error(error.message || "语音发送失败")
      if (result.audioUrl) {
        try {
          const supabase = createClient();
          await supabase.storage.from('voice-messages').remove([result.audioUrl]);
          console.log('Orphan voice message cleaned up:', result.audioUrl);
        } catch (e) {
          console.error('Failed to clean up orphan voice message:', e);
        }
      }
    }
  }

  const renderMessageContent = (msg: Message, isMe: boolean) => {
    if (msg.type === 'voice') {
      return (
        <VoiceBubble
          messageId={msg.id}
          audioUrl={msg.audio_url || null}
          durationMs={msg.duration_ms || null}
          isOwn={isMe}
        />
      )
    }

    if (msg.type === 'challenge') {
      try {
        const challengeData = JSON.parse(msg.content)
        // challengeData: { type: 'distance' | 'time', target: number, duration?: number }

        const isDistance = challengeData.type === 'distance'
        const value = isDistance ? `${challengeData.target}km` : `${challengeData.duration}分钟`

        return (
          <div className="mt-1 rounded-lg bg-muted/50 p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Swords className="h-4 w-4 text-orange-500" />
              <span className="font-bold text-orange-500">发起挑战</span>
            </div>
            <div className="text-sm text-foreground/90">
              {isDistance ? (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  目标距离: <span className="font-mono font-bold text-foreground">{value}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  目标时长: <span className="font-mono font-bold text-foreground">{value}</span>
                </div>
              )}
            </div>
            {/* Action Buttons (Demo only for now) */}
            <div className="mt-3 flex gap-2">
              <button className="flex-1 bg-green-500 text-white text-xs font-bold py-1.5 rounded-lg hover:bg-green-600 transition-colors">
                接受
              </button>
              <button className="flex-1 bg-muted text-muted-foreground text-xs font-bold py-1.5 rounded-lg hover:bg-muted/80 transition-colors">
                拒绝
              </button>
            </div>
          </div>
        )
      } catch (e) {
        return <p className="text-sm text-muted-foreground pl-7">收到一个挑战 (解析错误)</p>
      }
    }

    return <p className="text-sm text-muted-foreground pl-7">{msg.content}</p>
  }

  const filteredMessages = messages.filter((msg) => {
    if (mode === 'system') {
      return msg.type === 'system' || msg.type === 'challenge'
    }
    return (msg.sender_id === activeChat || msg.user_id === activeChat) && msg.type !== 'system'
  });

  if (isLoading && (!messages || messages.length === 0)) return <div className="text-center text-muted-foreground py-10">加载消息中...</div>

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      {/* Message List */}
      <div className="flex-1 overflow-y-auto space-y-3 p-1">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">暂无消息</div>
        ) : (
          filteredMessages.map((msg) => (
            <GlassCard key={msg.id} className={`p-3 border-l-4 ${msg.type === 'system' ? 'border-l-blue-500' :
              msg.type === 'challenge' ? 'border-l-orange-500' :
                'border-l-green-500'
              }`}>
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  {msg.type === 'system' ? (
                    <Bell className="w-4 h-4 text-blue-500" />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 ring-primary/50 transition-all"
                      onClick={() => openUserProfile(router, msg.sender_id)}
                    >
                      {msg.sender?.avatar_url ? (
                        <img src={msg.sender.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <span
                    className="font-bold text-sm text-foreground cursor-pointer hover:underline"
                    onClick={() => openUserProfile(router, msg.sender_id)}
                  >
                    {msg.sender?.nickname || '系统通知'}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: zhCN })}
                </span>
              </div>
              {renderMessageContent(msg, msg.sender_id === currentUserId)}
            </GlassCard>
          ))
        )}
      </div>

      {/* Quick Reply (Only if active chat selected and not in system mode) */}
      {mode === 'friend' && activeChat && (
        <div className="flex gap-2 pt-2 border-t border-border items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isVoiceMode ? <Keyboard className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {isVoiceMode ? (
            <VoiceRecorder receiverId={activeChat} onSend={handleSendVoice} />
          ) : (
            <>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入消息..."
                className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-green-500/50"
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 bg-green-500 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
