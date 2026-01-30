"use client"

import { useState, useEffect } from "react"
import { Send, User, Bell, AlertCircle, Check, X } from "lucide-react"
import { getMessages, sendMessage, markAsRead } from "@/app/actions/message"
import { toast } from "sonner"
import { GlassCard } from "@/components/ui/GlassCard"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

interface Message {
  id: string
  content: string
  type: 'text' | 'system' | 'challenge'
  sender_id: string | null
  receiver_id: string
  created_at: string
  is_read: boolean
  sender?: {
    nickname: string
    avatar_url: string
  }
}

interface MessageListProps {
  initialFriendId?: string
}

export function MessageList({ initialFriendId }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState("")
  const [activeChat, setActiveChat] = useState<string | null>(initialFriendId || null)

  useEffect(() => {
    loadMessages()
  }, [])

  const loadMessages = async () => {
    try {
      const data = await getMessages()
      // @ts-ignore
      setMessages(data)
    } catch (error) {
      console.error(error)
      toast.error("加载消息失败")
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || !activeChat) return

    try {
      await sendMessage(activeChat, input)
      setInput("")
      loadMessages() // Refresh messages
      toast.success("消息已发送")
    } catch (error) {
      toast.error("发送失败")
    }
  }

  // Group messages by conversation (user or system) - REMOVED unused code


  if (loading) return <div className="text-center text-white/50 py-10">加载消息中...</div>

  return (
    <div className="flex flex-col h-[600px] gap-4">
      {/* Message List */}
      <div className="flex-1 overflow-y-auto space-y-3 p-1">
        {messages.length === 0 ? (
          <div className="text-center text-white/30 py-10">暂无消息</div>
        ) : (
          messages.map((msg) => (
            <GlassCard key={msg.id} className={`p-3 border-l-4 ${msg.type === 'system' ? 'border-l-blue-500' : 'border-l-green-500'}`}>
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  {msg.type === 'system' ? (
                    <Bell className="w-4 h-4 text-blue-400" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                       {msg.sender?.avatar_url ? (
                         <img src={msg.sender.avatar_url} className="w-full h-full rounded-full" />
                       ) : (
                         <User className="w-3 h-3 text-white/70" />
                       )}
                    </div>
                  )}
                  <span className="font-bold text-sm text-white">
                    {msg.sender?.nickname || '系统通知'}
                  </span>
                </div>
                <span className="text-[10px] text-white/30">
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: zhCN })}
                </span>
              </div>
              <p className="text-sm text-white/80 pl-7">{msg.content}</p>
            </GlassCard>
          ))
        )}
      </div>

      {/* Quick Reply (Only if active chat selected) */}
      {activeChat && (
        <div className="flex gap-2 pt-2 border-t border-white/10">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-500/50"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 bg-green-500 rounded-xl text-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
