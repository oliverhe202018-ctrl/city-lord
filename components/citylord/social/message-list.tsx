"use client"

import { useState, useEffect } from "react"
import { Send, User, Bell, AlertCircle, Check, X, Swords, Clock, MapPin } from "lucide-react"
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
  
  const renderMessageContent = (msg: Message) => {
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

  if (loading) return <div className="text-center text-muted-foreground py-10">加载消息中...</div>

  return (
    <div className="flex flex-col h-[600px] gap-4">
      {/* Message List */}
      <div className="flex-1 overflow-y-auto space-y-3 p-1">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">暂无消息</div>
        ) : (
          messages.map((msg) => (
            <GlassCard key={msg.id} className={`p-3 border-l-4 ${
              msg.type === 'system' ? 'border-l-blue-500' : 
              msg.type === 'challenge' ? 'border-l-orange-500' :
              'border-l-green-500'
            }`}>
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  {msg.type === 'system' ? (
                    <Bell className="w-4 h-4 text-blue-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                       {msg.sender?.avatar_url ? (
                         <img src={msg.sender.avatar_url} className="w-full h-full object-cover" />
                       ) : (
                         <User className="w-3 h-3 text-muted-foreground" />
                       )}
                    </div>
                  )}
                  <span className="font-bold text-sm text-foreground">
                    {msg.sender?.nickname || '系统通知'}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: zhCN })}
                </span>
              </div>
              {renderMessageContent(msg)}
            </GlassCard>
          ))
        )}
      </div>

      {/* Quick Reply (Only if active chat selected) */}
      {activeChat && (
        <div className="flex gap-2 pt-2 border-t border-border">
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
        </div>
      )}
    </div>
  )
}
