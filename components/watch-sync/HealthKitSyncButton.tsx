'use client';

/**
 * HealthKitSyncButton
 *
 * iOS-only button that triggers the useHealthKit hook's init + sync flow.
 * Rendered inside WatchSyncPanel's "自动同步" tab.
 * On non-iOS platforms this component is never mounted
 * (WatchSyncPanel shows an Android notice instead).
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Heart,
    RefreshCw,
    ShieldCheck,
    Loader2,
} from 'lucide-react';
import { useHealthKit } from '@/hooks/useHealthKit';

export default function HealthKitSyncButton() {
    const { isLoading, isPermissionGranted, lastResult, init, sync } = useHealthKit();
    const [isInitializing, setIsInitializing] = useState(false);

    const handleInit = async () => {
        setIsInitializing(true);
        const granted = await init();
        setIsInitializing(false);
        if (granted) {
            toast.success('HealthKit 授权成功，正在同步...');
            await sync();
        }
    };

    const handleSync = () => sync();

    return (
        <div className="space-y-4">
            {/* Permission status badge */}
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">权限状态：</span>
                {isPermissionGranted === null && (
                    <Badge variant="outline" className="text-xs">未授权</Badge>
                )}
                {isPermissionGranted === true && (
                    <Badge variant="default" className="bg-green-500/80 text-xs">已授权</Badge>
                )}
                {isPermissionGranted === false && (
                    <Badge variant="destructive" className="text-xs">拒绝</Badge>
                )}
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-3">
                {isPermissionGranted !== true && (
                    <Button
                        onClick={handleInit}
                        disabled={isInitializing || isLoading}
                        variant="outline"
                        className="gap-2"
                    >
                        {isInitializing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Heart className="h-4 w-4 text-red-400" />
                        )}
                        授权健康数据
                    </Button>
                )}

                <Button
                    onClick={handleSync}
                    disabled={isLoading}
                    className="gap-2"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                    {isPermissionGranted === true ? '立即同步' : '授权并同步'}
                </Button>
            </div>

            {/* Last sync result hint */}
            {lastResult?.success && (
                <p className="text-xs text-muted-foreground">
                    ✓ 上次同步成功
                    {lastResult.territoryCreated
                        ? `，生成领地 ${Math.round(lastResult.territoryArea ?? 0)} m²`
                        : '，未生成领地（轨迹未闭合）'}
                </p>
            )}
        </div>
    );
}
