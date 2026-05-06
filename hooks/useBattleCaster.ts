import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { isNativePlatform } from '@/lib/capacitor/safe-plugins';
import { registerPlugin, Capacitor } from '@capacitor/core';

interface AudioFocusPlugin {
  requestDucking(): Promise<void>;
  abandonDucking(): Promise<void>;
}

const AudioFocus = registerPlugin<AudioFocusPlugin>('AudioFocus');

interface BattleCasterProps {
  distanceMeters: number;
  hexesCaptured: number;
  pace: string;
  factionName?: string | null;
  runId?: string | null;
  isRunning: boolean;
}

function ts() {
  return new Date().toISOString().slice(11, 23);
}

export function useBattleCaster({ distanceMeters, hexesCaptured, pace, factionName, runId, isRunning }: BattleCasterProps) {
  const { voiceReportingEnabled } = useGameStore(s => s.appSettings);
  
  const lastSpokenKm = useRef<number>(0);
  const lastSpokenTerritoryCount = useRef<number>(0);
  const isSpeaking = useRef(false);
  const activeRunIdRef = useRef<string | null>(null);

  const resetRefs = () => {
    const prev = activeRunIdRef.current;
    lastSpokenKm.current = 0;
    lastSpokenTerritoryCount.current = 0;
    isSpeaking.current = false;
    activeRunIdRef.current = runId ?? null;
    console.log(`[${ts()}] [DEBUG:BattleCaster] Resetting refs due to runId change: OldId=${prev} -> NewId=${runId ?? 'NULL'}`);
  };

  useEffect(() => {
    resetRefs();
  }, [runId]);

  useEffect(() => {
    if (isRunning && activeRunIdRef.current !== (runId ?? null)) {
      console.log(`[${ts()}] [DEBUG:BattleCaster] isRunning edge-trigger reset: isRunning=${isRunning}, runId=${runId ?? 'NULL'}`);
      resetRefs();
    }
  }, [isRunning]);

  const speak = async (text: string) => {
    if (!voiceReportingEnabled || isSpeaking.current) return;
    
    console.log(`[${ts()}] [BattleCaster] Speaking: "${text}"`);
    isSpeaking.current = true;

    const isAppNative = await isNativePlatform();
    const isAndroid = Capacitor.getPlatform() === 'android';

    try {
      if (isAppNative) {
        if (isAndroid) {
          try {
            await AudioFocus.requestDucking();
          } catch (e) {
            console.warn('[BattleCaster] Failed to request audio focus:', e);
          }
        }

        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        await TextToSpeech.speak({
          text,
          lang: 'zh-CN',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'playback',
        });
      } else {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
        
        await new Promise<void>((resolve) => {
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
        });
      }
    } catch (err) {
      console.error('[BattleCaster] Speech failed:', err);
    } finally {
      isSpeaking.current = false;
      if (isAppNative && isAndroid) {
        try {
          await AudioFocus.abandonDucking();
        } catch (e) {
          console.warn('[BattleCaster] Failed to abandon audio focus:', e);
        }
      }
    }
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      isSpeaking.current = false;
      console.log(`[${ts()}] [BattleCaster] Cleanup: cancelled all pending speech`);
    };
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      isSpeaking.current = false;
      console.log(`[${ts()}] [BattleCaster] isRunning=false: cancelled speech queue, released lock`);
    }
  }, [isRunning]);

  useEffect(() => {
    console.log(`[${ts()}] [DEBUG:BattleCaster] Checking announcement: isRunning=${isRunning}, dist=${distanceMeters}, lastSpokenKm=${lastSpokenKm.current}`);
    if (!isRunning) return;
    if (activeRunIdRef.current !== (runId ?? null)) {
      console.log(`[${ts()}] [DEBUG:BattleCaster] BLOCKED milestone: runId not aligned (active=${activeRunIdRef.current}, incoming=${runId ?? 'NULL'})`);
      return;
    }
    const currentKm = Math.floor(distanceMeters / 1000);
    
    if (currentKm > 0 && currentKm > lastSpokenKm.current) {
      lastSpokenKm.current = currentKm;
      
      const message = `领主，您已奔袭 ${currentKm} 公里！当前配速 ${pace}，势如破竹，请继续保持！`;
      speak(message);
    }
  }, [distanceMeters, pace, isRunning, runId]);

  useEffect(() => {
    if (!isRunning) return;
    if (activeRunIdRef.current !== (runId ?? null)) {
      console.log(`[${ts()}] [DEBUG:BattleCaster] BLOCKED territory: runId not aligned (active=${activeRunIdRef.current}, incoming=${runId ?? 'NULL'})`);
      return;
    }
    if (hexesCaptured > lastSpokenTerritoryCount.current) {
      lastSpokenTerritoryCount.current = hexesCaptured;
      
      const faction = factionName || '我方阵营';
      const message = `捷报！${faction} 成功夺取一块新领地，城市的版图正在为您扩张！`;
      speak(message);
    }
  }, [hexesCaptured, factionName, isRunning, runId]);

  return { speak };
}
