"use client";

import React from 'react';
import { useMap } from '@/components/map/AMapContext';
import { User, Shield } from 'lucide-react';

/**
 * KingdomModeSwitch: Vertical capsule slider to toggle between Personal / Club kingdom views.
 * 
 * Only visible when showKingdom is true.
 * - Top position (personal): User icon, gold accent
 * - Bottom position (club): Shield icon, purple accent
 */
export function KingdomModeSwitch() {
    const { showKingdom, kingdomMode, setKingdomMode } = useMap();

    if (!showKingdom) return null;

    const isPersonal = kingdomMode === 'personal';

    const toggle = () => {
        setKingdomMode?.(isPersonal ? 'club' : 'personal');
    };

    return (
        <button
            onClick={toggle}
            className="relative h-[72px] w-10 rounded-full bg-slate-800/90 backdrop-blur-sm shadow-lg border border-white/10 flex flex-col items-center justify-between p-1 transition-all active:scale-95"
            title={isPersonal ? "切换到俱乐部领地" : "切换到个人领地"}
        >
            {/* Top icon: Personal */}
            <div className={`flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 ${isPersonal ? 'bg-amber-500/60 text-white scale-110' : 'text-white/30 scale-90'
                }`}>
                <User className="h-4 w-4" />
            </div>

            {/* Bottom icon: Club */}
            <div className={`flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 ${!isPersonal ? 'bg-purple-500/60 text-white scale-110' : 'text-white/30 scale-90'
                }`}>
                <Shield className="h-4 w-4" />
            </div>

            {/* Sliding indicator */}
            <div
                className={`absolute left-1 w-8 h-8 rounded-full border-2 border-white/40 transition-all duration-300 pointer-events-none ${isPersonal
                        ? 'top-1 bg-amber-500/30'
                        : 'bottom-1 bg-purple-500/30'
                    }`}
            />
        </button>
    );
}
