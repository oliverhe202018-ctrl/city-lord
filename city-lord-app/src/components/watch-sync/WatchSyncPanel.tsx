'use client';

import { useState, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { syncWatchRunData } from '@/app/actions/watch-sync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, Watch, Play, FileJson, FileText, AlertTriangle, CheckCircle2, Loader2, Code2, RefreshCw,  } from 'lucide-react';
import { Suspense, lazy } from 'react';
const dynamic = (importFunc, options = {}) => {
  const LazyComponent = lazy(() => importFunc().then((mod) => {
    if (!mod) return { default: undefined };
    if (typeof mod === 'function' || (typeof mod === 'object' && (mod.$typeof || mod.render))) {
      return { default: mod };
    }
    return { default: mod.default || Object.values(mod)[0] };
  }));
  return (props) => (
    <Suspense fallback={options.loading ? options.loading() : null}>
      <LazyComponent {...props} />
    </Suspense>
  );
};
import type { WatchSyncPayload, WatchSyncResult } from '@/types/watch-sync';

// ─── Dynamic imports (SSR-incompatible) ───────────────────────────────────────

const TrajectoryPreview = dynamic(
    () => import('./TrajectoryPreview'),
    {
        ssr: false,
        loading: () => (
            <div className="h-64 animate-pulse rounded-lg bg-muted/30 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">加载地图组件...</p>
            </div>
        ),
    }
);

const HealthKitSyncButton = dynamic(
    () => import('./HealthKitSyncButton'),
    { ssr: false }
);

const SyncGuide = dynamic(
    () => import('./SyncGuide'),
    { ssr: false }
);

// ─── Demo data generator ──────────────────────────────────────────────────────

function generateDemoData(): WatchSyncPayload {
    const centerLat = 39.9042;
    const centerLng = 116.4074;
    const offsetLat = 0.002;
    const offsetLng = 0.003;
    const now = Date.now();
    const stepMs = 5000;

    const corners = [
        { lat: centerLat + offsetLat, lng: centerLng - offsetLng },
        { lat: centerLat + offsetLat, lng: centerLng + offsetLng },
        { lat: centerLat - offsetLat, lng: centerLng + offsetLng },
        { lat: centerLat - offsetLat, lng: centerLng - offsetLng },
    ];

    const points: WatchSyncPayload['points'] = [];
    let t = now - 600000;

    for (let edge = 0; edge < 4; edge++) {
        const from = corners[edge];
        const to = corners[(edge + 1) % 4];
        for (let i = 0; i < 5; i++) {
            const ratio = i / 5;
            points.push({
                lat: from.lat + (to.lat - from.lat) * ratio,
                lng: from.lng + (to.lng - from.lng) * ratio,
                timestamp: t,
                heartRate: 120 + Math.floor(Math.random() * 40),
                pace: 5 + Math.random() * 2,
            });
            t += stepMs;
        }
    }

    points.push({ ...points[0], timestamp: t });

    return {
        points,
        summary: {
            totalDistance: 1800,
            totalSteps: 2340,
            startTime: new Date(points[0].timestamp).toISOString(),
            endTime: new Date(points[points.length - 1].timestamp).toISOString(),
        },
    };
}

// ─── Shared result display ────────────────────────────────────────────────────

function SyncResultCard({ result }: { result: WatchSyncResult }) {
    const isSuccess = result.success;
    const hasTerritory = isSuccess && result.territoryCreated;
    const colorClass = hasTerritory
        ? 'border-green-500/50 bg-green-500/5'
        : isSuccess
            ? 'border-yellow-500/50 bg-yellow-500/5'
            : 'border-red-500/50 bg-red-500/5';

    return (
        <Card className={`border-border/50 ${colorClass}`}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    {hasTerritory ? (
                        <><CheckCircle2 className="h-5 w-5 text-green-500" />领地生成成功</>
                    ) : isSuccess ? (
                        <><AlertTriangle className="h-5 w-5 text-yellow-500" />数据已保存</>
                    ) : (
                        <><AlertTriangle className="h-5 w-5 text-red-500" />处理失败</>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {result.activityId && (
                    <div className="text-sm text-muted-foreground">
                        活动 ID: <code className="text-foreground">{result.activityId.slice(0, 8)}...</code>
                    </div>
                )}
                {result.runId && (
                    <div className="text-sm text-muted-foreground">
                        跑步记录: <code className="text-foreground">{result.runId.slice(0, 8)}...</code>
                    </div>
                )}
                {result.territoryArea !== undefined && result.territoryArea > 0 && (
                    <div className="text-sm font-medium text-green-600">
                        🏰 领地面积: {Math.round(result.territoryArea)} m²
                    </div>
                )}
                {result.error && (
                    <div className="text-sm text-red-500">{result.error}</div>
                )}
                {result.warnings && result.warnings.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-yellow-600">⚠️ 警告:</p>
                        {result.warnings.map((w, i) => (
                            <p key={`warning-${i}`} className="text-xs text-yellow-600/80">• {w}</p>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WatchSyncPanel() {
    const [isPending, startTransition] = useTransition();
    const [syncResult, setSyncResult] = useState<WatchSyncResult | null>(null);
    const [uploadedPayload, setUploadedPayload] = useState<WatchSyncPayload | null>(null);
    const [progress, setProgress] = useState(0);

    // Tab: Developer (JSON)
    const [jsonInput, setJsonInput] = useState('');
    const jsonFileRef = useRef<HTMLInputElement>(null);

    // Tab: File Import (GPX)
    const [gpxFile, setGpxFile] = useState<File | null>(null);
    const [gpxPayload, setGpxPayload] = useState<WatchSyncPayload | null>(null);
    const [isParsingGpx, setIsParsingGpx] = useState(false);
    const gpxFileRef = useRef<HTMLInputElement>(null);

    const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
    const isIos = platform === 'ios';

    // ── Shared submit helper ─────────────────────────────────────────────────

    function runSync(payload: unknown, label: string) {
        setSyncResult(null);
        setProgress(10);

        startTransition(async () => {
            setProgress(30);
            try {
                const result = await syncWatchRunData(payload);
                setProgress(90);
                setSyncResult(result);

                if (result.success && result.territoryCreated) {
                    setUploadedPayload(payload as WatchSyncPayload);
                    toast.success(`🎉 领地已生成，面积 ${Math.round(result.territoryArea || 0)} m²`, {
                        description: `活动 ID: ${result.activityId?.slice(0, 8)}...`,
                        duration: 5000,
                    });
                } else if (result.success) {
                    setUploadedPayload(payload as WatchSyncPayload);
                    toast.warning('数据已保存，但未生成领地', {
                        description: result.error || '轨迹未闭合或面积不足',
                        duration: 5000,
                    });
                } else {
                    toast.error(`${label}同步失败`, { description: result.error, duration: 5000 });
                }

                result.warnings?.forEach(w => toast.warning(w, { duration: 4000 }));
            } catch (e) {
                toast.error('网络错误', {
                    description: e instanceof Error ? e.message : '请检查网络连接',
                });
            } finally {
                setProgress(100);
                setTimeout(() => setProgress(0), 1000);
            }
        });
    }

    // ── GPX file selection & parsing ─────────────────────────────────────────

    const handleGpxSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.gpx')) {
            toast.error('请选择 .gpx 格式文件');
            return;
        }

        setGpxFile(file);
        setGpxPayload(null);
        setSyncResult(null);
        setIsParsingGpx(true);

        try {
            // Dynamic import keeps togeojson out of the main bundle
            const { parseGpxFile } = await import('@/lib/client/gpx-parser');
            const parsed = await parseGpxFile(file);
            setGpxPayload(parsed);
            toast.success(
                `GPX 解析成功：${parsed.points.length} 个轨迹点，总距离 ${(parsed.summary.totalDistance / 1000).toFixed(2)} km`
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'GPX 解析失败';
            toast.error(msg);
            setGpxFile(null);
        } finally {
            setIsParsingGpx(false);
            // Reset so same file can be re-selected
            e.target.value = '';
        }
    };

    const handleGpxSync = () => {
        if (!gpxPayload) return;
        runSync(gpxPayload, 'GPX ');
    };

    // ── JSON (developer) handlers ────────────────────────────────────────────

    const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.json')) {
            toast.error('仅支持 .json 格式文件');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            setJsonInput(event.target?.result as string);
            toast.success(`已加载文件: ${file.name}`);
        };
        reader.onerror = () => toast.error('文件读取失败');
        reader.readAsText(file);
    };

    const handleGenerateDemo = () => {
        setJsonInput(JSON.stringify(generateDemoData(), null, 2));
        toast.success('已生成闭环示例数据');
    };

    const handleJsonSync = () => {
        let payload: unknown;
        try {
            payload = JSON.parse(jsonInput);
        } catch {
            toast.error('JSON 格式解析失败，请检查数据格式');
            return;
        }
        runSync(payload, 'JSON ');
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Watch className="h-5 w-5 text-primary" />
                        运动数据同步
                    </CardTitle>
                    <CardDescription>
                        支持 iOS 自动同步、GPX 文件导入和 JSON 开发者模式
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue={isIos ? 'auto' : 'gpx'}>
                        <TabsList className="grid w-full grid-cols-3 mb-5">
                            <TabsTrigger value="auto" className="gap-1.5 text-xs sm:text-sm">
                                <RefreshCw className="h-3.5 w-3.5" />
                                自动同步
                            </TabsTrigger>
                            <TabsTrigger value="gpx" className="gap-1.5 text-xs sm:text-sm">
                                <FileText className="h-3.5 w-3.5" />
                                文件导入
                            </TabsTrigger>
                            <TabsTrigger value="dev" className="gap-1.5 text-xs sm:text-sm">
                                <Code2 className="h-3.5 w-3.5" />
                                开发者
                            </TabsTrigger>
                        </TabsList>

                        {/* ── Tab 1: Auto Sync ── */}
                        <TabsContent value="auto" className="space-y-4">
                            {isIos ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                        授权后，每次跑步结束并回到 App 时将自动同步最新记录。
                                    </p>
                                    {/* HealthKitSyncButton is dynamically loaded; returns null on non-iOS */}
                                    <HealthKitSyncButton />
                                </div>
                            ) : (
                                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                                        <div className="space-y-1.5">
                                            <p className="text-sm font-medium text-foreground">
                                                Android 暂不支持自动同步
                                            </p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Health Connect 当前版本不提供完整的 GPS 轨迹读取权限，
                                                因此无法自动同步跑步记录并生成领地。<br />
                                                请使用「<strong>文件导入</strong>」标签页，通过 GPX 文件手动上传。
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                若设备未安装健康连接，请先
                                                <a
                                                    href="https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary underline-offset-2 hover:underline ml-1"
                                                >
                                                    安装「健康连接」
                                                </a>。
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* ── Tab 2: GPX File Import ── */}
                        <TabsContent value="gpx" className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                从佳明、高驰、华为等运动 App 导出 GPX 文件后上传。
                            </p>

                            {/* Drop zone / file selector */}
                            <button
                                type="button"
                                onClick={() => gpxFileRef.current?.click()}
                                disabled={isPending || isParsingGpx}
                                className="w-full rounded-xl border-2 border-dashed border-border/50 bg-muted/20
                                           px-4 py-8 text-center transition-colors
                                           hover:border-primary/40 hover:bg-primary/5
                                           disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isParsingGpx ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <span className="text-sm text-muted-foreground">正在解析 GPX 文件...</span>
                                    </div>
                                ) : gpxFile ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <FileText className="h-8 w-8 text-green-500" />
                                        <span className="text-sm font-medium text-foreground">{gpxFile.name}</span>
                                        {gpxPayload && (
                                            <span className="text-xs text-muted-foreground">
                                                {gpxPayload.points.length} 个轨迹点 ·{' '}
                                                {(gpxPayload.summary.totalDistance / 1000).toFixed(2)} km
                                            </span>
                                        )}
                                        <span className="text-xs text-primary mt-1">点击重新选择文件</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <Upload className="h-8 w-8 text-muted-foreground/60" />
                                        <span className="text-sm font-medium text-foreground">选择 GPX 文件</span>
                                        <span className="text-xs text-muted-foreground">
                                            支持来自佳明、高驰、华为、Strava 等导出的 .gpx 文件
                                        </span>
                                    </div>
                                )}
                            </button>

                            <input
                                ref={gpxFileRef}
                                type="file"
                                accept=".gpx"
                                className="hidden"
                                onChange={handleGpxSelect}
                            />

                            {/* Progress */}
                            {isPending && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        正在同步 GPX 数据...
                                    </div>
                                    <Progress value={progress} className="h-2" />
                                </div>
                            )}

                            <Button
                                onClick={handleGpxSync}
                                disabled={isPending || !gpxPayload}
                                className="w-full"
                                size="lg"
                            >
                                {isPending ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />同步中...</>
                                ) : (
                                    <><Upload className="mr-2 h-4 w-4" />上传 &amp; 同步</>
                                )}
                            </Button>
                        </TabsContent>

                        {/* ── Tab 3: Developer (JSON) ── */}
                        <TabsContent value="dev" className="space-y-4">
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => jsonFileRef.current?.click()}
                                    disabled={isPending}
                                >
                                    <Upload className="mr-2 h-4 w-4" />
                                    选择 JSON 文件
                                </Button>
                                <input
                                    ref={jsonFileRef}
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={handleJsonFileUpload}
                                />

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleGenerateDemo}
                                    disabled={isPending}
                                >
                                    <Play className="mr-2 h-4 w-4" />
                                    生成示例数据
                                </Button>
                            </div>

                            <div className="relative">
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder='粘贴 JSON 数据格式：{ "points": [...], "summary": {...} }'
                                    className="h-48 w-full resize-none rounded-lg border border-border/50 bg-muted/30
                                               p-3 font-mono text-xs text-foreground
                                               placeholder:text-muted-foreground/60
                                               focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                    disabled={isPending}
                                />
                                {jsonInput && (
                                    <div className="absolute right-2 top-2">
                                        <FileJson className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                )}
                            </div>

                            {isPending && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        正在处理数据...
                                    </div>
                                    <Progress value={progress} className="h-2" />
                                </div>
                            )}

                            <Button
                                onClick={handleJsonSync}
                                disabled={isPending || !jsonInput.trim()}
                                className="w-full"
                                size="lg"
                            >
                                {isPending ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />同步中...</>
                                ) : (
                                    <><Upload className="mr-2 h-4 w-4" />上传 &amp; 同步</>
                                )}
                            </Button>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* ── Sync Result ── */}
            {syncResult && <SyncResultCard result={syncResult} />}

            {/* ── Trajectory Preview ── */}
            {uploadedPayload && (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">📍 轨迹预览</CardTitle>
                        <CardDescription>
                            {uploadedPayload.points.length} 个轨迹点 ·{' '}
                            总距离 {(uploadedPayload.summary.totalDistance / 1000).toFixed(2)} km ·{' '}
                            {uploadedPayload.summary.totalSteps} 步
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <TrajectoryPreview
                            points={uploadedPayload.points}
                            isTerritoryCreated={syncResult?.territoryCreated ?? false}
                            territoryArea={syncResult?.territoryArea}
                        />
                    </CardContent>
                </Card>
            )}

            {/* ── User Guide ── */}
            <SyncGuide />
        </div>
    );
}


