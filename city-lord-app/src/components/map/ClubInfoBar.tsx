"use client";

import React, { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api/client";

interface Props {
  clubId: string;
  clubName: string;
  clubLogoUrl: string | null;
}

/**
 * Club Mode 顶部横条。
 * 数据来源：selectedTerritory.ownerClub（被点击领地所属俱乐部）。
 * total_area 从 PR 1 API 异步获取。
 *
 * 显示规则：
 * - 点击领地后：显示被点击领地所属俱乐部名称 + 总面积
 * - 未选中领地：由父组件 KingAreaBanner 控制隐藏
 * - 非 Club Mode：由父组件控制不渲染
 */
export const ClubInfoBar = React.memo(function ClubInfoBar({ clubId, clubName, clubLogoUrl }: Props) {
  const [totalArea, setTotalArea] = useState<number | null>(null);
  const fetchedClubIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 相同 clubId 不重复请求
    if (!clubId || clubId === fetchedClubIdRef.current) return;
    fetchedClubIdRef.current = clubId;

    let cancelled = false;

    apiClient
      .get<{ total_area: number }>(`/api/club/get-club-public-profile?clubId=${clubId}`)
      .then((res) => {
        if (!cancelled && res.data) {
          setTotalArea(res.data.total_area ?? 0);
        }
      })
      .catch(() => {
        // 失败时保持 null，UI 显示 "--"
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const areaDisplay = totalArea !== null
    ? (totalArea / 1_000_000).toFixed(2)
    : "--";

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
      <div style={{ display: "flex", alignItems: "center", position: "relative", height: 28 }}>
        {/* 左：俱乐部头像 */}
        <div style={{ position: "absolute", left: 0 }}>
          {clubLogoUrl ? (
            <img
              src={clubLogoUrl}
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
        {/* 中：俱乐部名称 */}
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
          <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            {areaDisplay}
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
        <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>
          所属俱乐部
        </span>
        <span style={{ fontSize: 11 }}>🏰</span>
      </div>
    </div>
  );
});