import { MissionCenter as MemoizedMissionCenter } from '@/components/citylord/MissionCenter'

export default function MissionsPage() {
  return (
    <div className="flex-1 w-full h-full bg-[#0f172a] z-40 relative pointer-events-auto">
      <MemoizedMissionCenter initialData={[]} initialFilter={'all'} />
    </div>
  )
}
