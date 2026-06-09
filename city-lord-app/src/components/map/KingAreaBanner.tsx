"use client";
import React from 'react';
import type { ViewportKingData } from './AMapView';

import { useGameStore } from '@/store/useGameStore';
import { useMapDisplayStore } from '@/store/useMapDisplayStore';

interface Props {
  king: ViewportKingData | null;
}

export const KingAreaBanner = React.memo(function KingAreaBanner({ king }: Props) {
  const { mapDisplayMode } = useMapDisplayStore();
  const selectedTerritoryId = useGameStore(state => state.selectedTerritoryId);
  if (!king) return null;

  const isClubMode = mapDisplayMode === 'club';
  if (isClubMode && !selectedTerritoryId) return null;

  const displayAvatar = isClubMode ? king.clubAvatarUrl : king.avatarUrl;
  const displayName = isClubMode ? (king.clubName || '未知俱乐部') : king.nickname;
  const displayArea = isClubMode ? (king.clubTotalArea || 0) : king.totalArea;
  
  const areaKm2 = (displayArea / 1000000).toFixed(2);

  return (
    <div style={{
      marginTop: 4,
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
      {/* Row 1：左-头像 | 中-昵称/俱乐部名（绝对居中）| 右-面积 */}
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative', height: 28 }}>
        {/* 左：头像固定 */}
        <div style={{ position: 'absolute', left: 0 }}>
          {displayAvatar ? (
            <img src={displayAvatar} alt={displayName}
              style={{ width: 26, height: 26, borderRadius: '50%',
                border: '1.5px solid #fbbf24', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 26, height: 26, borderRadius: '50%',
              background: '#92400e', border: '1.5px solid #fbbf24',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 10, fontWeight: 700 }}>
              {displayName?.slice(0, 1) || (isClubMode ? 'C' : '王')}
            </div>
          )}
        </div>
        {/* 中：名称绝对居中 */}
        <div style={{ position: 'absolute', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600,
            maxWidth: 120, overflow: 'hidden', whiteSpace: 'nowrap',
            textOverflow: 'ellipsis', textAlign: 'center' }}>
            {displayName}
          </span>
        </div>
        {/* 右：面积固定宽度靠右 */}
        <div style={{ position: 'absolute', right: 0,
          display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700,
            whiteSpace: 'nowrap' }}>
            {areaKm2}
            <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 10 }}> km²</span>
          </span>
        </div>
      </div>

      {/* Row 2：👑 区域霸主/俱乐部霸主 👑，宽度限制 66% 居中 */}
      <div style={{ width: '66%', margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontSize: 11 }}>👑</span>
        <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700,
          letterSpacing: 2 }}>{isClubMode ? '所属俱乐部' : '区域霸主'}</span>
        <span style={{ fontSize: 11 }}>👑</span>
      </div>
    </div>
  );
});

