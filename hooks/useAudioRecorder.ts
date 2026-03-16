import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { logEvent } from '@/lib/native-log';
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
            return 'granted';
        }
        try {
            const { safeCheckMicrophonePermission } = await import('@/lib/capacitor/safe-plugins');
            const permResult = await safeCheckMicrophonePermission();
            const platform = Capacitor.getPlatform();
            
            let status: 'prompt' | 'granted' | 'denied' | 'permanent-denied' = 'prompt';

            if (permResult.currentStatus === 'granted') {
                status = 'granted';
            } else if (permResult.currentStatus === 'denied') {
                if (permResult.hasRequested && !permResult.shouldShowRationale && platform === 'android') {
                    status = 'permanent-denied';
                } else if (permResult.hasRequested && platform === 'ios') {
                    status = 'permanent-denied';
                } else {
                    status = 'denied';
                }
            } else {
                status = 'prompt';
            }
            
            setPermissionStatus(status);
            return status;
        } catch (e) {
            console.warn('[useAudioRecorder] checkPermissions failed', e);
            return 'denied';
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
            // 1. 实时权限快照
            const { safeCheckMicrophonePermission } = await import('@/lib/capacitor/safe-plugins');
            const permResult = await safeCheckMicrophonePermission();
            
            logEvent('audio_permission_snapshot', { 
                status: permResult.currentStatus, 
                hasRequested: permResult.hasRequested,
                platform: Capacitor.getPlatform() 
            });
            
            // 2. 直接发起录制请求 (getUserMedia 会在 Webview/Bridge 层面自动处理权限申请流程)
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                permResult.markRequested();
                if (typeof window !== 'undefined') localStorage.removeItem('has_requested_microphone');
                
                logEvent('audio_permission_granted');

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

                logEvent('audio_record_start_success');

                timerRef.current = setInterval(() => {
                    setRecordDurationMs(Date.now() - startTimeRef.current);
                }, 100);

            } catch (err: any) {
                const wasAlreadyRequested = permResult.hasRequested; // 先读旧值
                permResult.markRequested();                           // 再写入

                const isDenied =
                    err.name === 'NotAllowedError' ||
                    err.name === 'PermissionDeniedError' ||
                    err.name === 'SecurityError';

                logEvent('audio_record_start_failed', { errorName: err.name, errorMessage: err.message });

                if (isDenied) {
                    throw new Error(wasAlreadyRequested ? 'PERMISSION_PERMANENT_DENIED' : 'PERMISSION_DENIED');
                }
                throw err;
            }

        } catch (err: any) {
            console.error('Error accessing microphone', err);
            setIsRecording(false);

            if (err.message === 'PERMISSION_PERMANENT_DENIED' || err.message === 'PERMISSION_DENIED') {
                throw err; // 由 UI 层拦截并弹出设置引导或提示
            } else {
                toast.error('无法激活麦克风，请检查权限或硬件连接');
            }
        }
    }, [checkPermissions]);

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
