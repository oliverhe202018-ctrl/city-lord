"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// Loading Component
const MapLoading = () => (
  <div className="flex h-screen w-full flex-col bg-slate-950">
    {/* Top Bar */}
    <div className="p-4 w-full">
        <Skeleton className="h-12 w-full rounded-xl bg-slate-800" />
    </div>
    
    {/* Map Area */}
    <div className="flex-1 w-full relative">
        <Skeleton className="absolute inset-0 bg-slate-900" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400">
             <Spinner className="h-12 w-12 text-primary" />
             <p className="text-sm font-medium animate-pulse">正在初始化地图引擎...</p>
        </div>
    </div>
    
    {/* Bottom Bar */}
    <div className="p-4 w-full">
        <Skeleton className="h-24 w-full rounded-xl bg-slate-800" />
    </div>
  </div>
);

// Error Component (Simple inline version for dynamic import fallback)
const MapLoadError = () => (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-slate-200 gap-6 p-6">
        <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <div className="text-center space-y-2">
            <h2 className="text-xl font-bold">地图组件加载失败</h2>
            <p className="text-slate-400 max-w-xs">可能是由于网络连接问题导致资源无法下载。</p>
        </div>
        <Button 
            onClick={() => window.location.reload()}
            variant="secondary"
            className="px-8"
        >
            刷新重试
        </Button>
    </div>
);

const PlannerClientView = dynamic(
  () => import('@/components/citylord/map/PlannerClientView').catch((err) => {
    console.error("Map dynamic import failed:", err);
    // Return a functional component that renders the error UI
    return function ErrorFallback() {
        return <MapLoadError />;
    };
  }),
  {
    ssr: false,
    loading: () => <MapLoading />
  }
);

export default function RoutePlannerPage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950">
        <Suspense fallback={<MapLoading />}>
            <PlannerClientView />
        </Suspense>
    </div>
  );
}
