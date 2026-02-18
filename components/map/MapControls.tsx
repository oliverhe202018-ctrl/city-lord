"use client";

import React from 'react';
import { useMap } from '@/components/map/AMapContext';
import { Button } from '@/components/ui/button';
import {
    LocateFixedIcon, Plus, Minus, Loader2,
    Layers, Cloud, CloudOff, User, Shield
} from 'lucide-react';

export const MapControls = () => {
    const {
        map,
        centerMap,
        locationStatus,
        isTracking,
        showKingdom,
        toggleKingdom,
        showFog,
        toggleFog,
        kingdomMode,
        setKingdomMode,
    } = useMap();

    const isLocating = locationStatus === 'locating' || locationStatus === 'initializing';

    const handleLocate = () => {
        centerMap();
    };

    const handleZoomIn = () => {
        map?.zoomIn();
    };

    const handleZoomOut = () => {
        map?.zoomOut();
    };

    const isPersonal = kingdomMode === 'personal';

    const handleToggleMode = () => {
        setKingdomMode?.(isPersonal ? 'club' : 'personal');
    };

    // High-contrast button style that works on ALL map themes
    const controlBtnClass =
        "h-10 w-10 rounded-full shadow-md transition-all border " +
        "bg-white/90 text-zinc-800 border-zinc-200/60 hover:bg-white " +
        "dark:bg-zinc-800/90 dark:text-white dark:border-white/10 dark:hover:bg-zinc-700";

    return (
        <div className="absolute bottom-60 right-4 z-10 flex flex-col gap-3 items-center pointer-events-auto">
            {/* Fog (Mask) Toggle */}
            <Button
                variant="outline"
                size="icon"
                onClick={toggleFog}
                className={`h-12 w-12 rounded-full shadow-lg transition-all border ${showFog
                        ? 'bg-slate-700/80 text-white hover:bg-slate-600 border-white/20'
                        : 'bg-white/90 text-zinc-500 hover:bg-white border-zinc-200/60 dark:bg-zinc-800/90 dark:text-white/50 dark:border-white/10 dark:hover:bg-zinc-700'
                    }`}
                title={showFog ? "关闭迷雾" : "开启迷雾"}
            >
                {showFog ? <Cloud className="h-6 w-6" /> : <CloudOff className="h-6 w-6" />}
                <span className="sr-only">迷雾控制</span>
            </Button>

            {/* Kingdom Mode Switch — inline, only when fog ON + kingdom visible */}
            {showFog && showKingdom && (
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleToggleMode}
                    className={`h-12 w-12 rounded-full shadow-lg transition-all border ${isPersonal
                            ? 'bg-amber-500/60 text-white hover:bg-amber-500/80 border-amber-400/30'
                            : 'bg-purple-500/60 text-white hover:bg-purple-500/80 border-purple-400/30'
                        }`}
                    title={isPersonal ? "切换到俱乐部领地" : "切换到个人领地"}
                >
                    {isPersonal ? <User className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
                    <span className="sr-only">阵营切换</span>
                </Button>
            )}

            {/* Kingdom Layer Toggle */}
            <Button
                variant="outline"
                size="icon"
                onClick={toggleKingdom}
                className={`h-12 w-12 rounded-full shadow-lg transition-all border ${showKingdom
                        ? 'bg-amber-500/50 text-white hover:bg-amber-500/70 border-white/20'
                        : 'bg-white/90 text-zinc-500 hover:bg-white border-zinc-200/60 dark:bg-zinc-800/90 dark:text-white/50 dark:border-white/10 dark:hover:bg-zinc-700'
                    }`}
                title={showKingdom ? "隐藏领地" : "显示领地"}
            >
                <Layers className="h-6 w-6" />
                <span className="sr-only">图层控制</span>
            </Button>

            {/* Location Button with Tracking Indicator */}
            <Button
                variant="outline"
                size="icon"
                onClick={handleLocate}
                disabled={isLocating}
                className={`h-12 w-12 rounded-full shadow-lg transition-all border ${isTracking
                    ? 'bg-primary/70 hover:bg-primary/90 border-primary text-white'
                    : 'bg-white/90 hover:bg-white border-zinc-200/60 text-zinc-800 dark:bg-zinc-800/90 dark:hover:bg-zinc-700 dark:border-white/10 dark:text-white'
                    }`}
                title={isTracking ? "跟随模式 (已开启)" : "点击回到当前位置"}
            >
                {isLocating ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                    <LocateFixedIcon className={`h-6 w-6 ${isTracking ? 'text-white' : ''}`} />
                )}
                <span className="sr-only">回到定位</span>
            </Button>

            {/* Zoom Controls — High contrast on all themes */}
            <div className="flex flex-col gap-2 items-center">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleZoomIn}
                    className={controlBtnClass}
                >
                    <Plus className="h-5 w-5" />
                    <span className="sr-only">放大</span>
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleZoomOut}
                    className={controlBtnClass}
                >
                    <Minus className="h-5 w-5" />
                    <span className="sr-only">缩小</span>
                </Button>
            </div>
        </div>
    );
};
