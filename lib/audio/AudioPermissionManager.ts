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

  // 原生平台：尝试使用 @capacitor/microphone（如已安装）
  try {
    const { Microphone } = await import('@capacitor-community/microphone');
    const result = await Microphone.checkPermissions();
    const s = result.microphone;
    return {
      state: s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt',
      canAskAgain: s !== 'denied',
    };
  } catch {
    // 插件未安装，降级为 unknown，由调用方通过 getUserMedia 判断
    return { state: 'unknown', canAskAgain: true };
  }
}

export async function requestMicrophonePermission(): Promise<PermissionQueryResult> {
  if (!Capacitor.isNativePlatform()) {
    return queryMicrophonePermission();
  }
  try {
    const { Microphone } = await import('@capacitor-community/microphone');
    const result = await Microphone.requestPermissions();
    const s = result.microphone;
    return {
      state: s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt',
      canAskAgain: s !== 'denied',
    };
  } catch {
    return { state: 'unknown', canAskAgain: true };
  }
}
