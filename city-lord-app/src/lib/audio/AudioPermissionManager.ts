import { Capacitor } from '@capacitor/core';

export type PermissionState = 'unknown' | 'granted' | 'prompt' | 'denied';

export interface PermissionQueryResult {
  state: PermissionState;
  canAskAgain: boolean; // false 表示永久拒绝，需要去设置
}

export async function queryMicrophonePermission(): Promise<PermissionQueryResult> {
  // Web 平台：使用标准 Permissions API
  if (!Capacitor.isNativePlatform()) {
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      try {
        const res = await (navigator.permissions as any).query({ name: 'microphone' });
        return {
          state: res.state as PermissionState,
          canAskAgain: res.state !== 'denied',
        };
      } catch {
        return { state: 'prompt', canAskAgain: true };
      }
    }
    return { state: 'prompt', canAskAgain: true };
  }

  // 原生平台：未安装专属麦克风插件时，回退到 localStorage 持久化标记，
  // 允许用户在 WebView 中通过标准 getUserMedia 获取音频流。
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('mic_web_granted') : null;
    if (stored === 'true') {
      return { state: 'granted', canAskAgain: true };
    }
  } catch { /* ignore */ }
  return { state: 'prompt', canAskAgain: true };
}

export async function requestMicrophonePermission(): Promise<PermissionQueryResult> {
  if (!Capacitor.isNativePlatform()) {
    return queryMicrophonePermission();
  }
  
  // 原生平台：通过由于插件缺失而触发的显式失败，来引导上层 UI 提示而非静默卡死。
  console.error('[NativePermissionError] Cannot request microphone permission: native plugin missing.');
  return { state: 'denied', canAskAgain: true };
}
