'use client';

import { useState, useEffect } from 'react';
import { useRegion } from '@/contexts/RegionContext';
import { Crown, Users, Trophy, MapPin, Calendar, Activity, TrendingUp, LineChart, Clock, MapPin as LocationIcon, ExternalLink } from 'lucide-react';
import type { Club } from '@/app/actions/club';
import { TabGroup } from '@/components/ui/TabGroup';

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = input
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = `${process.env.NEXT_PUBLIC_API_SERVER || ''}${url}`
    }
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const getClubLeaderboard = async (clubId: string) => {
  const res = await fetchWithTimeout(`/api/club/get-club-leaderboard?clubId=${clubId}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch club leaderboard')
  return await res.json()
}

const getClubTerritories = async (clubId: string) => {
  const res = await fetchWithTimeout(`/api/club/get-club-territories?clubId=${clubId}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch club territories')
  return await res.json()
}

interface UIClubMember {
  id: string;
  name: string;
  avatarUrl: string;
  isOnline: boolean;
  contribution: string;
  totalDistance: string;
}

// UI specific territory interface
interface UIClubTerritory {
  id: string;
  name: string;
  area: number;
  date: string;
  member: string; // avatar url
  memberName: string;
  lastTime: string;
  pace?: string;
  location?: string;
  totalDistance?: string;
  totalTime?: string;
  avgPace?: string;
  siege?: string;
}

export interface ClubDetailsProps {
  club?: Club;
  onBack?: () => void;
}

export default function ClubDetails({ club: propClub, onBack }: ClubDetailsProps) {
  const { region } = useRegion();
  const { province, cityName, countyName } = region || {};
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'territories' | 'history'>('leaderboard');
  const [leaderboardSubTab, setLeaderboardSubTab] = useState<'club' | 'province' | 'national'>('club');
  const [territorySortBy, setTerritorySortBy] = useState<'date' | 'area'>('date');
  
  const [internalLeaderboard, setInternalLeaderboard] = useState<any[]>([]);
  const [territories, setTerrories] = useState<UIClubTerritory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Normalize club data
  const displayClub = propClub || {
    id: undefined,
    name: `${province || ''}${cityName || countyName || ''}跑步俱乐部`,
    territory: '0 mi²',
    memberCount: 0,
    members: 0,
    member_count: 0
  };

  const clubName = displayClub.name || '我的俱乐部';
  const clubId = displayClub.id;
  const territorySize = displayClub.territory || '0 mi²';
  const memberCount = (displayClub as any).member_count || (displayClub as any).memberCount || (displayClub as any).members || 0;

  useEffect(() => {
    if (clubId) {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [lbData, terrData] = await Promise.all([
                    getClubLeaderboard(clubId),
                    getClubTerritories(clubId)
                ]);
                
                // Map Leaderboard
                // The action returns: { id, name, avatar, area, score, rank }
                setInternalLeaderboard(lbData.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    avatar: item.avatar,
                    area: item.area,
                    score: item.score
                })));

                // Map Territories
                // The action returns: { id, name, area, date, member, memberName, lastTime, location }
                setTerrories(terrData.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    area: t.area,
                    date: t.date,
                    member: t.member || '',
                    memberName: t.memberName || 'Unknown',
                    lastTime: t.lastTime,
                    pace: t.pace, // Use real data from API
                    location: t.location
                })));

            } catch (error: any) {
                if (error?.name !== 'AbortError' && error?.digest !== 'NEXT_REDIRECT') {
                    console.error("Failed to fetch club details", error);
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }
  }, [clubId]);

  const handleMemberClick = (member: UIClubMember) => {
    alert(`查看 ${member.name} 的个人资料\n总距离: ${member.totalDistance} km\n贡献: ${member.contribution} mi²`);
  };

  const handleTerritoryClick = (territory: UIClubTerritory) => {
    alert(`查看 ${territory.name} 领地详情\n面积: ${territory.area} mi²\n占领者: ${territory.memberName}`);
  };

  const handleClubActivityClick = () => {
    alert('俱乐部活动详情页面开发中...');
  };

  const clubInternalLeaderboard = internalLeaderboard;
  // TODO: Implement province/national leaderboard fetching
  const provinceLeaderboard: any[] = []; 
  const nationalLeaderboard: any[] = [];
  
  const territoriesByDate = [...territories].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const territoriesByArea = [...territories].sort((a, b) => b.area - a.area);

  return (
    <div className="p-4 text-white w-full max-w-full mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold break-words">{clubName}</h2>
        <div className="flex flex-wrap items-center justify-center gap-4 text-white/70 mt-2">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{territorySize}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{memberCount} 位成员</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <TabGroup
          variant="minimal"
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          items={[
            { id: 'leaderboard', label: '排行榜' },
            { id: 'territories', label: '跑步俱乐部领地' },
            { id: 'history', label: '历史' },
          ]}
        />
      </div>

      {/* Content based on active tab */}
      {activeTab === 'leaderboard' && (
        <div>
          {/* Leaderboard Sub-tabs */}
          <div className="mb-4">
            <TabGroup
              variant="block"
              activeId={leaderboardSubTab}
              onChange={(id) => setLeaderboardSubTab(id as any)}
              items={[
                { id: 'club', label: '俱乐部内部' },
                { id: 'province', label: '省排行榜' },
                { id: 'national', label: '全国排行榜' },
              ]}
            />
          </div>

          {/* Club Internal Leaderboard */}
          {leaderboardSubTab === 'club' && (
            <div className="w-full overflow-x-auto">
              <div className="space-y-3 min-w-[300px]">
                {clubInternalLeaderboard.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${index === 0 ? 'bg-yellow-500/20 border border-yellow-500' : 'bg-zinc-800/50 hover:bg-zinc-700/50'
                      }`}
                    onClick={() => alert(`查看 ${item.name} 的详细数据\n分数: ${item.score}\n占领面积: ${item.area} mi²`)}
                  >
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-zinc-600 text-white'}`}>
                      {index + 1}
                    </div>
                    {item.avatar ? (
                      <img src={item.avatar} alt={item.name} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex-shrink-0 bg-white/10 flex items-center justify-center">👤</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{item.name}</div>
                      <div className="text-sm text-white/60 truncate">{item.area} mi²</div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-white/40 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Province Leaderboard */}
          {leaderboardSubTab === 'province' && (
            <div className="w-full overflow-x-auto">
              <div className="space-y-3 min-w-[300px]">
                {provinceLeaderboard.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${index === 0 ? 'bg-yellow-500/20 border border-yellow-500' : 'bg-zinc-800/50 hover:bg-zinc-700/50'
                      }`}
                    onClick={() => alert(`查看 ${item.name} 俱乐部详情\n占领面积: ${item.area} mi²`)}
                  >
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-zinc-600 text-white'}`}>
                      {index + 1}
                    </div>
                    {item.avatar ? (
                      <img src={item.avatar} alt={item.name} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex-shrink-0 bg-white/10 flex items-center justify-center">👤</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{item.name}</div>
                      <div className="text-sm text-white/60 truncate">{item.area} mi²</div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-white/40 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* National Leaderboard */}
          {leaderboardSubTab === 'national' && (
            <div className="w-full overflow-x-auto">
              <div className="space-y-3 min-w-[300px]">
                {nationalLeaderboard.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${index === 0 ? 'bg-yellow-500/20 border border-yellow-500' : 'bg-zinc-800/50 hover:bg-zinc-700/50'
                      }`}
                    onClick={() => alert(`查看 ${item.name} 俱乐部详情\n全国排名: ${index + 1}\n占领面积: ${item.area} mi²`)}
                  >
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-zinc-600 text-white'}`}>
                      {index + 1}
                    </div>
                    {item.avatar ? (
                      <img src={item.avatar} alt={item.name} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex-shrink-0 bg-white/10 flex items-center justify-center">👤</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{item.name}</div>
                      <div className="text-sm text-white/60 truncate">{item.area} mi²</div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-white/40 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'territories' && (
        <div>
          {/* Territory Sort Options */}
          <div className="flex gap-2 mb-4 border-b border-white/10">
            <button
              onClick={() => setTerritorySortBy('date')}
              className={`pb-2 px-3 text-sm font-medium transition-colors ${territorySortBy === 'date' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-white/60'
                }`}
            >
              按时间排序
            </button>
            <button
              onClick={() => setTerritorySortBy('area')}
              className={`pb-2 px-3 text-sm font-medium transition-colors ${territorySortBy === 'area' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-white/60'
                }`}
            >
              按面积排序
            </button>
          </div>

          {/* Territories List - Sort by Date */}
          {territorySortBy === 'date' && (
            <div className="w-full overflow-x-auto">
              <div className="space-y-3 min-w-[300px]">
                {territoriesByDate.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleTerritoryClick(item)}
                    className="p-3 rounded-lg bg-zinc-800/50 cursor-pointer hover:bg-zinc-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {item.member ? (
                        <img src={item.member} alt={item.memberName} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex-shrink-0 bg-white/10 flex items-center justify-center">👤</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{item.name}</span>
                          <span className="text-xs text-yellow-400 flex-shrink-0">{item.date}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-white/60 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span>{item.area} mi²</span>
                          <span>•</span>
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span>{item.lastTime}</span>
                        </div>
                        <div className="text-sm text-white/60 mt-1 truncate">
                          <span>配速: {item.pace}</span>
                          <span className="ml-2">领地面积: {item.area} mi²</span>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-white/40 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Territories List - Sort by Area */}
          {territorySortBy === 'area' && (
            <div className="w-full overflow-x-auto">
              <div className="space-y-3 min-w-[300px]">
                {territoriesByArea.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleTerritoryClick(item)}
                    className="p-3 rounded-lg bg-zinc-800/50 cursor-pointer hover:bg-zinc-700/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {item.member ? (
                        <img src={item.member} alt={item.memberName} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex-shrink-0 bg-white/10 flex items-center justify-center">👤</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.memberName}</div>
                        <div className="flex items-center gap-1 mt-1 text-sm text-white/60 truncate">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span>最后上线: {item.lastTime}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-sm text-white/60 truncate">
                          <LocationIcon className="w-3 h-3 flex-shrink-0" />
                          <span>{item.location}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          <div className="text-white/70 truncate">
                            <span>总跑步距离: </span>
                            <span className="text-white font-medium">{item.totalDistance}</span>
                          </div>
                          <div className="text-white/70 truncate">
                            <span>总时间: </span>
                            <span className="text-white font-medium">{item.totalTime}</span>
                          </div>
                          <div className="text-white/70 truncate">
                            <span>平均配速: </span>
                            <span className="text-white font-medium">{item.avgPace}</span>
                          </div>
                          <div className="text-white/70 truncate">
                            <span>领地面积: </span>
                            <span className="text-white font-medium">{item.siege}</span>
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-white/40 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <div className="bg-black/30 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              俱乐部领地随时间变化
            </h3>
            <div className="relative h-64 bg-zinc-900/50 rounded-lg p-4 flex items-center justify-center">
              <div className="text-center text-white/40">
                <LineChart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">数据积累中，持续跑步即可查看趋势图</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Club Activity Entry */}
      <div
        onClick={handleClubActivityClick}
        className="bg-yellow-500/20 border border-yellow-500 text-yellow-400 p-4 rounded-lg mb-6 text-center cursor-pointer hover:bg-yellow-500/30 transition-colors"
      >
        <h3 className="font-bold text-lg flex items-center justify-center gap-2">
          <Crown className="w-5 h-5" />
          跑步俱乐部活动进行中
        </h3>
        <p className="text-sm">点击查看详情</p>
      </div>
    </div>
  );
}

