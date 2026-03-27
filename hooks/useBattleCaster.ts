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
}

/**
 * useBattleCaster: Real-time audio feedback for running achievements
 * 
 * Performance Optimized: Uses refs to prevent duplicate broadcasts caused by GPS jitter.
 * Native Priority: Uses @capacitor-community/text-to-speech for background support.
 */
export function useBattleCaster({ distanceMeters, hexesCaptured, pace, factionName }: BattleCasterProps) {
  const { voiceReportingEnabled } = useGameStore(s => s.appSettings);
  
  const lastSpokenKm = useRef<number>(0);
  const lastSpokenTerritoryCount = useRef<number>(0);
  const isSpeaking = useRef(false);

  // Initialize Speech Support
  const speak = async (text: string) => {
    if (!voiceReportingEnabled || isSpeaking.current) return;
    
    console.log(`[BattleCaster] Speaking: "${text}"`);
    isSpeaking.current = true;

    const isAppNative = await isNativePlatform();
    const isAndroid = Capacitor.getPlatform() === 'android';

    try {
      if (isAppNative) {
        // Android focus management (Ducking)
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
          category: 'playback', // Use playback to avoid being cut off by silent switch
        });
      } else {
        // Fallback to Browser Web Speech API
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
        
        return new Promise<void>((resolve) => {
          utterance.onend = () => {
            isSpeaking.current = false;
            resolve();
          };
          utterance.onerror = () => {
            isSpeaking.current = false;
            resolve();
          };
        });
      }
    } catch (err) {
      console.error('[BattleCaster] Speech failed:', err);
    } finally {
      if (isAppNative) {
        if (isAndroid) {
          try {
            await AudioFocus.abandonDucking();
          } catch (e) {
            console.warn('[BattleCaster] Failed to abandon audio focus:', e);
          }
        }
        isSpeaking.current = false;
      }
    }
  };

  // 1. Distance Milestone Listener (Every 1km)
  useEffect(() => {
    const currentKm = Math.floor(distanceMeters / 1000);
    
    if (currentKm > 0 && currentKm > lastSpokenKm.current) {
      lastSpokenKm.current = currentKm;
      
      const message = `领主，您已奔袭 ${currentKm} 公里！当前配速 ${pace}，势如破竹，请继续保持！`;
      speak(message);
    }
  }, [distanceMeters, pace]);

  // 2. Territory Captured Listener
  useEffect(() => {
    if (hexesCaptured > lastSpokenTerritoryCount.current) {
      lastSpokenTerritoryCount.current = hexesCaptured;
      
      const faction = factionName || '我方阵营';
      const message = `捷报！${faction} 成功夺取一块新领地，城市的版图正在为您扩张！`;
      speak(message);
    }
  }, [hexesCaptured, factionName]);

  return { speak };
}
