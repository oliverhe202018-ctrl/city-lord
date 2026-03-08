import React, { useEffect, useState } from 'react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { cn } from '@/lib/utils';
import { Volume2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface VoiceBubbleProps {
    messageId: string;
    audioUrl: string | null;
    durationMs: number | null;
    isOwn: boolean;
    isPending?: boolean;
}

export function VoiceBubble({ messageId, audioUrl, durationMs, isOwn, isPending }: VoiceBubbleProps) {
    const [localUrl, setLocalUrl] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        let objectUrl: string | null = null;

        const fetchAudio = async () => {
            if (!audioUrl) return;
            if (audioUrl.startsWith('http') || audioUrl.startsWith('blob:')) {
                setLocalUrl(audioUrl);
                return;
            }

            setIsDownloading(true);
            try {
                const supabase = createClient();
                const { data, error } = await supabase.storage.from('voice-messages').download(audioUrl);
                if (error) throw error;
                if (data) {
                    objectUrl = URL.createObjectURL(data);
                    setLocalUrl(objectUrl);
                }
            } catch (err) {
                console.error('Failed to download voice message:', err);
            } finally {
                setIsDownloading(false);
            }
        };

        fetchAudio();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [audioUrl]);

    const { isPlaying, togglePlay } = useAudioPlayer(localUrl, messageId);

    // Fallback if missing
    const durMs = durationMs || 0;
    const seconds = Math.max(1, Math.round(durMs / 1000));

    // Calculate width: min 60px, max 200px (1s = 60px, 60s = 200px)
    const minWidth = 60;
    const maxWidth = 200;
    const widthRatio = Math.min(seconds / 60, 1);
    const calculatedWidth = minWidth + (maxWidth - minWidth) * widthRatio;

    return (
        <div
            className={cn(
                "flex items-center gap-2 cursor-pointer select-none",
                isOwn ? "flex-row-reverse" : "flex-row",
                isPending && "opacity-60 pointer-events-none"
            )}
            onClick={togglePlay}
        >
            <div
                className={cn(
                    "flex items-center px-4 py-2.5 rounded-2xl relative overflow-hidden transition-colors",
                    isOwn
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm",
                    isOwn ? "flex-row-reverse" : "flex-row"
                )}
                style={{ width: `${calculatedWidth}px`, minWidth: `${minWidth}px` }}
            >
                {/* Playback icon */}
                <div className="flex-shrink-0 relative w-5 h-5 flex items-center justify-center">
                    {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin opacity-70" />
                    ) : (
                        <Volume2
                            className={cn(
                                "w-4 h-4 transition-all duration-200",
                                isOwn ? "scale-x-[-1]" : "",
                                isPlaying ? "opacity-100 animate-pulse" : "opacity-70"
                            )}
                        />
                    )}
                </div>
            </div>

            {/* Duration Text Outside */}
            <span className="text-xs text-muted-foreground">
                {seconds}&quot;
            </span>
        </div>
    );
}
