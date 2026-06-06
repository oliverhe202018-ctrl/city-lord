import { Profile as MemoizedProfile } from '@/components/citylord/profile'

export default function ProfilePage() {
  return (
    <div className="flex-1 w-full h-full bg-[#0f172a] z-40 relative overflow-hidden pointer-events-auto">
      <MemoizedProfile
        onOpenSettings={() => {}}
        initialFactionStats={null}
        initialBadges={[]}
      />
    </div>
  )
}
