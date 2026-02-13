"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRegion } from "@/contexts/RegionContext";
import { useCity } from "@/contexts/CityContext";
import { baseCities, BaseCity } from "@/data/cities";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, MapPin, Search, X, Check, Building2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

/**
 * 城市切换抽屉组件
 */
export function CityDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { region, setRegion } = useRegion();
  const { allCities, switchCity } = useCity();
  const [searchQuery, setSearchQuery] = useState("");
  const [openProvinces, setOpenProvinces] = useState<string[]>([]);
  const [snapPoint, setSnapPoint] = useState<number | string | null>(1);
  
  // Group cities by province
  const groupedCities = useMemo(() => {
    const groups: Record<string, any[]> = {};
    
    // Sort allCities: Hot cities first (baseCities), then others
    // Actually, we just need to group them.
    // Let's iterate allCities.
    allCities.forEach(city => {
      const prov = city.province || '其他';
      if (!groups[prov]) groups[prov] = [];
      groups[prov].push(city);
    });

    return groups;
  }, [allCities]);

  // Handle region selection
  const handleSelectCity = async (city: any) => {
    // Switch global city context
    await switchCity(city.adcode);
    onClose();
  };

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={(open) => !open && onClose()}
      snapPoints={[0.4, 1]}
      activeSnapPoint={snapPoint}
      onActiveSnapPointChange={setSnapPoint}
      dismissible={true}
    >
      <DrawerContent className="max-h-[96vh] flex flex-col h-full bg-zinc-950 border-t border-zinc-800">
        <DrawerHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-white text-lg font-bold">切换城市</DrawerTitle>
            <DrawerClose asChild>
              <button className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                <X className="h-4 w-4 text-white" />
              </button>
            </DrawerClose>
          </div>
          
          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="搜索城市..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-cyan-400/50 transition-colors"
            />
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Hot Cities Section */}
          {!searchQuery && (
            <div>
              <h3 className="text-sm font-medium text-white/50 mb-3 px-1">热门城市</h3>
              <div className="grid grid-cols-3 gap-3">
                {baseCities.slice(0, 12).map(city => (
                  <button
                    key={city.adcode}
                    onClick={() => handleSelectCity(city)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                      region?.adcode === city.adcode
                        ? "bg-cyan-400/10 border-cyan-400/50"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    )}
                  >
                    <span className="text-2xl">
                        {/* Try to find icon from allCities if possible, else fallback */}
                        {allCities.find(c => c.adcode === city.adcode)?.icon || "🏙️"}
                    </span>
                    <span className={cn(
                      "text-xs font-medium",
                      region?.adcode === city.adcode ? "text-cyan-400" : "text-white"
                    )}>
                      {city.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All Cities Grouped by Province */}
          <div>
            <h3 className="text-sm font-medium text-white/50 mb-3 px-1">所有区域</h3>
            <div className="space-y-2">
              {Object.entries(groupedCities).map(([province, cities]) => {
                // Filter if searching
                if (searchQuery) {
                   const matchingCities = cities.filter(c => c.name.includes(searchQuery));
                   if (matchingCities.length === 0) return null;
                   // If searching, show flat list
                   return matchingCities.map(city => (
                     <button
                        key={city.adcode}
                        onClick={() => handleSelectCity(city)}
                        className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 mb-2"
                     >
                       <span className="text-white">{city.name}</span>
                       {region?.adcode === city.adcode && <Check className="h-4 w-4 text-cyan-400" />}
                     </button>
                   ));
                }

                // Normal View: Accordion
                const isOpen = openProvinces.includes(province);
                return (
                  <div key={province} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <button
                      onClick={() => setOpenProvinces(prev => 
                        prev.includes(province) ? prev.filter(p => p !== province) : [...prev, province]
                      )}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                    >
                      <span className="font-medium text-white">{province}</span>
                      <ChevronDown className={cn("h-4 w-4 text-white/40 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    
                    {isOpen && (
                      <div className="border-t border-white/10 bg-black/20">
                        {cities.map(city => (
                          <button
                            key={city.adcode}
                            onClick={() => handleSelectCity(city)}
                            className={cn(
                              "w-full flex items-center justify-between px-4 py-3 text-sm transition-colors",
                              region?.adcode === city.adcode ? "bg-cyan-400/10 text-cyan-400" : "text-white/80 hover:bg-white/5"
                            )}
                          >
                            <span className="flex items-center gap-2">
                                <Building2 className="h-3 w-3 opacity-50" />
                                {city.name}
                            </span>
                            {region?.adcode === city.adcode && <Check className="h-3 w-3" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
