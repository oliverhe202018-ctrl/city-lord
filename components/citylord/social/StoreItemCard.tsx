"use client"

import React from "react";
import { Gift } from "lucide-react";

// Use the existing item structure from the backend, but map stock to inventory_count if needed.
// However, the user's snippet uses 'stock', so we'll expect that or map it in the parent.
export interface StoreItem {
  id: string;
  name: string;
  price: number;
  inventory_count: number;
  description?: string;
  // User used 'stock' in the prompt, we'll support it for compatibility if we map it
  stock?: number; 
}

interface StoreItemCardProps {
  item: StoreItem;
  userPoints: number;
  isRedeeming?: boolean;
  onRedeem: (item: StoreItem) => void;
}

export function StoreItemCard({ item, userPoints, isRedeeming, onRedeem }: StoreItemCardProps) {
  // Map inventory_count to stock for the UI logic as requested
  const stock = item.stock ?? item.inventory_count;
  const canAfford = userPoints >= item.price;
  const isSoldOut = stock <= 0;

  return (
    <div className="bg-[#121827] border border-gray-800 rounded-xl overflow-hidden flex flex-col relative transition-all active:scale-95">
      {/* 库存标签 (右上角绝对定位) */}
      {stock > 0 && stock <= 10 && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-red-400 z-10">
          仅剩 {stock}
        </div>
      )}

      {/* 图片占位 (1:1 比例) - 原有礼物小图标区域扩展 */}
      <div className="w-full aspect-square bg-gray-800 flex items-center justify-center">
        <Gift className="w-10 h-10 text-purple-500/40" />
      </div>

      {/* 底部信息与按钮 */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-white font-medium text-sm line-clamp-1">{item.name}</h3>
          {item.description && (
            <p className="text-[10px] text-gray-500 line-clamp-2 leading-tight">
              {item.description}
            </p>
          )}
        </div>

        <button
          onClick={() => onRedeem(item)}
          disabled={!canAfford || isSoldOut || isRedeeming}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
            isSoldOut
              ? "bg-gray-800 text-gray-600 cursor-not-allowed"
              : !canAfford
              ? "bg-gray-800/80 text-gray-500 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/30"
          }`}
        >
          {isSoldOut ? (
            "已售罄"
          ) : !canAfford ? (
            `积分不足 (${item.price})`
          ) : isRedeeming ? (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>处理中...</span>
            </div>
          ) : (
            <>
              <span className="text-yellow-500 text-xs">🪙</span> {item.price}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
