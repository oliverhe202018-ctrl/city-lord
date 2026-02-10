"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// 关键：强制禁用 SSR，确保构建时完全跳过此组件的预渲染
const PlannerClientView = dynamic(
  () => import('@/components/citylord/map/PlannerClientView'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white">
        Loading Planner...
      </div>
    )
  }
);

export default function PlannerPage() {
  return (
    <Suspense fallback={null}>
      <PlannerClientView />
    </Suspense>
  );
}
