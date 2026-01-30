import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';

export const useHydration = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    // 检查是否已经有持久化状态
    if (useGameStore.persist.hasHydrated()) {
      if (mounted) {
        setHydrated(true);
      }
      return;
    }

    // 设置 hydration 完成回调
    const unsub = useGameStore.persist.onFinishHydration(() => {
      if (mounted) {
        setHydrated(true);
      }
    });

    return () => {
      mounted = false;
      // 安全清理：只存在时才调用
      if (typeof unsub === 'function') {
        try {
          unsub();
        } catch (error) {
          console.error('Error during hydration cleanup:', error);
        }
      }
    };
  }, []);

  return hydrated;
};