"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { MyRoutesSheet } from "@/components/citylord/map/MyRoutesSheet";
import { useRouteListStore } from "@/store/useRouteListStore";
import { useGameStore } from "@/store/useGameStore";
import type { PlannerRoute } from "@/types/route-list";

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
  const router = useRouter()
  const isRouteListOpen = useRouteListStore((state) => state.isOpen)
  const closeRouteList = useRouteListStore((state) => state.closeRouteList)
  const setSelectedRoute = useRouteListStore((state) => state.setSelectedRoute)
  const setGhostPath = useGameStore((state) => state.setGhostPath)

  return (
    <>
      <MyRoutesSheet
        open={isRouteListOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeRouteList()
          }
        }}
        onEdit={(route: PlannerRoute) => {
          setSelectedRoute(route)
          closeRouteList()
        }}
        onStartRun={(route: PlannerRoute) => {
          setGhostPath(route.waypoints.map((point) => [point.lat, point.lng] as [number, number]))
          closeRouteList()
          router.replace('/?tab=start')
        }}
      />
      <Suspense fallback={null}>
        <PlannerClientView />
      </Suspense>
    </>
  );
}
