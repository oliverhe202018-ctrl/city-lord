'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmojiPicker } from '@/components/ui/EmojiPicker'
import { ChannelKey } from '@/lib/types/club-chat.types'

const MAX_LENGTH = 500
const THROTTLE_MS = 2000 // P1: 2s send throttle

interface MessageInputProps {
    channelKey: string
    userRole: 'owner' | 'admin' | 'member' | null
    onSend: (content: string, audioInfo?: any) => Promise<void>
    disabled?: boolean
}

export function MessageInput({ channelKey, userRole, onSend, disabled }: MessageInputProps) {
    const [content, setContent] = useState('')
    const [isSending, setIsSending] = useState(false)
    const lastSentRef = useRef<number>(0)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // P0 #3: Announcement channel — only owner/admin can send
    const isAnnouncementChannel = channelKey === ChannelKey.ANNOUNCEMENT
    const canSendInChannel = !isAnnouncementChannel || userRole === 'owner' || userRole === 'admin'

    const trimmed = content.trim()
    const charCount = trimmed.length
    const isOverLimit = charCount > MAX_LENGTH
    const canSend = canSendInChannel && charCount > 0 && !isOverLimit && !isSending && !disabled

    const handleSend = useCallback(async () => {
        if (!canSend) return

        // P1: client-side throttle
        const now = Date.now()
        if (now - lastSentRef.current < THROTTLE_MS) return
        lastSentRef.current = now

        const text = trimmed
        setContent('')
        setIsSending(true)
        try {
            await onSend(text)
        } finally {
            setIsSending(false)
            // Refocus textarea after send
            textareaRef.current?.focus()
        }
    }, [canSend, trimmed, onSend])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // Auto-resize textarea
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value)
        const ta = e.target
        ta.style.height = 'auto'
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
    }

    if (!canSendInChannel) {
        return (
            <div className="flex items-center justify-center gap-2 border-t border-white/5 bg-zinc-900/80 px-4 py-3">
                <Lock className="h-4 w-4 text-white/30" />
                <span className="text-sm text-white/30">仅管理员可在公告频道发言</span>
            </div>
        )
    }

    return (
        <div className="border-t border-white/5 bg-zinc-900/80 px-3 py-2.5">
            <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 relative">
                    <textarea
                        ref={textareaRef}
                        id="message-input"
                        value={content}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder="输入消息..."
                        rows={1}
                        disabled={disabled || isSending}
                        className={cn(
                            'w-full resize-none rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-white',
                            'placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-yellow-500/40',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            'transition-colors duration-150',
                            isOverLimit && 'border-red-500/50 focus:ring-red-500/40'
                        )}
                        style={{ maxHeight: 120 }}
                    />
                    {charCount > 0 && (
                        <span
                            className={cn(
                                'absolute right-2 bottom-1.5 text-[10px]',
                                isOverLimit ? 'text-red-400' : 'text-white/20'
                            )}
                        >
                            {charCount}/{MAX_LENGTH}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <EmojiPicker onEmojiSelect={(emoji) => setContent(p => p + emoji)} />
                    <Button
                        id="send-message-btn"
                        onClick={handleSend}
                        disabled={!canSend}
                        size="icon"
                        className={cn(
                            'h-10 w-10 rounded-xl transition-all duration-150 flex-shrink-0',
                            canSend
                                ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                                : 'bg-white/5 text-white/20 cursor-not-allowed'
                        )}
                    >
                        {isSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
