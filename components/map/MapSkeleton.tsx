import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MapSkeletonProps {
    className?: string;
}

export function MapSkeleton({ className }: MapSkeletonProps) {
    return (
        <div
            className={cn(
                "flex items-center justify-center bg-zinc-950",
                className
            )}
        >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
}
