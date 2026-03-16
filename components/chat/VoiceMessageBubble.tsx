'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  playExclusive,
  enqueueItems,
  pauseCurrent,
  setPlaybackRate,
  subscribeAudioState,
  getCurrentPlayingId,
  getCurrentRate,
  getCurrentAudio,
  registerPreload,
  refreshPreload,
  unregisterPreload,
  type PlaybackRate,
} from '@/lib/audio/AudioPlayer';
import { markVoiceRead } from '@/lib/audio/VoiceMessageService';

export interface VoiceQueueItem {
  messageId: string;
  audioPath: string;
}

interface VoiceMessageBubbleProps {
  messageId: string;
  audioPath: string;
  durationMs: number;
  isSender: boolean;
  isRead?: boolean;
  voiceQueue?: VoiceQueueItem[];
}

async function fetchSignedUrl(
  audioPath: string
): Promise<{ url: string; expiresAt: number } | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from('voice-messages')
    .createSignedUrl(audioPath, 300);

  if (error || !data?.signedUrl) {
    console.error('[VoiceMessageBubble] fetchSignedUrl failed', error);
    return null;
  }

  return {
    url: data.signedUrl,
    expiresAt: Date.now() + 280_000, // 280s，提前 20s 刷新
  };
}

export function VoiceMessageBubble({
  messageId,
  audioPath,
  durationMs,
  isSender,
  isRead = true,
  voiceQueue = [],
}: VoiceMessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rate, setRate] = useState<PlaybackRate>(getCurrentRate());
  const [localIsRead, setLocalIsRead] = useState(isRead);
  // 真实音量波形：5 根柱子的高度比例 0~1
  const [barHeights, setBarHeights] = useState<number[]>([0.4, 0.8, 1, 0.8, 0.4]);

  const urlExpiresAtRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // ── 1. 初始化 signed URL + 预热 ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    fetchSignedUrl(audioPath).then((result) => {
      if (cancelled || !result) return;
      setAudioUrl(result.url);
      urlExpiresAtRef.current = result.expiresAt;
      registerPreload(messageId, result.url);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      unregisterPreload(messageId);
    };
  }, [audioPath, messageId]);

  // ── 2. 订阅全局播放状态 ───────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeAudioState((playingId, globalRate) => {
      const iAmPlaying = playingId === messageId;
      setIsPlaying(iAmPlaying);
      setRate(globalRate);

      if (!iAmPlaying) {
        stopRaf();
        stopAnalyser();
        setCurrentMs(0);
        setBarHeights([0.4, 0.8, 1, 0.8, 0.4]);
      }
    });
    return unsubscribe;
  }, [messageId]);

  // ── 3. RAF 精准进度同步 ───────────────────────────────────────────────
  function stopRaf() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function startRaf() {
    stopRaf();
    function tick() {
      const audio = getCurrentAudio();
      if (!audio || audio.paused) {
        rafRef.current = null;
        return;
      }
      setCurrentMs(audio.currentTime * 1000);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  // ── 4. 真实音量波形 ───────────────────────────────────────────────────
  function stopAnalyser() {
    if (rafRef.current !== null) return; // RAF 还在跑时不销毁
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }

  function startAnalyser(audio: HTMLAudioElement) {
    // 同一个 audio 对象只连接一次
    if (audioCtxRef.current) return;

    try {
      console.log('[VoiceMessageBubble] starting analyser for', messageId);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; // 低 fftSize = 低延迟，够用

      source.connect(analyser);
      analyser.connect(ctx.destination); // 必须连 destination，否则没有声音

      audioCtxRef.current = ctx;
      sourceNodeRef.current = source;
      analyserRef.current = analyser;
    } catch (e) {
      console.warn('[VoiceMessageBubble] AnalyserNode init failed (will still play audio)', {
        messageId,
        error: e instanceof Error ? e.message : String(e),
        url: audioUrl
      });
      // 确保即使报错也将相关 ref 置空，防止下次重复尝试导致更多错误
      audioCtxRef.current = null;
      sourceNodeRef.current = null;
      analyserRef.current = null;
    }
  }

  function startWaveformRaf() {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const BAR_COUNT = 5;

    function tickWave() {
      const audio = getCurrentAudio();
      const analyser = analyserRef.current;
      if (!audio || audio.paused || !analyser) return;

      analyser.getByteFrequencyData(data);

      // 把频率数据分成 BAR_COUNT 段，取每段平均值映射到 0~1
      const segSize = Math.floor(data.length / BAR_COUNT);
      const heights = Array.from({ length: BAR_COUNT }, (_, i) => {
        let sum = 0;
        for (let j = i * segSize; j < (i + 1) * segSize; j++) {
          sum += data[j];
        }
        const avg = sum / segSize / 255; // 归一化 0~1
        // 保证最小高度 0.15，视觉上不会完全消失
        return Math.max(avg, 0.15);
      });

      setBarHeights(heights);
      requestAnimationFrame(tickWave);
    }

    requestAnimationFrame(tickWave);
  }

  // ── 5. URL 过期检查 ───────────────────────────────────────────────────
  async function ensureFreshUrl(): Promise<string | null> {
    if (Date.now() < urlExpiresAtRef.current && audioUrl) {
      return audioUrl;
    }

    const result = await fetchSignedUrl(audioPath);
    if (!result) return null;

    setAudioUrl(result.url);
    urlExpiresAtRef.current = result.expiresAt;
    refreshPreload(messageId, result.url);
    return result.url;
  }

  // ── 6. 点击播放 / 暂停 ───────────────────────────────────────────────
  const handleToggle = useCallback(async () => {
    if (isLoading) return;

    const isCurrentlyPlaying = getCurrentPlayingId() === messageId;
    console.log('[VoiceMessageBubble] handleToggle click', {
      messageId,
      isCurrentlyPlaying,
      hasAudioUrl: !!audioUrl
    });

    if (isCurrentlyPlaying) {
      pauseCurrent();
      stopRaf();
      return;
    }

    const url = await ensureFreshUrl();
    if (!url) {
      console.error('[VoiceMessageBubble] toggle failed: no fresh URL', messageId);
      return;
    }

    // 满足浏览器自动播放策略：在用户交互路径中恢复 AudioContext
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      console.log('[VoiceMessageBubble] resuming suspended AudioContext');
      audioCtxRef.current.resume().catch(e => console.error('[VoiceMessageBubble] resume context failed', e));
    }

    // 自动已读（点击即标记）
    if (!isSender && !localIsRead) {
      setLocalIsRead(true);
      markVoiceRead(messageId);
    }

    // 构建从当前消息开始的播放队列
    const selfIndex = voiceQueue.findIndex((v) => v.messageId === messageId);
    const tail = selfIndex >= 0 ? voiceQueue.slice(selfIndex + 1) : [];

    // 先独占播放当前
    playExclusive({
      url,
      messageId,
      onEnd: (id) => {
        stopRaf();
        setCurrentMs(0);
        if (!isSender && !localIsRead) {
          setLocalIsRead(true);
          markVoiceRead(id);
        }
      },
    });

    // 启动进度同步
    startRaf();

    // 启动真实波形（需要等 AudioPlayer 里的 Audio 对象就绪）
    requestAnimationFrame(() => {
      const audio = getCurrentAudio();
      if (audio) {
        startAnalyser(audio);
        // 只有 analyser 成功初始化才启动波形 RAF
        if (analyserRef.current) {
          startWaveformRaf();
        }
      } else {
        console.warn('[VoiceMessageBubble] cannot start analyser: audio object not found');
      }
    });
  }, [isLoading, messageId, audioUrl, isSender, localIsRead, voiceQueue]);

  // ── 7. 倍速切换 ──────────────────────────────────────────────────────
  const handleRateToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next: PlaybackRate = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setPlaybackRate(next);
    setRate(next);
  }, [rate]);

  // ── 8. 卸载清理 ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopRaf();
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    };
  }, []);

  // ── 9. 渲染 ──────────────────────────────────────────────────────────
  const totalSec = Math.max(Math.ceil(durationMs / 1000), 1);
  const progressRatio = durationMs > 0 ? Math.min(currentMs / durationMs, 1) : 0;
  const bubbleWidth = Math.min(80 + totalSec * 8, 220);
  const showUnread = !isSender && !localIsRead;

  return (
    <div className={`flex items-center gap-1 ${isSender ? 'justify-end' : 'justify-start'}`}>

      {/* 未读红点（接收方左侧） */}
      {!isSender && (
        <div className="w-3 flex items-center justify-center flex-shrink-0">
          {showUnread && (
            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          )}
        </div>
      )}

      <button
        onClick={handleToggle}
        disabled={isLoading}
        style={{ width: bubbleWidth }}
        className={[
          'flex items-center gap-2 px-3 py-2 rounded-2xl select-none',
          'transition-opacity active:opacity-70',
          isSender
            ? 'bg-green-500 text-white flex-row-reverse'
            : 'bg-white text-gray-800 border border-gray-100 shadow-sm flex-row',
          isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        {/* 播放 / 暂停图标 */}
        <span className="text-sm flex-shrink-0 w-4 text-center">
          {isLoading ? '…' : isPlaying ? '⏸' : '▶'}
        </span>

        {/* 波形进度条（播放时显示真实音量，静止时显示默认形状） */}
        <div className="flex items-end gap-[2px] flex-1 justify-center">
          {barHeights.map((h, i) => {
            const barThreshold = i / (barHeights.length - 1);
            const active = isPlaying && progressRatio >= barThreshold;
            return (
              <div
                key={i}
                style={{
                  height: `${6 + 18 * h}px`,
                  transition: isPlaying ? 'height 80ms ease' : 'none',
                }}
                className={[
                  'w-[3px] rounded-full',
                  active
                    ? isSender ? 'bg-white' : 'bg-green-500'
                    : isSender ? 'bg-green-200' : 'bg-gray-300',
                ].join(' ')}
              />
            );
          })}
        </div>

        {/* 时长倒计时 */}
        <span className="text-xs flex-shrink-0 tabular-nums w-6 text-right">
          {isPlaying
            ? `${Math.max(Math.ceil((durationMs - currentMs) / 1000), 1)}″`
            : `${totalSec}″`}
        </span>
      </button>

      {/* 倍速按钮（播放中显示，发送方右侧，接收方左侧） */}
      {isPlaying && (
        <button
          onClick={handleRateToggle}
          className={[
            'text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0',
            'transition-colors active:opacity-70',
            isSender
              ? 'text-green-600 bg-green-100'
              : 'text-gray-600 bg-gray-100',
          ].join(' ')}
        >
          {rate}x
        </button>
      )}

      {/* 发送方右侧占位（保持布局对称） */}
      {isSender && (
        <div className="w-3 flex-shrink-0" />
      )}
    </div>
  );
}
