import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';

export interface VoiceRecordResult {
    audioUrl: string;
    durationMs: number;
    mimeType: string;
    sizeBytes: number;
}

export function useAudioRecorder() {
    const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'permanent-denied'>('prompt');
    const [isRecording, setIsRecording] = useState(false);
    const [isCanceled, setIsCanceled] = useState(false);
    const [recordDurationMs, setRecordDurationMs] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const checkPermissions = useCallback(async () => {
        if (!Capacitor.isNativePlatform()) {
            setPermissionStatus('granted'); // Assume handled by browser prompt
            return;
        }
        try {
            const { safeCheckMicrophonePermission } = await import('@/lib/capacitor/safe-plugins');
            const permResult = await safeCheckMicrophonePermission();
            const platform = Capacitor.getPlatform();
            
            if (permResult.currentStatus === 'granted') {
                setPermissionStatus('granted');
            } else if (permResult.currentStatus === 'denied') {
                if (permResult.hasRequested && !permResult.shouldShowRationale && platform === 'android') {
                    setPermissionStatus('permanent-denied');
                } else if (permResult.hasRequested && platform === 'ios') {
                    setPermissionStatus('permanent-denied');
                } else {
                    setPermissionStatus('denied');
                }
            } else {
                setPermissionStatus('prompt');
            }
        } catch (e) {
            console.warn('[useAudioRecorder] checkPermissions failed', e);
        }
    }, []);

    // Refresh on Mount and Foreground
    useEffect(() => {
        checkPermissions();
        
        // Setup App listener
        let handler: any;
        const setupListener = async () => {
            const { App } = await import('@capacitor/app');
            handler = await App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) {
                    console.log('[useAudioRecorder] Refreshing permissions on foreground');
                    checkPermissions();
                }
            });
        };

        setupListener();
        return () => {
            if (handler) handler.remove();
        };
    }, [checkPermissions]);

    const startRecording = useCallback(async () => {
        try {
            // 1. Re-check before starting
            await checkPermissions();
            
            if (permissionStatus === 'permanent-denied') {
                throw new Error('PERMISSION_PERMANENT_DENIED');
            } else if (permissionStatus === 'denied') {
                throw new Error('PERMISSION_DENIED');
            }

            // 2. Requesting Permission & Starting
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
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
    }, [checkPermissions, permissionStatus]);

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

    return { 
        isRecording, 
        isCanceled, 
        setIsCanceled, 
        recordDurationMs, 
        startRecording, 
        stopRecording,
        permissionStatus 
    };
}
