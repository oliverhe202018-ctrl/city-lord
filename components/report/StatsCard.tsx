import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  unit?: string
  trend?: number
  className?: string
}

export function StatsCard({ icon: Icon, label, value, unit, trend, className }: StatsCardProps) {
  return (
    <div className={cn("bg-card/50 border border-border rounded-xl p-4 flex flex-col items-center justify-center gap-2", className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {trend !== undefined && (
        <div className={cn("text-xs font-medium", trend >= 0 ? "text-green-500" : "text-red-500")}>
          {trend > 0 ? '+' : ''}{trend}%
        </div>
      )}
    </div>
  )
}
