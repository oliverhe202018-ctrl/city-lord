"use client";

import { Loader2, Check } from 'lucide-react';
import { LocationStatus } from '@/hooks/useSafeGeolocation';
import { useEffect, useState } from 'react';

export function LocationIndicator({ status }: { status: LocationStatus }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (status === 'locked') {
            const timer = setTimeout(() => {
                setVisible(false);
            }, 2000);
            return () => clearTimeout(timer);
        } else {
            setVisible(true);
        }
    }, [status]);

    if (!visible) return null;

    return (
        <div className="absolute top-4 left-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
            <div className="bg-background/80 backdrop-blur-md border border-border/50 rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
                {status === 'initializing' || status === 'locating' ? (
                    <>
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        <span className="text-sm font-medium">📡 定位中...</span>
                    </>
                ) : status === 'locked' ? (
                    <>
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-green-600">已定位</span>
                    </>
                ) : status === 'error' ? (
                    <span className="text-sm font-medium text-red-500">定位失败</span>
                ) : null}
            </div>
        </div>
    );
}
