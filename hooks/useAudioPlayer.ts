import { useState, useEffect, useCallback, useRef } from 'react';

// Global reference to the currently playing audio to ensure one-at-a-time playback
let activeAudio: HTMLAudioElement | null = null;
let activePlayId: string | null = null;

// Notify all hooks when the active play ID changes
const listeners = new Set<(id: string | null) => void>();

export function useAudioPlayer(audioUrl: string | null, messageId: string) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const handleActiveChange = (id: string | null) => {
            if (id !== messageId && isPlaying) {
                setIsPlaying(false);
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                }
            }
        };
        listeners.add(handleActiveChange);
        return () => {
            listeners.delete(handleActiveChange);
        };
    }, [isPlaying, messageId]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
            if (activePlayId === messageId) {
                activeAudio = null;
                activePlayId = null;
                listeners.forEach(l => l(null));
            }
        };
    }, [messageId]);

    const togglePlay = useCallback(() => {
        if (!audioUrl) return;

        if (!audioRef.current) {
            audioRef.current = new Audio(audioUrl);
            audioRef.current.addEventListener('ended', () => {
                setIsPlaying(false);
                if (activePlayId === messageId) {
                    activePlayId = null;
                    activeAudio = null;
                    listeners.forEach(l => l(null));
                }
            });
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            activePlayId = null;
            activeAudio = null;
            listeners.forEach(l => l(null));
        } else {
            if (activeAudio) {
                activeAudio.pause();
            }
            activeAudio = audioRef.current;
            activePlayId = messageId;
            listeners.forEach(l => l(messageId));

            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.error("Error playing audio", e));
            setIsPlaying(true);
        }
    }, [audioUrl, isPlaying, messageId]);

    return { isPlaying, togglePlay };
}
