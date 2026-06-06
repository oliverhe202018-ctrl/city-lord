import { GameHomePage } from '@/components/citylord/home/GameHomePage'
import { useRunningTrackerContext } from '@/contexts/RunningTrackerContext'
import type { RunMode } from "@/types/home"
import type { TabType } from "@/components/citylord/bottom-nav"
import { useRouteListStore } from '@/store/useRouteListStore'

export default function HomePage() {
  const { setActiveTab } = useRunningTrackerContext()
  const { openRouteList } = useRouteListStore()

  const handlePlannerOpen = () => {
    // Original handlePlannerOpen Logic was complex, but for HomePage, we can just open route list 
    // or trigger planner if needed.
    // In GameLayout, it was:
    // setPlannerReturnTab(activeTab)
    // setIsPlannerOpen(true)
    // Since Planner is heavily integrated, maybe we should just emit an event or move it.
    // Let's use the simplest approach:
  }

  return (
    <div className="absolute inset-0 bg-[#0f172a] z-40 overflow-y-auto pointer-events-auto">
      <GameHomePage
        onStartRun={(_mode: RunMode) => setActiveTab('start')}
        onNavigateToMap={(targetId) => {
          setActiveTab('play');
        }}
        onNavigateToTab={(tab) => setActiveTab(tab as TabType)}
        onSmartPlan={handlePlannerOpen}
      />
    </div>
  )
}
