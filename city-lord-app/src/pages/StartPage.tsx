import { StartRunOverlay } from '@/components/citylord/start/StartRunPageClient'
import { useRunningTrackerContext } from '@/contexts/RunningTrackerContext'

export default function StartPage() {
  const { setActiveTab, beginRunStart } = useRunningTrackerContext()

  return (
    <div className="absolute inset-0 z-50 pointer-events-auto">
      <StartRunOverlay
        onClose={() => setActiveTab("play")}
        onBeginRun={() => {
          beginRunStart()
        }}
      />
    </div>
  )
}
