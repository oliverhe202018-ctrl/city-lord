import { useEffect, useRef, useState, useCallback } from 'react';

export interface WaveformBar {
  height: number; // px，范围 4~28
}

/**
 * useWaveform
 * 使用 AnalyserNode 实时读取麦克风音量，输出 5 条波形柱高度
 * 仅在 stream 存在时激活，stream 为 null 时自动清理
 */
export function useWaveform(stream: MediaStream | null, barCount = 5): WaveformBar[] {
  const [bars, setBars] = useState<WaveformBar[]>(
    Array.from({ length: barCount }, () => ({ height: 4 }))
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setBars(Array.from({ length: barCount }, () => ({ height: 4 })));
  }, [barCount]);

  useEffect(() => {
    if (!stream) {
      cleanup();
      return;
    }

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64; // 小 FFT，低延迟
    analyser.smoothingTimeConstant = 0.75;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    sourceRef.current = source;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);

      // 把频率数据分成 barCount 段，取每段均值
      const segmentSize = Math.floor(dataArray.length / barCount);
      const newBars = Array.from({ length: barCount }, (_, i) => {
        const start = i * segmentSize;
        const end = start + segmentSize;
        let sum = 0;
        for (let j = start; j < end; j++) sum += dataArray[j];
        const avg = sum / segmentSize; // 0~255
        const height = 4 + (avg / 255) * 24; // 4px ~ 28px
        return { height };
      });

      setBars(newBars);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return cleanup;
  }, [stream, barCount, cleanup]);

  return bars;
}
