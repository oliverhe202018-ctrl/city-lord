'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ClubChannel } from '@/lib/types/club-chat.types'
import { ChannelKey } from '@/lib/types/club-chat.types'
import { Megaphone, CheckCircle2, CalendarDays, Map, MessageCircle, Hash } from 'lucide-react'

// ─── Channel icon mapping ──────────────────────────────────────
const CHANNEL_ICONS: Record<string, React.ReactNode> = {
    [ChannelKey.ANNOUNCEMENT]: <Megaphone className="h-4 w-4" />,
    [ChannelKey.CHECKIN]: <CheckCircle2 className="h-4 w-4" />,
    [ChannelKey.EVENTS]: <CalendarDays className="h-4 w-4" />,
    [ChannelKey.TACTICS]: <Map className="h-4 w-4" />,
    [ChannelKey.CHAT]: <MessageCircle className="h-4 w-4" />,
}

function getChannelIcon(key: string) {
    return CHANNEL_ICONS[key] ?? <Hash className="h-4 w-4" />
}

// ─── Skeleton ──────────────────────────────────────────────────
function ChannelListSkeleton() {
    return (
        <div className="space-y-1 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2.5">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-20 rounded" />
                </div>
            ))}
        </div>
    )
}

// ─── Empty State ───────────────────────────────────────────────
function ChannelListEmpty() {
    return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageCircle className="h-8 w-8 text-white/20 mb-2" />
            <p className="text-sm text-white/40">暂无频道</p>
        </div>
    )
}

// ─── Main Component ────────────────────────────────────────────
interface ChannelListProps {
    channels: ClubChannel[] | null // null = loading
    activeChannelId: string | null
    onSelectChannel: (channel: ClubChannel) => void
}

export function ChannelList({ channels, activeChannelId, onSelectChannel }: ChannelListProps) {
    if (channels === null) {
        return <ChannelListSkeleton />
    }

    if (channels.length === 0) {
        return <ChannelListEmpty />
    }

    return (
        <nav className="space-y-0.5 p-2" role="navigation" aria-label="频道列表">
            {channels.map((channel) => {
                const isActive = channel.id === activeChannelId
                return (
                    <button
                        key={channel.id}
                        id={`channel-${channel.id}`}
                        onClick={() => onSelectChannel(channel)}
                        className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                            'hover:bg-white/5',
                            isActive
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-white/60 hover:text-white/80'
                        )}
                    >
                        <span className={cn('flex-shrink-0', isActive ? 'text-yellow-400' : 'text-white/40')}>
                            {getChannelIcon(channel.key)}
                        </span>
                        <span className="truncate">{channel.name}</span>
                    </button>
                )
            })}
        </nav>
    )
}
