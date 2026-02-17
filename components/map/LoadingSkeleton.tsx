"use client";

import { Loader2 } from 'lucide-react';

/**
 * LoadingSkeleton: Full-screen loading overlay
 * 
 * Hides the map completely until the first 'locked' GPS coordinate arrives.
 * Prevents user from seeing uninitialized map or "jumping" to location.
 */
export function LoadingSkeleton() {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-background via-background/95 to-background/90 backdrop-blur-md z-[100]">
            {/* Animated GPS Icon */}
            <div className="relative mb-6">
                {/* Outer pulse ring */}
                <div className="absolute inset-0 w-24 h-24 rounded-full bg-primary/20 animate-ping" />
                {/* Middle ring */}
                <div className="absolute inset-2 w-20 h-20 rounded-full bg-primary/30 animate-pulse" />
                {/* Inner icon */}
                <div className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
            </div>

            {/* Loading text */}
            <div className="flex flex-col items-center gap-3">
                <h3 className="text-xl font-semibold text-foreground">正在定位...</h3>
                <p className="text-sm text-muted-foreground max-w-xs text-center px-4">
                    获取精确GPS坐标中，请稍候
                </p>

                {/* Loading dots animation */}
                <div className="flex gap-1.5 mt-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                </div>
            </div>

            {/* Tips (optional) */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-xs text-muted-foreground/70 px-6">
                    提示: 请确保GPS已开启并允许位置权限
                </p>
            </div>
        </div>
    );
}
