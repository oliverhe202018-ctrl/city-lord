"use client";
import React from 'react';
import type { ViewportKingData } from './AMapView';
import { ClubInfoBar } from './ClubInfoBar';
import { useMapInteraction } from '@/components/map/MapInteractionContext';

interface Props {
  king: ViewportKingData | null;
  mapDisplayMode: 'personal' | 'faction' | 'club';
  selectedTerritoryId: string | null;
}

export const KingAreaBanner = React.memo(function KingAreaBanner({ king, mapDisplayMode, selectedTerritoryId }: Props) {
  if (!king) return null;

  const isClubMode = mapDisplayMode === 'club';

  // Club Mode: 使用 selectedTerritory.ownerClub 作为数据源
  if (isClubMode) {
    if (!selectedTerritoryId) return null;
    return <ClubModeBanner />;
  }

  // Personal / Faction Mode: keep original behavior
  const displayAvatar = king.avatarUrl;
  const displayName = king.nickname;
  const displayArea = king.totalArea;
  
  const areaKm2 = (displayArea / 1000000).toFixed(2);

  return (
    <div style={{ marginTop: 4, zIndex: 30, borderRadius: 20, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", padding: "5px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", position: "relative", height: 28 }}>
        {/* 左：头像 */}
        <div style={{ position: "absolute", left: 0 }}>
          {displayAvatar ? (
            <img src={displayAvatar} alt={displayName} style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px solid #fbbf24", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#92400e", border: "1.5px solid #fbbf24", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700 }}>
              {displayName?.slice(0, 1) || '王'}
            </div>
          )}
        </div>
        {/* 中：名称绝对居中 */}
        <div style={{ position: "absolute", left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, maxWidth: 120, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", textAlign: "center" }}>
            {displayName}
          </span>
        </div>
        {/* 右：面积 */}
        <div style={{ position: "absolute", right: 0, display: "flex", alignItems: "center" }}>
          <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            {areaKm2}
            <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 10 }}> km²</span>
          </span>
        </div>
      </div>

      {/* Row 2：领地霸主标识 */}
      <div style={{ width: "66%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span style={{ fontSize: 11 }}>👑</span>
        <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>
          视野霸主
        </span>
        <span style={{ fontSize: 11 }}>👑</span>
      </div>
    </div>
  );
});

/**
 * Club Mode 子组件：使用 useMapInteraction 获取 selectedTerritory.ownerClub。
 * 必须在 MapRoot/MapInteractionProvider 内部渲染。
 */
function ClubModeBanner() {
  const { selectedTerritory } = useMapInteraction();
  const ownerClub = selectedTerritory?.ownerClub;

  if (!ownerClub) return null;

  return (
    <ClubInfoBar
      clubId={ownerClub.id}
      clubName={ownerClub.name}
      clubLogoUrl={ownerClub.logoUrl}
    />
  );
}