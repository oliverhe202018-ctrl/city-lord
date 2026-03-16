/**
 * AudioPlayer —— 全局单例音频管理器
 * 负责：独占播放 / 播放队列 / 倍速控制 / 播放完成回调 / 预热缓存
 */

export type PlaybackRate = 1 | 1.5 | 2;

export interface QueueItem {
  url: string;
  messageId: string;
  onEnd?: (messageId: string) => void;
}

// ---------- 单例状态 ----------
let currentAudio: HTMLAudioElement | null = null;
let currentMessageId: string | null = null;
let currentRate: PlaybackRate = 1;
let queue: QueueItem[] = [];
let isProcessingQueue = false;

// ---------- 预热缓存 ----------
// key = messageId，value = 已经 preload 的 Audio 对象
const preloadCache = new Map<string, HTMLAudioElement>();

/**
 * 预热注册：组件挂载时调用
 * 立即创建 Audio 对象并开始加载 metadata，
 * 这样用户点击时 Audio 已经 ready，play() 几乎零延迟
 */
export function registerPreload(messageId: string, url: string): void {
  if (preloadCache.has(messageId)) return;

  const audio = new Audio(url);
  audio.preload = 'metadata';
  preloadCache.set(messageId, audio);
}

/**
 * URL 刷新：signed URL 过期后更新缓存里的 Audio 对象
 */
export function refreshPreload(messageId: string, newUrl: string): void {
  const old = preloadCache.get(messageId);
  if (old) {
    old.src = '';
  }
  const audio = new Audio(newUrl);
  audio.preload = 'metadata';
  preloadCache.set(messageId, audio);
}

/**
 * 注销预热（组件卸载时调用，防止内存泄漏）
 */
export function unregisterPreload(messageId: string): void {
  const audio = preloadCache.get(messageId);
  if (audio) {
    audio.src = '';
    preloadCache.delete(messageId);
  }
}

// ---------- 状态订阅 ----------
type StateListener = (playingMessageId: string | null, rate: PlaybackRate) => void;
const listeners = new Set<StateListener>();

function notifyListeners() {
  listeners.forEach((fn) => fn(currentMessageId, currentRate));
}

export function subscribeAudioState(fn: StateListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCurrentPlayingId(): string | null {
  return currentMessageId;
}

export function getCurrentRate(): PlaybackRate {
  return currentRate;
}

/**
 * 暴露当前 Audio 对象，供组件读取 currentTime 做精准进度同步
 */
export function getCurrentAudio(): HTMLAudioElement | null {
  return currentAudio;
}

// ---------- 内部工具 ----------
function clearMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.setActionHandler('pause', null);
  navigator.mediaSession.setActionHandler('play', null);
  navigator.mediaSession.setActionHandler('stop', null);
}

function setupMediaSession(item: QueueItem, audio: HTMLAudioElement) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: '语音消息',
    artist: '正在播放',
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    audio.pause();
    currentMessageId = null;
    notifyListeners();
  });

  navigator.mediaSession.setActionHandler('play', () => {
    audio.play().catch(console.error);
    currentMessageId = item.messageId;
    notifyListeners();
  });

  navigator.mediaSession.setActionHandler('stop', () => {
    stopAll();
  });
}

function stopCurrent() {
  if (currentAudio) {
    console.log('[AudioPlayer] stopping current audio', currentMessageId);
    currentAudio.pause();
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.oncanplay = null;
    // 释放资源，防止内存泄漏和实例竞争
    currentAudio.src = '';
    currentAudio = null;
  }
  currentMessageId = null;
  clearMediaSession();
  notifyListeners();
}

// ---------- 核心播放 ----------
async function playItem(item: QueueItem): Promise<void> {
  stopCurrent();

  // 优先从预热缓存取，缓存命中则零延迟
  const cached = preloadCache.get(item.messageId);
  const audio = cached ?? new Audio(item.url);

  console.log('[AudioPlayer] playItem start', {
    messageId: item.messageId,
    url: item.url,
    cached: !!cached,
    readyState: audio.readyState,
    paused: audio.paused
  });

  // 确保 src 正确（URL 刷新后 cached.src 已更新）
  if (!cached) {
    audio.preload = 'auto';
    // 仅对非本地地址添加 crossOrigin
    const isRemote = item.url.startsWith('http') && !item.url.includes(window.location.host);
    if (isRemote) {
      audio.crossOrigin = 'anonymous';
    }
  }

  // 明确初始化音频状态，防止静音或音量为 0
  audio.volume = 1;
  audio.muted = false;
  audio.playbackRate = currentRate;
  
  currentAudio = audio;
  currentMessageId = item.messageId;
  notifyListeners();

  setupMediaSession(item, audio);

  return new Promise((resolve) => {
    audio.onended = () => {
      console.log('[AudioPlayer] playback ended', item.messageId);
      clearMediaSession();
      item.onEnd?.(item.messageId);
      currentAudio = null;
      currentMessageId = null;
      notifyListeners();
      resolve();
    };

    audio.onerror = (e) => {
      console.error('[AudioPlayer] HTMLAudioElement error', {
        messageId: item.messageId,
        url: audio.src,
        error: audio.error
      });
      clearMediaSession();
      currentAudio = null;
      currentMessageId = null;
      notifyListeners();
      resolve();
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('[AudioPlayer] play() success', item.messageId);
        })
        .catch((e) => {
          console.error('[AudioPlayer] play() rejected', {
            messageId: item.messageId,
            url: audio.src,
            error: e.message,
            readyState: audio.readyState,
            volume: audio.volume,
            muted: audio.muted
          });
          clearMediaSession();
          currentAudio = null;
          currentMessageId = null;
          notifyListeners();
          resolve();
        });
    } else {
      console.log('[AudioPlayer] play() called (legacy synchronous)');
      resolve();
    }
  });
}

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  while (queue.length > 0) {
    const item = queue.shift()!;
    await playItem(item);
  }
  isProcessingQueue = false;
}

// ---------- 公开 API ----------

export function playExclusive(item: QueueItem) {
  queue = [];
  isProcessingQueue = false;
  stopCurrent();
  queue.push(item);
  processQueue();
}

export function enqueueItems(items: QueueItem[]) {
  if (items.length === 0) return;
  queue.push(...items);
  processQueue();
}

export function pauseCurrent() {
  if (currentAudio) {
    currentAudio.pause();
    currentMessageId = null;
    notifyListeners();
  }
}

export function resumeCurrent(messageId: string) {
  if (currentAudio) {
    currentMessageId = messageId;
    currentAudio.play().catch(console.error);
    notifyListeners();
  }
}

export function stopAll() {
  queue = [];
  isProcessingQueue = false;
  stopCurrent();
}

export function setPlaybackRate(rate: PlaybackRate) {
  currentRate = rate;
  if (currentAudio) {
    currentAudio.playbackRate = rate;
  }
  notifyListeners();
}
