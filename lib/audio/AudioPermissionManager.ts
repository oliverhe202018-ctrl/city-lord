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

  // 原生平台：经核实当前项目未安装专用麦克风插件包。
  // ⚠️ 极其重要：在此环境下严禁调用 getUserMedia 以防 WebView 渲染进程因挂起的权限请求而死锁卡住。
  console.error('[NativePermissionError] No microphone plugin available. Blocking implicit getUserMedia call to prevent WebView hang.');
  return { state: 'denied', canAskAgain: true };
}

export async function requestMicrophonePermission(): Promise<PermissionQueryResult> {
  if (!Capacitor.isNativePlatform()) {
    return queryMicrophonePermission();
  }
  
  // 原生平台：通过由于插件缺失而触发的显式失败，来引导上层 UI 提示而非静默卡死。
  console.error('[NativePermissionError] Cannot request microphone permission: native plugin missing.');
  return { state: 'denied', canAskAgain: true };
}
