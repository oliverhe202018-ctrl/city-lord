"use client"

import { useTheme } from "@/components/citylord/theme/theme-provider"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Leaf } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-2 p-1 bg-zinc-900/50 rounded-lg border border-white/10 w-full">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "flex-1 gap-1.5 h-8 hover:bg-white/10 hover:text-white transition-all", 
          theme.id === 'cyberpunk' ? "bg-primary text-primary-foreground shadow-sm" : "text-zinc-400"
        )}
        onClick={() => setTheme('cyberpunk')}
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">赛博</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "flex-1 gap-1.5 h-8 hover:bg-white/10 hover:text-white transition-all", 
          theme.id === 'light' ? "bg-primary text-primary-foreground shadow-sm" : "text-zinc-400"
        )}
        onClick={() => setTheme('light')}
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">日间</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "flex-1 gap-1.5 h-8 hover:bg-white/10 hover:text-white transition-all", 
          theme.id === 'nature' ? "bg-primary text-primary-foreground shadow-sm" : "text-zinc-400"
        )}
        onClick={() => setTheme('nature')}
      >
        <Leaf className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">自然</span>
      </Button>
    </div>
  )
}
