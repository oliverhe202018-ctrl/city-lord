import { RunnerGame } from "@/components/game/RunnerGame"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function RunnerPage() {
  return (
    <div className="w-full h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-black/20 border-b border-white/5">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回地图
          </Button>
        </Link>
        <h1 className="text-white font-bold text-lg">Runner Mode (Alpha)</h1>
        <div className="w-20" /> {/* Spacer */}
      </div>

      {/* Game Container */}
      <div className="flex-1 overflow-hidden p-4 flex items-center justify-center">
        <div className="w-full max-w-4xl aspect-video relative">
            <RunnerGame />
        </div>
      </div>
    </div>
  )
}
