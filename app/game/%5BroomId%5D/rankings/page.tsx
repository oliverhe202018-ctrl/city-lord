import { RoomRankings } from "@/components/citylord/room/RoomRankings"

interface RankingsPageProps {
  params: Promise<{
    roomId: string
  }>
}

export default async function RoomRankingsPage({ params }: RankingsPageProps) {
  const { roomId } = await params

  return (
    <div className="flex h-screen flex-col bg-black p-4 pt-12 pb-8">
      {/* Page Header */}
      <div className="mb-6 px-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter italic">ROOM RANK</h1>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mt-0.5">
              Battle Rankings • 实时战况
            </p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          </div>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 min-h-0">
        <RoomRankings roomId={roomId} />
      </div>

      {/* Footer Branding */}
      <div className="mt-6 flex flex-col items-center gap-1 opacity-20">
        <div className="h-px w-12 bg-white" />
        <p className="text-[8px] font-black text-white uppercase tracking-[0.5em]">
          City Lord Terminal v2.0
        </p>
      </div>
    </div>
  )
}
