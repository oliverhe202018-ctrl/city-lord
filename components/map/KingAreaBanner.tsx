import React, { useEffect, useState } from 'react';
import type { ViewportKingData } from './AMapView';

interface Props {
  king: ViewportKingData | null;
}

export const KingAreaBanner = React.memo(function KingAreaBanner({ king }: Props) {
  const [topOffset, setTopOffset] = useState('54px');

  useEffect(() => {
    const updateOffset = () => {
      let offset = 0;
      const mh = document.getElementById('map-header');
      const ms = document.getElementById('mode-switcher');
      
      // mode-switcher's bottom already accounts for the map-header if it has margin-top
      if (ms) {
        offset = ms.getBoundingClientRect().bottom;
      } else if (mh) {
        offset = mh.getBoundingClientRect().bottom;
      }
      
      if (offset > 0) {
        // Add minimal 8px padding
        setTopOffset(`${offset + 8}px`);
      } else {
        setTopOffset('54px');
      }
    };

    updateOffset();
    
    let observer: ResizeObserver | null = null;
    if (typeof window !== 'undefined' && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateOffset);
      const ms = document.getElementById('mode-switcher');
      if (ms) observer.observe(ms);
      const mh = document.getElementById('map-header');
      if (mh) observer.observe(mh);
    }
    
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [king]);

  if (!king) return null;
  const areaM2 = king.totalArea ? Math.round(king.totalArea) : 0;
  
  return (
    <div
      style={{
        position: 'absolute',
        top: topOffset,
        left: 0,
        width: '100%',
        height: 38,
        zIndex: 30,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex',
        alignItems: 'center',
        paddingInline: 12,
        gap: 8,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        transition: 'top 0.3s ease',
      }}
    >
      {/* 左：王冠 */}
      <span style={{ fontSize: 15, lineHeight: 1 }}>👑</span>

      {/* 中：昵称 */}
      <span
        style={{
          flex: 1,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          letterSpacing: 0.3,
        }}
      >
        区域霸主 · {king.nickname}
      </span>

      {/* 右：面积 */}
      <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
        {areaM2.toLocaleString()}
        <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 10 }}> m²</span>
      </span>

      {/* 头像 */}
      {king.avatarUrl ? (
        <img
          src={king.avatarUrl}
          alt={king.nickname}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '1.5px solid #fbbf24',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#92400e',
            border: '1.5px solid #fbbf24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {king.nickname?.slice(0, 1) || '王'}
        </div>
      )}
    </div>
  );
});
