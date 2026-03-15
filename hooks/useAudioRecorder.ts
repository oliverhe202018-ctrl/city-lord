import { useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Mic, Trash2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export interface VoiceRecordResult {
    audioUrl: string;
    durationMs: number;
    mimeType: string;
    sizeBytes: number;
}

export function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [isCanceled, setIsCanceled] = useState(false);
    const [recordDurationMs, setRecordDurationMs] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startRecording = useCallback(async () => {
        try {
            const { Capacitor } = await import('@capacitor/core');
            const { App } = await import('@capacitor/app');
            
            // 1. Initial State Check
            let permissionState: 'granted' | 'denied' | 'prompt' = 'prompt';
            const localRequested = localStorage.getItem('has_requested_microphone') === 'true';

            if (Capacitor.isNativePlatform()) {
                // We use a safe check. If native bridge fails, we fallback to 'prompt' to try getUserMedia anyway
                const { safeCheckMicrophonePermission } = await import('@/lib/capacitor/safe-plugins');
                permissionState = await safeCheckMicrophonePermission();
            } else if (navigator.permissions && navigator.permissions.query) {
                try {
                    const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                    permissionState = perm.state as any;
                } catch {}
            }

            // 2. State Machine Logic
            if (permissionState === 'denied') {
                // On Android, we'd check rationale. Here we use localRequested as heuristic
                if (localRequested) {
                    throw new Error('PERMISSION_PERMANENT_DENIED');
                } else {
                    // This case is unlikely to hit unless system returns denied on first check without prompt
                    throw new Error('PERMISSION_DENIED');
                }
            }

            // 3. Requesting Permission
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // If success, mark as requested
                localStorage.setItem('has_requested_microphone', 'true');
                
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];
                setIsRecording(true);
                setIsCanceled(false);
                setRecordDurationMs(0);
                startTimeRef.current = Date.now();

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.start();

                timerRef.current = setInterval(() => {
                    setRecordDurationMs(Date.now() - startTimeRef.current);
                }, 100);

            } catch (err: any) {
                const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
                if (isDenied) {
                    localStorage.setItem('has_requested_microphone', 'true');
                    // Check if it's permanent (usually browsers don't give rationale, 
                    // but if it failed after request, we treat it as retryable unless it's blocked)
                    throw new Error('PERMISSION_DENIED');
                }
                throw err;
            }

        } catch (err: any) {
            console.error('Error accessing microphone', err);
            setIsRecording(false);

            if (err.message === 'PERMISSION_PERMANENT_DENIED' || err.message === 'PERMISSION_DENIED') {
                throw err; // Let UI handle this
            } else {
                toast.error('无法访问麦克风，请检查硬件是否正常');
            }
        }
    }, []);

    const stopRecording = useCallback(async (cancel: boolean, receiverId: string): Promise<VoiceRecordResult | null> => {
        return new Promise((resolve) => {
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                resolve(null);
                return;
            }

            const durationMs = Date.now() - startTimeRef.current;
            setRecordDurationMs(durationMs);

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            mediaRecorderRef.current.onstop = async () => {
                setIsRecording(false);
                const tracks = mediaRecorderRef.current?.stream.getTracks();
                if (tracks) {
                    tracks.forEach(track => track.stop());
                }

                if (cancel) {
                    resolve(null);
                    return;
                }

                if (durationMs < 800) {
                    toast.error('说话时间太短');
                    resolve(null);
                    return;
                }

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                // Upload to Supabase 
                try {
                    const supabase = createClient();
                    const { data: { session } } = await supabase.auth.getSession();
                    const senderId = session?.user?.id;
                    if (!senderId) {
                        toast.error('未登录');
                        resolve(null);
                        return;
                    }

                    const fileName = `private/${senderId}/${receiverId}/${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;

                    const { data, error } = await supabase.storage
                        .from('voice-messages')
                        .upload(fileName, audioBlob, {
                            contentType: 'audio/webm',
                            cacheControl: '3600',
                            upsert: false
                        });

                    if (error) {
                        console.error('Upload error:', error);
                        toast.error('语音发送失败');
                        resolve(null);
                        return;
                    }

                    resolve({
                        audioUrl: data.path,
                        durationMs,
                        mimeType: 'audio/webm',
                        sizeBytes: audioBlob.size,
                    });

                } catch (uploadErr) {
                    console.error('Upload exception:', uploadErr);
                    toast.error('语音发送失败');
                    resolve(null);
                }
            };

            mediaRecorderRef.current.stop();
        });
    }, []);

    return { isRecording, isCanceled, setIsCanceled, recordDurationMs, startRecording, stopRecording };
}
