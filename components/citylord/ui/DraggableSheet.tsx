"use client";

import { ReactNode, useRef, useState, useEffect } from 'react';

interface DraggableSheetProps {
  children: ReactNode;
}

export function DraggableSheet({ children }: DraggableSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(60); // 默认收起状态，只显示拖动手柄
  const [isExpanded, setIsExpanded] = useState(false);

  // 更新 sheet 高度以适应内容，但不小于最小高度
  useEffect(() => {
    if (contentRef.current && !isDragging && !isExpanded) {
      const contentHeight = contentRef.current.scrollHeight;
      // 最大高度为屏幕高度的 70%，但不大于 600px
      const maxHeight = Math.min(window.innerHeight * 0.7, 600);
      const minHeight = 60; // 收起状态的最小高度
      const expandedMinHeight = 120; // 展开状态的最小高度

      const targetHeight = Math.min(Math.max(contentHeight + 32, expandedMinHeight), maxHeight);

      if (isExpanded && targetHeight > sheetHeight) {
        setSheetHeight(targetHeight);
      } else if (!isExpanded && sheetHeight > minHeight) {
        setSheetHeight(minHeight);
      }
    }
  }, [children, isExpanded, isDragging, sheetHeight]);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    setStartY('touches' in e ? e.touches[0].clientY : e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = startY - clientY;

    // 向上拖动增加高度，向下拖动减小高度
    const maxHeight = window.innerHeight * 0.7;
    const minHeight = 60;
    const newHeight = Math.min(Math.max(sheetHeight + deltaY, minHeight), maxHeight);

    setCurrentY(clientY);
    setSheetHeight(newHeight);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setStartY(0);
    setCurrentY(0);

    // 拖动结束后，根据当前高度判断是展开还是收起
    const minHeight = 60;
    const midPoint = (minHeight + (window.innerHeight * 0.7)) / 2;

    if (sheetHeight < midPoint) {
      setSheetHeight(minHeight);
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
    }
  };

  // 点击拖动手柄切换展开/收起状态
  const handleHandleClick = () => {
    if (isExpanded) {
      setSheetHeight(60);
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30">
      <div
        ref={sheetRef}
        className="mx-auto w-full max-w-md overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#1e293b] shadow-2xl"
        style={{ height: `${sheetHeight}px`, transition: isDragging ? 'none' : 'height 0.3s ease-out' }}
      >
        {/* Handle bar */}
        <div
          className="mx-auto h-8 flex items-center justify-center cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          onClick={handleHandleClick}
        >
          <div className="h-1 w-12 rounded-full bg-white/20" />
        </div>

        {/* Content - 只在展开时显示 */}
        {isExpanded && (
          <div
            ref={contentRef}
            className="overflow-y-auto px-4 pb-4"
            style={{ height: `${sheetHeight - 32}px` }} // 32px for handle bar area
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default DraggableSheet;
