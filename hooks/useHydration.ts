import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';

// 模块级变量，保证热重载和重渲染时状态不丢失
let globalHydrated = false;

// 对外暴露重置函数，用于登出、切号、清空缓存等场景
export const resetGlobalHydration = () => {
  globalHydrated = false;
};

export const useHydration = () => {
  // 同步初始化 state，防止任何组件重新挂载时出现 1 帧的 false 闪烁
  const [hydrated, setHydrated] = useState(() => {
    if (globalHydrated || useGameStore.persist.hasHydrated()) {
      globalHydrated = true;
      return true;
    }
    return false;
  });

  useEffect(() => {
    let mounted = true;

    if (globalHydrated || useGameStore.persist.hasHydrated()) {
      globalHydrated = true;
      if (mounted && !hydrated) {
        setHydrated(true);
      }
      return;
    }

    const unsub = useGameStore.persist.onFinishHydration(() => {
      globalHydrated = true;
      if (mounted) {
        setHydrated(true);
      }
    });

    return () => {
      mounted = false;
      if (typeof unsub === 'function') {
        try {
          unsub();
        } catch (error) {
          console.error('Error during hydration cleanup:', error);
        }
      }
    };
  }, [hydrated]);

  return hydrated;
};