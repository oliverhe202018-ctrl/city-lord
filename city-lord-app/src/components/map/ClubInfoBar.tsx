"use client";

import React from "react";
import type { ViewportKingData } from "./AMapView";

interface Props {
  king: ViewportKingData;
}

/**
 * Club Mode 顶部横条。
 * 显示规则：
 * - 点击领地后：显示被点击领地所属俱乐部名称 + 总面积
 * - 未选中领地：由父组件 KingAreaBanner 控制隐藏
 * - 非 Club Mode：由父组件控制不渲染
 *
 * 注意：MVP 阶段数据来源为 ViewportKingData（视口霸主）。
 * 后续可改为从 selectedTerritory 直接获取。
 */
export const ClubInfoBar = React.memo(function ClubInfoBar({ king }: Props) {
  const clubName = king.clubName || "未知俱乐部";
  const areaKm2 = ((king.clubTotalArea || 0) / 1_000_000).toFixed(2);
  const avatarUrl = king.clubAvatarUrl;

  return (
    <div
      style={{
        marginTop: 4,
        zIndex: 30,
        borderRadius: 20,
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "5px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", position: "relative", height: 28 }}
      >
        {/* 左：俱乐部头像 */}
        <div style={{ position: "absolute", left: 0 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={clubName}
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                border: "1.5px solid #fbbf24",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "#92400e",
                border: "1.5px solid #fbbf24",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {clubName.slice(0, 1) || "C"}
            </div>
          )}
        </div>
        {/* 中：俱乐部名称绝对居中 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              maxWidth: 120,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              textAlign: "center",
            }}
          >
            {clubName}
          </span>
        </div>
        {/* 右：总面积 */}
        <div style={{ position: "absolute", right: 0, display: "flex", alignItems: "center" }}>
          <span
            style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
          >
            {areaKm2}
            <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 10 }}> km²</span>
          </span>
        </div>
      </div>

      {/* Row 2：俱乐部标识 */}
      <div
        style={{
          width: "66%",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 11 }}>🏰</span>
        <span
          style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700, letterSpacing: 2 }}
        >
          所属俱乐部
        </span>
        <span style={{ fontSize: 11 }}>🏰</span>
      </div>
    </div>
  );
});