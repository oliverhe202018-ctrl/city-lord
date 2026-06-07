import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { globalHydrated, setGlobalHydrated } from '@/store/hydrationState';

export const useHydration = () => {
  // 同步初始化 state，防止任何组件重新挂载时出现 1 帧的 false 闪烁
  const [hydrated, setHydrated] = useState(() => {
    if (globalHydrated || useGameStore.persist.hasHydrated()) {
      setGlobalHydrated();
      return true;
    }
    return false;
  });

  useEffect(() => {
    let mounted = true;

    // 如果已经 hydrated，直接同步
    if (globalHydrated || useGameStore.persist.hasHydrated()) {
      setGlobalHydrated();
      if (mounted && !hydrated) setHydrated(true);
      return;
    }

    // 监听正常 hydration 完成事件
    const unsub = useGameStore.persist.onFinishHydration(() => {
      setGlobalHydrated();
      if (mounted) setHydrated(true);
    });

    // 关键修复：超时保底
    // 首次安装时 localStorage 为空，persist 可能在 onFinishHydration
    // 注册之前已完成，导致回调永远不触发，hydrated 永远是 false，
    // GPS watch 永远不启动，UI 卡在「定位中」。
    // 500ms 后强制置 true，确保定位系统能启动。
    const fallbackTimer = setTimeout(() => {
      if (mounted && !globalHydrated) {
        console.warn('[useHydration] Hydration timeout fallback triggered — forcing hydrated=true');
        setGlobalHydrated();
        if (mounted) setHydrated(true);
      }
    }, 500);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      if (typeof unsub === 'function') {
        try {
          unsub();
        } catch (error) {
          console.error('Error during hydration cleanup:', error);
        }
      }
    };
  }, []); // 空依赖数组：只注册一次，避免 unsub 被提前清理导致回调丢失

  return hydrated;
};
