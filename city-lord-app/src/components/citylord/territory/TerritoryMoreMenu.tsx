'use client'

import { useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreVertical, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'

interface TerritoryMoreMenuProps {
    territoryId: string
    ownerId: string | null
    onReportClick?: () => void
}

export function TerritoryMoreMenu({ territoryId, ownerId, onReportClick }: TerritoryMoreMenuProps) {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [showReportOption, setShowReportOption] = useState(false)

    // Do not show report menu for own territory or neutral territory
    const isOwnTerritory = user?.id === ownerId
    const isNeutral = !ownerId

    if (isOwnTerritory || isNeutral) {
        return null
    }

    const handleReport = () => {
        setShowReportOption(false)
        navigate('/settings/feedback?type=territory&id=' + territoryId)
    }

    return (
        <>
            <DropdownMenu open={showReportOption} onOpenChange={setShowReportOption}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-5 w-5" />
                        <span className="sr-only">更多选项</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleReport} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                        <Flag className="w-4 h-4 mr-2" />
                        <span>举报</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    )
}