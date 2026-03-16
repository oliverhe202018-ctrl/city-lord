'use client';

import { MapPin, Wifi, WifiOff, Bell } from 'lucide-react';
import { useLocationStatus } from '@/hooks/useLocationStatus';

interface HomeTopBarProps {
    notificationCount?: number;
    onNotificationClick?: () => void;
}

export function HomeTopBar({ notificationCount = 0, onNotificationClick }: HomeTopBarProps) {
    const { status, cityLabel } = useLocationStatus();

    return (
        <div className="flex items-center justify-between px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] bg-white/5 backdrop-blur-md border-b border-white/5">
            {/* Left: City/Area */}
            <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span className="text-xs font-semibold text-white/90 truncate max-w-[180px] drop-shadow-sm">
                    {cityLabel}
                </span>
            </div>

            {/* Center: Status indicator */}
            <div className="flex items-center gap-1.5">
                {status === 'ready' ? (
                    <Wifi className="h-3 w-3 text-emerald-400" />
                ) : (
                    <WifiOff className="h-3 w-3 text-amber-400" />
                )}
                <span className={`text-[10px] font-medium ${status === 'ready'
                    ? 'text-emerald-400'
                    : status === 'stale'
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}>
                    {status === 'ready' ? '在线' : status === 'stale' ? '信号弱' : '定位失败'}
                </span>
            </div>

            {/* Right: Notifications */}
            <button
                onClick={onNotificationClick}
                className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-all hover:bg-white/10 active:scale-90"
            >
                <Bell className="h-4 w-4 text-foreground/60" />
                {notificationCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-lg">
                        {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                )}
            </button>
        </div>
    );
}
