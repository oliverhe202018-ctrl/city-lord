"use client";

import { useEffect } from 'react';

/**
 * 沉浸式模式 Hook
 * 屏蔽浏览器默认交互行为，打造原生游戏体验
 */
export function useImmersiveMode() {
  useEffect(() => {
    // 仅在生产环境或明确要求时生效
    // 为了方便开发调试，开发环境下允许 F12 和右键，除非手动开启测试
    const isProduction = process.env.NODE_ENV === 'production';
    
    const preventDefault = (e: Event) => {
      e.preventDefault();
    };

    const handleContextMenu = (e: MouseEvent) => {
      // 允许输入框右键（可选，视需求而定，这里统一屏蔽以保持沉浸感，或者放行 input）
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 仅在生产环境拦截调试快捷键
      if (!isProduction) return;

      // F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
      // Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
      }
      // Ctrl+P (Print)
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
      }
      // Ctrl+S (Save)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
      }
    };

    const handleDragStart = (e: DragEvent) => {
      // 禁止拖拽图片等资源
      e.preventDefault();
    };

    // 添加事件监听
    // 1. 右键菜单
    document.addEventListener('contextmenu', handleContextMenu);
    
    // 2. 拖拽开始
    document.addEventListener('dragstart', handleDragStart);
    
    // 3. 键盘快捷键
    document.addEventListener('keydown', handleKeyDown);

    // 4. 阻止 iOS 双指缩放 (通过 meta viewport user-scalable=no 已经处理，这里作为补充)
    // 注意：touchmove preventDefault 会影响滚动，需谨慎使用。
    // 这里主要依靠 CSS touch-action: manipulation

    return () => {
      // 清理监听
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
