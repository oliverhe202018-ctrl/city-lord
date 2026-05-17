"use client";

import React from 'react';
import { useMap } from '@/components/map/AMapContext';
import { useMapInteraction } from '@/components/map/MapInteractionContext';
import { useMapDisplayStore } from '@/store/useMapDisplayStore';
import { Button } from '@/components/ui/button';
import {
    LocateFixedIcon, Plus, Minus, Loader2,
    Layers, User, Shield, Swords
} from 'lucide-react';

export const MapControls = () => {
    const {
        map,
        centerMap,
        locationStatus,
        currentLocation,
        isTracking,
    } = useMap();

    const {
        showKingdom,
        toggleKingdom,
    } = useMapInteraction();

    const {
        mapDisplayMode,
        toggleFactionMode,
        toggleClubMode,
    } = useMapDisplayStore();

    const isLocating = (locationStatus === 'locating' || locationStatus === 'initializing') && !currentLocation;

    const handleLocate = () => {
        centerMap();
    };

    const handleZoomIn = () => {
        map?.zoomIn();
    };

    const handleZoomOut = () => {
        map?.zoomOut();
    };

    const isPersonal = mapDisplayMode === 'personal';
    const isFaction = mapDisplayMode === 'faction';
    const isClub = mapDisplayMode === 'club';

    const controlBtnClass =
        "h-10 w-10 rounded-full shadow-md transition-all border " +
        "bg-white/90 text-zinc-800 border-zinc-200/60 hover:bg-white " +
        "dark:bg-zinc-800/90 dark:text-white dark:border-white/10 dark:hover:bg-zinc-700";

    return (
        <div className="absolute bottom-60 right-4 z-[100] flex flex-col gap-3 items-center pointer-events-auto">
            {showKingdom && (
                <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleFactionMode}
                    disabled={isClub}
                    className={`h-9 w-9 rounded-full shadow-md transition-all border ${
                        isFaction
                            ? 'bg-blue-500/70 text-white hover:bg-blue-500/85 border-blue-300/50'
                            : isClub
                                ? 'bg-white/40 text-zinc-400 border-zinc-300/30 cursor-not-allowed'
                                : 'bg-white/85 text-zinc-500 hover:bg-white border-zinc-200/50 dark:bg-zinc-800/85 dark:text-white/60 dark:border-white/10 dark:hover:bg-zinc-700'
                    }`}
                    title={isClub ? "俱乐部模式下不可用" : isFaction ? "关闭阵营模式" : "开启阵营模式"}
                >
                    <Swords className="h-4 w-4" />
                    <span className="sr-only">阵营模式</span>
                </Button>
            )}

            {showKingdom && (
                <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleClubMode}
                    className={`h-12 w-12 rounded-full shadow-lg transition-all border ${
                        isClub
                            ? 'bg-purple-500/60 text-white hover:bg-purple-500/80 border-purple-400/30'
                            : 'bg-amber-500/60 text-white hover:bg-amber-500/80 border-amber-400/30'
                    }`}
                    title={isClub ? "切换到个人领地" : "切换到俱乐部领地"}
                >
                    {isClub ? <Shield className="h-6 w-6" /> : <User className="h-6 w-6" />}
                    <span className="sr-only">俱乐部模式</span>
                </Button>
            )}

            <Button
                variant="outline"
                size="icon"
                onClick={toggleKingdom}
                className={`h-12 w-12 rounded-full shadow-lg transition-all border ${
                    showKingdom
                        ? 'bg-amber-500/50 text-white hover:bg-amber-500/70 border-white/20'
                        : 'bg-white/90 text-zinc-500 hover:bg-white border-zinc-200/60 dark:bg-zinc-800/90 dark:text-white/50 dark:border-white/10 dark:hover:bg-zinc-700'
                }`}
                title={showKingdom ? "隐藏领地" : "显示领地"}
            >
                <Layers className="h-6 w-6" />
                <span className="sr-only">图层控制</span>
            </Button>

            <Button
                variant="outline"
                size="icon"
                onClick={handleLocate}
                disabled={isLocating}
                className={`h-12 w-12 rounded-full shadow-lg transition-all border ${
                    isTracking
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
