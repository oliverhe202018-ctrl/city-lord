"use client";
import React, { useEffect, useState } from 'react';
import type { ViewportKingData } from './AMapView';

interface Props {
  king: ViewportKingData | null;
}

export const KingAreaBanner = React.memo(function KingAreaBanner({ king }: Props) {
  const [topOffset, setTopOffset] = useState(92);

  useEffect(() => {
    const update = () => {
      // 1. Follow precise anchor
      const anchor = document.getElementById('mode-switcher-anchor');
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        if (rect.top > 0) {
          setTopOffset(rect.top + 4); // 4px visual gap
          return;
        }
      }

      // 2. Fallback to mode-switcher bottom minus padding
      const ms = document.getElementById('mode-switcher');
      if (ms) {
        const rect = ms.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(ms);
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const visualBottom = rect.bottom - paddingBottom;
        if (visualBottom > 0) {
          setTopOffset(visualBottom + 4);
          return;
        }
      }
    };

    // First frame update
    const raf = requestAnimationFrame(update);

    // Watch for size/layout changes
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      const anchor = document.getElementById('mode-switcher-anchor');
      const ms = document.getElementById('mode-switcher');
      if (anchor) ro.observe(anchor);
      else if (ms) ro.observe(ms);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  if (!king) return null;
  const areaM2 = king.totalArea ? Math.round(king.totalArea) : 0;

  return (
    <div style={{
      position: 'absolute',
      top: topOffset,
      left: 12,
      right: 12,
      zIndex: 30,
      borderRadius: 20,
      background: 'rgba(0,0,0,0.82)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      padding: '5px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
    }}>
      {/* Row 1：左-头像 | 中-昵称（绝对居中）| 右-面积 */}
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative', height: 28 }}>
        {/* 左：头像固定 */}
        <div style={{ position: 'absolute', left: 0 }}>
          {king.avatarUrl ? (
            <img src={king.avatarUrl} alt={king.nickname}
              style={{ width: 26, height: 26, borderRadius: '50%',
                border: '1.5px solid #fbbf24', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 26, height: 26, borderRadius: '50%',
              background: '#92400e', border: '1.5px solid #fbbf24',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 10, fontWeight: 700 }}>
              {king.nickname?.slice(0, 1) || '王'}
            </div>
          )}
        </div>
        {/* 中：昵称绝对居中 */}
        <div style={{ position: 'absolute', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600,
            maxWidth: 120, overflow: 'hidden', whiteSpace: 'nowrap',
            textOverflow: 'ellipsis', textAlign: 'center' }}>
            {king.nickname}
          </span>
        </div>
        {/* 右：面积固定宽度靠右 */}
        <div style={{ position: 'absolute', right: 0,
          display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700,
            whiteSpace: 'nowrap' }}>
            {areaM2.toLocaleString()}
            <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 10 }}> m²</span>
          </span>
        </div>
      </div>

      {/* Row 2：👑 区域霸主 👑，宽度限制 66% 居中 */}
      <div style={{ width: '66%', margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontSize: 11 }}>👑</span>
        <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700,
          letterSpacing: 2 }}>区域霸主</span>
        <span style={{ fontSize: 11 }}>👑</span>
      </div>
    </div>
  );
});
