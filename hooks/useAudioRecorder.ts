import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { logEvent } from '@/lib/native-log';
import { Capacitor } from '@capacitor/core';
import { queryMicrophonePermission } from '@/lib/audio/AudioPermissionManager';
import { acquireAudioStream, releaseStream, getMediaRecorderOptions } from '@/lib/audio/AudioStreamManager';
import { uploadAudio } from '@/lib/audio/AudioUploader';

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

    const hasRequestedRef = useRef(false);
    const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
    const retryCountRef = useRef(0);
    const onAutoStopRef = useRef<(() => void) | null>(null);

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
            const result = await queryMicrophonePermission();

            let status: 'prompt' | 'granted' | 'denied' | 'permanent-denied' = 'prompt';

            if (result.state === 'granted') {
                status = 'granted';
            } else if (result.state === 'denied' || (result.state === 'unknown' && hasRequestedRef.current && !result.canAskAgain)) {
                status = result.canAskAgain ? 'denied' : 'permanent-denied';
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

    const setupMediaRecorder = useCallback((stream: MediaStream): MediaRecorder => {
        const options = getMediaRecorderOptions();
        const mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.onerror = async () => {
            if (retryCountRef.current >= 1) {
                toast.error('录音异常，请重试');
                setIsRecording(false);
                retryCountRef.current = 0;
                return;
            }
            retryCountRef.current += 1;
            console.warn('[useAudioRecorder] MediaRecorder error, retrying...');

            releaseStream(stream);
            const retryResult = await acquireAudioStream();
            if (!retryResult.ok) {
                toast.error('录音恢复失败，请重试');
                setIsRecording(false);
                retryCountRef.current = 0;
                return;
            }
            const newRecorder = setupMediaRecorder(retryResult.stream);
            audioChunksRef.current = []; // 清空损坏数据，从干净状态开始
            mediaRecorderRef.current = newRecorder;
            newRecorder.start(250);
        };

        return mediaRecorder;
    }, []);

    const startRecording = useCallback(async (onAutoStop?: () => void) => {
        try {
            retryCountRef.current = 0;
            onAutoStopRef.current = onAutoStop ?? null;

            // 1. 权限前置（绝对阻断）
            const currentStatus = await checkPermissions();
            if (currentStatus !== 'granted') {
                const streamResult = await acquireAudioStream();
                if (streamResult.ok) {
                    releaseStream(streamResult.stream);
                    await checkPermissions();
                    toast.success('麦克风已就绪，请重新按住录音');
                    return; // 请求完毕后立刻 return 退出函数，绝对不要初始化录音机
                } else {
                    const wasAlreadyRequested = hasRequestedRef.current;
                    hasRequestedRef.current = true;
                    throw new Error(wasAlreadyRequested ? 'PERMISSION_PERMANENT_DENIED' : 'PERMISSION_DENIED');
                }
            }

            const streamResult = await acquireAudioStream();

            if (!streamResult.ok) {
                logEvent('audio_record_start_failed', { reason: streamResult.reason });
                throw new Error('STREAM_ERROR');
            }

            hasRequestedRef.current = false;

            const stream = streamResult.stream;
            logEvent('audio_permission_granted');

            const mediaRecorder = setupMediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            setIsRecording(true);
            setIsCanceled(false);
            setRecordDurationMs(0);
            startTimeRef.current = Date.now();

            mediaRecorder.start(250);
            logEvent('audio_record_start_success');

            timerRef.current = setInterval(() => {
                setRecordDurationMs(Date.now() - startTimeRef.current);
            }, 100);

            maxDurationTimerRef.current = setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    logEvent('audio_record_auto_stop', { reason: 'max_duration' });
                    mediaRecorderRef.current.stop();
                    setIsRecording(false);
                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                        timerRef.current = null;
                    }
                    if (maxDurationTimerRef.current) {
                        clearTimeout(maxDurationTimerRef.current);
                        maxDurationTimerRef.current = null;
                    }
                    onAutoStopRef.current?.();
                }
            }, 60000);

        } catch (err: any) {
            console.error('Error accessing microphone', err);
            setIsRecording(false);

            if (err.message === 'PERMISSION_PERMANENT_DENIED' || err.message === 'PERMISSION_DENIED') {
                throw err;
            } else if (err.message === 'DEVICE_NOT_FOUND') {
                toast.error('未检测到麦克风设备，请检查硬件连接');
            } else {
                toast.error('无法激活麦克风，请检查权限或硬件连接');
            }
        }
    }, [setupMediaRecorder]);

    const stopRecording = useCallback(async (cancel: boolean, receiverId: string): Promise<VoiceRecordResult | null> => {
        if (maxDurationTimerRef.current) {
            clearTimeout(maxDurationTimerRef.current);
            maxDurationTimerRef.current = null;
        }
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

            // 彻底销毁实例
            const recorder = mediaRecorderRef.current;
            mediaRecorderRef.current = null;

            recorder.onstop = async () => {
                setIsRecording(false);
                const tracks = recorder.stream.getTracks();
                if (tracks) {
                    tracks.forEach(track => {
                        track.stop();
                        console.log(`[useAudioRecorder] Track ${track.kind} stopped`);
                    });
                }
                
                if (recorder.stream) {
                    const { releaseStream } = await import('@/lib/audio/AudioStreamManager');
                    releaseStream(recorder.stream);
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

                const mimeType = recorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                const senderId = session?.user?.id;
                if (!senderId) {
                    toast.error('未登录');
                    resolve(null);
                    return;
                }

                try {
                    const uploadResult = await uploadAudio({
                        senderId,
                        receiverId,
                        audioBlob,
                        mimeType,
                        durationMs,
                    });

                    resolve({
                        audioUrl: uploadResult.path,
                        durationMs,
                        mimeType,
                        sizeBytes: uploadResult.sizeBytes,
                    });
                } catch (uploadErr) {
                    console.error('Upload exception:', uploadErr);
                    toast.error('语音发送失败');
                    resolve(null);
                }
            };

            recorder.stop();
        });
    }, []);

    return { 
        isRecording, 
        isCanceled, 
        setIsCanceled, 
        recordDurationMs, 
        startRecording, 
        stopRecording,
        permissionStatus,
        stream: mediaRecorderRef.current?.stream ?? null,
    };
}
