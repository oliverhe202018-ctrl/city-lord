'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Apple,
    Smartphone,
    HelpCircle,
    ChevronRight,
    MapPin,
    AlertTriangle,
    ExternalLink,
    Settings,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Step helper
// ─────────────────────────────────────────────────────────────────────────────

function Step({ num, children }: { num: number; children: React.ReactNode }) {
    return (
        <div className="flex gap-3 text-sm leading-relaxed">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                {num}
            </span>
            <span className="text-muted-foreground">{children}</span>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform Button — tries deep link first, falls back to store/web URL
// ─────────────────────────────────────────────────────────────────────────────

interface PlatformButtonProps {
    label: string;
    deepLink: string;    // e.g. "garminconnect://"
    fallbackUrl: string; // e.g. App Store / Play Store / web page
    icon?: React.ReactNode;
}

function PlatformButton({ label, deepLink, fallbackUrl, icon }: PlatformButtonProps) {
    const handleClick = () => {
        // Try to open the native app via deep link.
        // If the app is not installed the browser won't navigate away, so
        // after 1.5 s we open the store/web fallback in a new tab.
        let opened = false;

        const timer = setTimeout(() => {
            if (!opened) {
                window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
            }
        }, 1500);

        const onBlur = () => {
            opened = true; // App opened — browser lost focus
            clearTimeout(timer);
            window.removeEventListener('blur', onBlur);
        };
        window.addEventListener('blur', onBlur);

        window.location.href = deepLink;
    };

    return (
        <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 gap-1.5 rounded-md px-3 text-xs"
            onClick={handleClick}
        >
            {icon}
            {label}
            <ExternalLink className="h-3 w-3 opacity-60" />
        </Button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SyncGuide() {
    return (
        <div className="rounded-xl border border-border/40 bg-muted/20 backdrop-blur-sm">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">使用指引</span>
            </div>

            <Accordion type="multiple" className="px-1">
                {/* ── iOS ── */}
                <AccordionItem value="ios" className="border-border/30">
                    <AccordionTrigger className="px-3 py-3 text-sm hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Apple className="h-4 w-4 text-blue-400" />
                            <span>iOS 用户（Apple Watch / iPhone）</span>
                            <Badge variant="secondary" className="ml-1 py-0 text-[10px]">自动同步</Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-4">
                        <div className="space-y-3">
                            <Step num={1}>
                                打开 <strong>iPhone 设置</strong> →{' '}
                                <strong>隐私与安全性</strong> →{' '}
                                <strong>健康</strong> → 找到本 App，
                                开启<em>跑步与步行</em>和<em>心率</em>的读取权限。
                            </Step>

                            {/* iOS Settings shortcut */}
                            <div className="pl-8 flex flex-wrap gap-2">
                                <PlatformButton
                                    label="打开 iPhone 设置"
                                    deepLink="App-Prefs:Privacy"
                                    fallbackUrl="https://support.apple.com/zh-cn/111786"
                                    icon={<Settings className="h-3 w-3" />}
                                />
                                <PlatformButton
                                    label="打开「健康」App"
                                    deepLink="x-apple-health://"
                                    fallbackUrl="https://www.apple.com/ios/health/"
                                    icon={<Apple className="h-3 w-3" />}
                                />
                            </div>

                            <Step num={2}>
                                回到 App，点击顶部「自动同步」标签页，
                                再点击<strong>授权并同步</strong>按钮。
                            </Step>
                            <Step num={3}>
                                之后每次跑完步回到 App 前台，
                                系统会<strong>自动静默同步</strong>最近的跑步记录。
                            </Step>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* ── Android / GPS Watches ── */}
                <AccordionItem value="android" className="border-border/30">
                    <AccordionTrigger className="px-3 py-3 text-sm hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-green-400" />
                            <span>Android / 佳明 / 高驰 / 华为用户</span>
                            <Badge variant="outline" className="ml-1 py-0 text-[10px]">GPX 导出</Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-4">
                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">选择适合你设备的 App：</p>

                            {/* Garmin */}
                            <div className="rounded-lg bg-muted/30 p-3 text-xs">
                                <p className="mb-2 font-medium text-foreground">佳明 Garmin Connect</p>
                                <div className="space-y-1.5 text-muted-foreground">
                                    <div className="flex items-start gap-1.5">
                                        <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                                        <span>打开活动详情 → 右上角 <strong>⋯</strong> → <strong>导出为 GPX</strong></span>
                                    </div>
                                </div>
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                    <PlatformButton
                                        label="打开 Garmin Connect"
                                        deepLink="garminconnect://activities"
                                        fallbackUrl="https://connect.garmin.com/modern/activities"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 gap-1.5 rounded-md px-3 text-xs"
                                        onClick={() => window.open(
                                            'https://connect.garmin.com/modern/activities',
                                            '_blank', 'noopener,noreferrer'
                                        )}
                                    >
                                        网页版入口
                                        <ExternalLink className="h-3 w-3 opacity-60" />
                                    </Button>
                                </div>
                            </div>

                            {/* COROS */}
                            <div className="rounded-lg bg-muted/30 p-3 text-xs">
                                <p className="mb-2 font-medium text-foreground">高驰 COROS</p>
                                <div className="space-y-1.5 text-muted-foreground">
                                    <div className="flex items-start gap-1.5">
                                        <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                                        <span>活动详情 → <strong>分享</strong> → <strong>导出 GPX 文件</strong></span>
                                    </div>
                                </div>
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                    <PlatformButton
                                        label="打开 COROS App"
                                        deepLink="coros://training/activity"
                                        fallbackUrl="https://training.coros.com"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 gap-1.5 rounded-md px-3 text-xs"
                                        onClick={() => window.open(
                                            'https://training.coros.com',
                                            '_blank', 'noopener,noreferrer'
                                        )}
                                    >
                                        网页版入口
                                        <ExternalLink className="h-3 w-3 opacity-60" />
                                    </Button>
                                </div>
                            </div>

                            {/* Huawei */}
                            <div className="rounded-lg bg-muted/30 p-3 text-xs">
                                <p className="mb-2 font-medium text-foreground">华为运动健康</p>
                                <div className="space-y-1.5 text-muted-foreground">
                                    <div className="flex items-start gap-1.5">
                                        <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                                        <span>运动记录详情 → 右下角<strong>分享</strong> → <strong>分享路线(GPX)</strong></span>
                                    </div>
                                </div>
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                    <PlatformButton
                                        label="打开华为运动健康"
                                        deepLink="hwhealth://sport/activityrecord"
                                        fallbackUrl="https://appgallery.huawei.com/app/C10256337"
                                    />
                                </div>
                            </div>

                            <Step num={1}>导出 GPX 文件后，将文件传输到本设备（微信发给自己、AirDrop、邮件等）。</Step>
                            <Step num={2}>切换到「<strong>文件导入</strong>」标签页，点击<strong>选择 GPX 文件</strong>上传。</Step>
                            <Step num={3}>系统自动解析轨迹，点击<strong>上传 &amp; 同步</strong>完成数据提交。</Step>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* ── FAQ ── */}
                <AccordionItem value="faq" className="border-none">
                    <AccordionTrigger className="px-3 py-3 text-sm hover:no-underline">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-yellow-400" />
                            <span>常见问题</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-4">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <div className="flex items-start gap-1.5 text-sm font-medium text-foreground">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
                                    <span>为什么同步成功了，但没有生成领地？</span>
                                </div>
                                <p className="pl-5 text-xs text-muted-foreground leading-relaxed">
                                    领地生成需要满足两个条件：<br />
                                    ① <strong>轨迹必须闭合</strong>——终点与起点距离小于 20 米；<br />
                                    ② <strong>围合面积 ≥ 100 平方米</strong>（约 10m × 10m）。<br />
                                    如果你的跑步路线是往返型（非环形），系统只会保存数据，不会生成领地。
                                    建议下次尝试跑一段封闭的环形路线。
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-start gap-1.5 text-sm font-medium text-foreground">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
                                    <span>GPX 文件是什么？在哪里找？</span>
                                </div>
                                <p className="pl-5 text-xs text-muted-foreground leading-relaxed">
                                    GPX 是一种通用的 GPS 数据格式，几乎所有运动 App 和 GPS 手表都支持导出。
                                    文件名通常以 <code className="rounded bg-muted px-1">.gpx</code> 结尾。
                                    如果你的 App 没有直接的 GPX 导出选项，可以试试导出到 Strava，
                                    再从 Strava 下载 GPX。
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-start gap-1.5 text-sm font-medium text-foreground">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
                                    <span>Android 为什么没有自动同步功能？</span>
                                </div>
                                <p className="pl-5 text-xs text-muted-foreground leading-relaxed">
                                    Android 的健康数据平台（Health Connect）目前版本不支持获取完整的 GPS 轨迹数据，
                                    因此无法自动生成领地。我们正在持续关注 Health Connect API 的更新。
                                    目前推荐使用 <strong>GPX 文件导入</strong>作为替代方案。
                                </p>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
