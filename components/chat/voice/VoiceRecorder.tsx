import React, { useState, useRef, useEffect } from 'react';
import { Mic, X } from 'lucide-react';
import { useAudioRecorder, VoiceRecordResult } from '@/hooks/useAudioRecorder';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
    receiverId: string;
    onSend: (result: VoiceRecordResult) => void;
    disabled?: boolean;
}

export function VoiceRecorder({ receiverId, onSend, disabled }: VoiceRecorderProps) {
    const { isRecording, isCanceled, setIsCanceled, recordDurationMs, startRecording, stopRecording } = useAudioRecorder();
    const startYRef = useRef<number>(0);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleStart = (clientY: number) => {
        if (disabled) return;
        startYRef.current = clientY;
        startRecording();
    };

    const handleMove = (clientY: number) => {
        if (!isRecording) return;
        const distance = startYRef.current - clientY;
        // Swipe up more than 50px to cancel
        if (distance > 50 && !isCanceled) {
            setIsCanceled(true);
        } else if (distance <= 50 && isCanceled) {
            setIsCanceled(false);
        }
    };

    const handleEnd = async () => {
        if (!isRecording) return;
        const currentCanceled = isCanceled;

        // reset visual state
        const result = await stopRecording(currentCanceled, receiverId);
        if (result) {
            onSend(result);
        }
    };

    // Touch events
    const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientY);
    const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientY);
    const onTouchEnd = () => handleEnd();

    // Mouse events (for desktop testing)
    const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientY);
    const onMouseMove = (e: React.MouseEvent) => {
        if (e.buttons !== 1) return; // Only if left mouse button is pressed
        handleMove(e.clientY);
    };
    const onMouseUp = () => handleEnd();
    const onMouseLeave = () => {
        if (isRecording) handleEnd();
    };

    // Prevent context menu on long press
    useEffect(() => {
        const btn = buttonRef.current;
        if (!btn) return;
        const handleContextMenu = (e: Event) => {
            e.preventDefault();
        };
        btn.addEventListener('contextmenu', handleContextMenu);
        return () => btn.removeEventListener('contextmenu', handleContextMenu);
    }, []);

    return (
        <>
            <button
                ref={buttonRef}
                type="button" // prevent form submission
                className={cn(
                    "flex-1 h-10 flex items-center justify-center font-medium rounded-xl select-none transition-colors",
                    isRecording
                        ? "bg-zinc-700 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
                disabled={disabled}
            >
                {isRecording ? '松开 结束' : '按住 说话'}
            </button>

            {/* Recording Overlay */}
            {isRecording && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none bg-black/20">
                    <div className={cn(
                        "w-36 h-36 rounded-2xl flex flex-col items-center justify-center backdrop-blur-md shadow-2xl transition-colors duration-200",
                        isCanceled ? "bg-red-500/80" : "bg-black/60"
                    )}>
                        {isCanceled ? (
                            <X className="w-12 h-12 text-white mb-2" />
                        ) : (
                            <Mic className="w-12 h-12 text-white mb-2 animate-pulse" />
                        )}

                        <span className="text-white text-sm font-medium px-2 text-center">
                            {isCanceled ? '松开手指，取消发送' : '上滑取消'}
                        </span>

                        {!isCanceled && (
                            <span className="text-white/70 text-xs mt-1 font-mono">
                                {Math.floor(recordDurationMs / 1000)}s
                            </span>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
