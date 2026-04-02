"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Send, User, Bell, Swords, Clock, MapPin, Mic, Keyboard, Coins, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import useSWR from 'swr'
import { VoiceRecorder } from "@/components/chat/voice/VoiceRecorder"
import { VoiceBubble } from "@/components/chat/voice/VoiceBubble"
import type { VoiceRecordResult } from "@/hooks/useAudioRecorder"
import { useRouter } from 'next/navigation'
import { openUserProfile } from '@/lib/utils/nav'
import { EmojiPicker } from "@/components/ui/EmojiPicker"

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
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useMessageStore } from "@/store/useMessageStore"
import type { SystemMessage } from "@/types/system-message"

function formatWeChatTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "HH:mm")
  if (isYesterday(date)) return "昨天 " + format(date, "HH:mm")
  if (isThisWeek(date)) return format(date, "EEEE HH:mm", { locale: zhCN })
  return format(date, "yyyy年MM月dd日 HH:mm")
}

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
  const { data: messages = [], mutate, isLoading, error: messagesError } = useSWR<Message[]>('/api/message/get-messages', fetcher, {
    revalidateOnFocus: true,
  })
  const systemMessages = useMessageStore((s) => s.systemMessages)
  const isSystemLoading = useMessageStore((s) => s.isLoading)
  const systemError = useMessageStore((s) => s.error)
  const fetchSystemMessages = useMessageStore((s) => s.fetchSystemMessages)
  const markSystemMessageRead = useMessageStore((s) => s.markSystemMessageRead)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const router = useRouter()
  const lastSystemErrorRef = useRef<string | null>(null)
  const lastMessagesErrorRef = useRef<string | null>(null)

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

  useEffect(() => {
    if (mode === 'system') {
      fetchSystemMessages()
    }
  }, [mode, fetchSystemMessages])

  useEffect(() => {
    if (!systemError) {
      lastSystemErrorRef.current = null
      return
    }
    if (lastSystemErrorRef.current === systemError) return
    lastSystemErrorRef.current = systemError
    toast.error("系统消息加载失败", { description: systemError })
  }, [systemError])

  useEffect(() => {
    const msg = messagesError instanceof Error ? messagesError.message : (messagesError ? String(messagesError) : '')
    if (!msg) {
      lastMessagesErrorRef.current = null
      return
    }
    if (lastMessagesErrorRef.current === msg) return
    lastMessagesErrorRef.current = msg
    toast.error("消息加载失败", { description: msg })
  }, [messagesError])

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

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (mode === 'system') {
        return msg.type === 'system' || msg.type === 'challenge'
      }
      return (msg.sender_id === activeChat || msg.user_id === activeChat) && msg.type !== 'system'
    })
  }, [messages, mode, activeChat])

  const sortedMessages = useMemo(() => {
    return [...filteredMessages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [filteredMessages])

  const displayMessages = mode === 'friend' ? sortedMessages : filteredMessages

  const systemDisplayMessages = useMemo(() => {
    return [...systemMessages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [systemMessages])

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomAnchorRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef(0)
  const prevActiveChatRef = useRef<string | null>(null)
  const isUserNearBottomRef = useRef(true)

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    isUserNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (mode === 'friend') {
      bottomAnchorRef.current?.scrollIntoView({ behavior, block: 'end' })
    }
  }

  const displayMessagesLength = displayMessages.length
  const lastMessageId = displayMessagesLength > 0 ? displayMessages[displayMessagesLength - 1].id : null
  const lastMessageSenderId = displayMessagesLength > 0 ? displayMessages[displayMessagesLength - 1].sender_id : null

  useEffect(() => {
    if (mode !== 'friend') return

    const isChatChanged = prevActiveChatRef.current !== activeChat
    if (isChatChanged) {
      prevMessagesLengthRef.current = 0
      prevActiveChatRef.current = activeChat
    }

    if (!isLoading && displayMessagesLength > 0) {
      const prevLen = prevMessagesLengthRef.current
      const currentLen = displayMessagesLength

      if (prevLen === 0 || isChatChanged) {
        scrollToBottom('auto')
      } else if (currentLen > prevLen) {
        const wasNearBottom = isUserNearBottomRef.current
        const isMe = lastMessageSenderId === currentUserId

        if (isMe) {
          scrollToBottom('smooth')
        } else if (wasNearBottom) {
          scrollToBottom('smooth')
        }
      }
      prevMessagesLengthRef.current = currentLen
    } else if (!isLoading && displayMessagesLength === 0) {
      prevMessagesLengthRef.current = 0
    }
  }, [displayMessagesLength, lastMessageId, lastMessageSenderId, activeChat, mode, currentUserId, isLoading])

  if (mode === 'system' && systemError && systemDisplayMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="text-sm font-semibold text-destructive">系统消息加载失败</div>
        <div className="text-xs text-muted-foreground px-6 text-center">{systemError}</div>
        <button
          type="button"
          onClick={() => { fetchSystemMessages().catch(() => {}) }}
          className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
        >
          重试
        </button>
      </div>
    )
  }
  if (mode === 'system' && isSystemLoading && systemDisplayMessages.length === 0) return <div className="text-center text-muted-foreground py-10">加载消息中...</div>
  if (mode === 'friend' && messagesError && (!messages || messages.length === 0)) {
    const msg = messagesError instanceof Error ? messagesError.message : '加载失败'
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="text-sm font-semibold text-destructive">私聊消息加载失败</div>
        <div className="text-xs text-muted-foreground px-6 text-center">{msg}</div>
        <button
          type="button"
          onClick={() => { mutate().catch(() => {}) }}
          className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
        >
          重试
        </button>
      </div>
    )
  }
  if (mode === 'friend' && isLoading && (!messages || messages.length === 0)) return <div className="text-center text-muted-foreground py-10">加载消息中...</div>

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Message List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto ${mode === 'friend' ? 'px-4 py-2 space-y-0 relative' : 'space-y-3 p-1'}`}
      >
        {(mode === 'system' ? systemDisplayMessages.length === 0 : displayMessages.length === 0) ? (
          <div className="text-center text-muted-foreground py-10">暂无消息</div>
        ) : (
          (mode === 'system' ? systemDisplayMessages : displayMessages).map((msg: Message | SystemMessage, index) => {
            if (mode === 'system') {
              const systemMsg = msg as SystemMessage
              const isCombat = systemMsg.type === 'combat_alert'
              const isRevenue = systemMsg.type === 'revenue'
              const styleClass = isRevenue
                ? 'border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5'
                : isCombat
                  ? 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-500/5'
                  : 'border-l-4 border-l-blue-500 bg-slate-50/50 dark:bg-slate-500/5'
              const Icon = isRevenue ? Coins : isCombat ? AlertTriangle : Bell
              const iconClass = isRevenue
                ? 'w-4 h-4 text-emerald-500'
                : isCombat
                  ? 'w-4 h-4 text-red-500 animate-pulse'
                  : 'w-4 h-4 text-blue-500'

              return (
                <GlassCard
                  key={systemMsg.id}
                  className={`p-3 cursor-pointer transition-colors ${styleClass}`}
                  onClick={() => markSystemMessageRead(systemMsg.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className={iconClass} />
                      <span className="font-bold text-sm text-foreground">{systemMsg.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!systemMsg.isRead && <span className="w-2 h-2 rounded-full bg-red-500" />}
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(systemMsg.createdAt), { addSuffix: true, locale: zhCN })}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground pl-6">{systemMsg.content}</p>
                </GlassCard>
              )
            }

            const friendMsg = msg as Message
            const isMe = friendMsg.sender_id === currentUserId;
            const currentMsgTime = new Date(friendMsg.created_at).getTime();
            const prevMsgTime = index > 0 ? new Date(displayMessages[index - 1].created_at).getTime() : 0;
            const showTimeLabel = index === 0 || (currentMsgTime - prevMsgTime) >= 5 * 60 * 1000;


            return (
              <div key={friendMsg.id} className="flex flex-col w-full mb-4">
                {showTimeLabel && (
                  <div className="flex justify-center mb-4 mt-2">
                    <span className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
                      {formatWeChatTime(friendMsg.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex w-full gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 cursor-pointer shadow-sm border border-border/10"
                    onClick={() => {
                      if (!friendMsg.sender_id) {
                        toast.warning('用户信息缺失，无法打开主页')
                        return
                      }
                      openUserProfile(router, friendMsg.sender_id, window.location.pathname + window.location.search)
                    }}
                  >
                    {friendMsg.sender?.avatar_url ? (
                      <img src={friendMsg.sender.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Bubble Content */}
                  <div className={`flex flex-col max-w-[70%] justify-center ${isMe ? 'items-end' : 'items-start'}`}>
                    {friendMsg.type === 'voice' ? (
                      <VoiceBubble
                        messageId={friendMsg.id}
                        audioUrl={friendMsg.audio_url || null}
                        durationMs={friendMsg.duration_ms || null}
                        isOwn={isMe}
                      />
                    ) : friendMsg.type === 'challenge' ? (
                      renderMessageContent(friendMsg, isMe)
                    ) : (
                      <div className={`px-3 py-2 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${isMe
                        ? 'bg-green-500 text-white rounded-2xl rounded-tr-sm shadow-sm'
                        : 'bg-muted/80 text-foreground rounded-2xl rounded-tl-sm border border-border/50 shadow-sm'
                        }`}>
                        {friendMsg.content}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        {mode === 'friend' && <div ref={bottomAnchorRef} />}
      </div>

      {/* Quick Reply (Only if active chat selected and not in system mode) */}
      {mode === 'friend' && activeChat && (
        <div className="flex gap-2 p-2.5 bg-card/95 backdrop-blur border-t border-border items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {isVoiceMode ? <Keyboard className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {isVoiceMode ? (
            <div className="flex-1 min-w-0 flex">
              <VoiceRecorder receiverId={activeChat} onSend={handleSendVoice} />
            </div>
          ) : (
            <>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入消息..."
                className="flex-1 min-w-0 bg-muted/50 border border-border rounded-xl px-4 py-2 text-[15px] text-foreground focus:outline-none focus:border-green-500/50"
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <div className="flex items-center gap-0.5 shrink-0">
                <EmojiPicker 
                  onEmojiSelect={(emoji) => setInput(p => p + emoji)} 
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" 
                  iconClassName="w-6 h-6" 
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-2 bg-green-500 rounded-xl text-white shadow-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
