"use client";

import React, { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

interface VirtualListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: (index: number) => number;
  onEndReached?: () => void;
  className?: string;
  emptyComponent?: React.ReactNode;
  // Threshold in pixels to trigger onEndReached
  endReachedThreshold?: number;
}

export function VirtualList<T>({
  data,
  renderItem,
  estimateSize = () => 50,
  onEndReached,
  className,
  emptyComponent,
  endReachedThreshold = 200,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateSize,
    overscan: 5, // Render 5 extra items to prevent blank space during fast scroll
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Infinite Scroll Logic
  useEffect(() => {
    const parentElement = parentRef.current;
    if (!parentElement || !onEndReached) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = parentElement;
      // If we are close to bottom
      if (scrollHeight - scrollTop - clientHeight < endReachedThreshold) {
        onEndReached();
      }
    };

    parentElement.addEventListener("scroll", handleScroll);
    return () => {
      parentElement.removeEventListener("scroll", handleScroll);
    };
  }, [onEndReached, endReachedThreshold]);

  if (data.length === 0) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center", className)}>
        {emptyComponent || <div className="text-muted-foreground text-sm">暂无数据</div>}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn("h-full w-full overflow-y-auto contain-strict", className)}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full"
            style={{
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(data[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
