"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRegion } from "@/contexts/RegionContext";
import { baseCities, BaseCity } from "@/data/cities";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { X, Search, MapPin, Users, TrendingUp, Sparkles, ArrowRight, Check } from "lucide-react"
import { LoadingSpinner } from "@/components/citylord/loading-screen"

/**
 * 城市切换抽屉组件
 */
export function CityDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { region, setRegion } = useRegion();
  const [searchQuery, setSearchQuery] = useState("");
  const [openCollapsibles, setOpenCollapsibles] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<BaseCity | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  // 重置状态
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("")
      setSelectedCity(null)
      setIsSwitching(false)
    }
  }, [isOpen])

  // Filter cities and districts based on search query
  const filteredData = useMemo(() => {
    return baseCities.map(city => {
      const districts = city.districts?.filter(district => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return district.name.toLowerCase().includes(query) || 
               district.pinyin.toLowerCase().includes(query) || 
               district.abbr.toLowerCase().includes(query);
      }) || [];

      const cityMatches = city.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                          city.pinyin.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                          city.abbr.toLowerCase().includes(searchQuery.toLowerCase().trim());

      return {
        ...city,
        districts,
        matches: cityMatches || districts.length > 0
      };
    }).filter(city => city.matches);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery) {
      const cityNames = filteredData
        .filter(c => c.districts.length > 0)
        .map(c => c.adcode);
      setOpenCollapsibles(cityNames);
    } else {
      setOpenCollapsibles([]);
    }
  }, [searchQuery, filteredData]);

  // Handle region selection
  const handleSelectRegion = (selectedRegion: BaseCity, type: 'city' | 'county') => {
    setRegion({
      regionType: type,
      cityName: type === 'city' ? selectedRegion.name : region?.cityName || '',
      countyName: type === 'county' ? selectedRegion.name : undefined,
      province: region?.province,
      adcode: selectedRegion.adcode,
      centerLngLat: selectedRegion.center,
    });
    onClose();
  };

  // 高亮匹配文字
  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;
    
    // 简单的包含匹配高亮
    const cleanQuery = query.replace(/(市|区|县|自治州)$/, "");
    if (text.toLowerCase().includes(cleanQuery.toLowerCase())) {
      const parts = text.split(new RegExp(`(${cleanQuery})`, 'gi'));
      return (
        <span>
          {parts.map((part, i) => 
            part.toLowerCase() === cleanQuery.toLowerCase() ? 
              <span key={i} className="text-yellow-400 font-bold">{part}</span> : 
              part
          )}
        </span>
      );
    }
    return text;
  };

  if (!isOpen) return null

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* 抽屉容器 */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-[201] w-full max-w-md bg-slate-900/95 backdrop-blur-xl border-l border-white/10 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}>
        {/* 抽屉头部 */}
        <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/95 backdrop-blur-xl">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">切换城市</h2>
                <p className="text-xs text-white/50">选择一个城市开始征服</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* 搜索框 */}
          <div className="px-5 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="搜索城市名称、拼音或首字母..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-24">
          {filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="w-12 h-12 text-white/20 mb-3" />
              <p className="text-sm text-white/60">未找到匹配的城市或区县</p>
              <p className="text-xs text-white/40 mt-1">尝试其他搜索词</p>
            </div>
          ) : (
            filteredData.map((city) => (
              <Collapsible key={city.adcode} open={openCollapsibles.includes(city.adcode)} onOpenChange={() => {
                setOpenCollapsibles(prev => 
                  prev.includes(city.adcode) 
                    ? prev.filter(c => c !== city.adcode) 
                    : [...prev, city.adcode]
                );
              }}>
                <CollapsibleTrigger className="w-full flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                  <div onClick={() => handleSelectRegion(city, 'city')} className="flex-1 text-left">
                    <h3 className="font-bold">{highlightText(city.name, searchQuery)}</h3>
                  </div>
                  {city.districts && city.districts.length > 0 && (
                    <ChevronDown className="h-5 w-5 text-white/50 transition-transform duration-200" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="py-2 pl-4 space-y-2">
                  {city.districts?.map(district => (
                    <button key={district.adcode} onClick={() => handleSelectRegion(district, 'county')} className="w-full p-3 rounded-lg text-left hover:bg-white/10 transition-all">
                      {highlightText(district.name, searchQuery)}
                    </button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="sticky bottom-0 border-t border-white/10 bg-slate-900/95 backdrop-blur-xl px-5 py-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-400 mb-1">切换城市</p>
              <p className="text-xs text-white/60 leading-relaxed">
                切换城市后，你的进度数据将独立保存。不同城市的挑战和成就互不影响。
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

