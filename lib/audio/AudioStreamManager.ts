const CONSTRAINTS_LIST: MediaStreamConstraints[] = [
  { audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } },
  { audio: { echoCancellation: true, noiseSuppression: true } },
  { audio: true },
];

export type StreamResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; reason: 'permission-denied' | 'not-found' | 'unknown'; error: unknown };

export async function acquireAudioStream(): Promise<StreamResult> {
  for (const constraints of CONSTRAINTS_LIST) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return { ok: true, stream };
    } catch (err: any) {
      console.log('[AudioStreamManager] getUserMedia exception caught:', err, 'error.name:', err?.name, 'error.message:', err?.message);
      const isDenied =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.name === 'SecurityError';
      const notFound =
        err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError';

      if (isDenied) {
        return { ok: false, reason: 'permission-denied', error: err };
      }
      if (notFound) {
        return { ok: false, reason: 'not-found', error: err };
      }
      // 其他错误继续尝试下一个 constraints
    }
  }
  return { ok: false, reason: 'unknown', error: new Error('All constraints failed') };
}

export function releaseStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

// 按平台优先级排列的 codec 候选列表
const CODEC_PRIORITY = [
  'audio/webm;codecs=opus',  // Android Chrome / WebView 首选
  'audio/mp4',               // iOS WKWebView 首选
  'audio/webm',              // 通用 fallback
  'audio/ogg;codecs=opus',   // 桌面浏览器 fallback
];

/**
 * 返回当前环境支持的最优 mimeType
 * 若全部不支持则返回空字符串（由浏览器自行决定）
 */
export function selectBestMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const codec of CODEC_PRIORITY) {
    if (MediaRecorder.isTypeSupported(codec)) {
      return codec;
    }
  }
  return '';
}

/**
 * 返回推荐的 MediaRecorder options
 * mimeType 为空时不传入该字段，避免部分 WebView 报错
 */
export function getMediaRecorderOptions(): MediaRecorderOptions {
  const mimeType = selectBestMimeType();
  return mimeType ? { mimeType } : {};
}
