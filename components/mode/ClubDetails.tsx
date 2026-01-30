'use client';

import { useState } from 'react';
import { useRegion } from '@/contexts/RegionContext';
import { mockClub, type ClubMember } from '@/data/clubs';
import { Crown, Users, Trophy, MapPin, Calendar, Activity, TrendingUp, LineChart, Clock, MapPin as LocationIcon, ExternalLink } from 'lucide-react';

interface ClubTerritory {
  id: string;
  name: string;
  area: number;
  date: string;
  member: string;
  memberName: string;
  lastTime: string;
  pace?: string;
  location?: string;
  totalDistance?: string;
  totalTime?: string;
  avgPace?: string;
  siege?: string;
}

function MemberCard({ member, onClick }: { member: ClubMember; onClick?: (member: ClubMember) => void }) {
  return (
    <div
      onClick={() => onClick?.(member)}
      className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 cursor-pointer hover:bg-zinc-700/50 transition-colors"
    >
      <div className="relative">
        <img src={member.avatarUrl} alt={member.name} className="w-12 h-12 rounded-full" />
        {member.isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-800 rounded-full"></span>
        )}
      </div>
      <div className="flex-1">
        <span className="font-semibold">{member.name}</span>
        <div className="text-xs text-white/50 mt-1">贡献: {member.contribution}</div>
      </div>
    </div>
  );
}

export interface ClubDetailsProps {
  club?: any;
  onBack?: () => void;
}

export default function ClubDetails({ club, onBack }: ClubDetailsProps) {
  const { region } = useRegion();
  const { province, cityName, countyName } = region || {};
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'territories' | 'history'>('leaderboard');
  const [leaderboardSubTab, setLeaderboardSubTab] = useState<'club' | 'province' | 'national'>('club');
  const [territorySortBy, setTerritorySortBy] = useState<'date' | 'area'>('date');

  const handleMemberClick = (member: ClubMember) => {
    alert(`查看 ${member.name} 的个人资料\n总距离: ${member.totalDistance} km\n贡献: ${member.contribution} mi²`);
  };

  const handleTerritoryClick = (territory: ClubTerritory) => {
    alert(`查看 ${territory.name} 领地详情\n面积: ${territory.area} mi²\n占领者: ${territory.memberName}`);
  };

  const handleClubActivityClick = () => {
    alert('俱乐部活动详情页面开发中...');
  };

  // Mock data for club internal leaderboard
  const clubInternalLeaderboard = [
    { id: '1', name: '李明', avatar: 'https://picsum.photos/id/64/40/40', area: 125.5, score: 5890 },
    { id: '2', name: '王伟', avatar: 'https://picsum.photos/id/65/40/40', area: 98.3, score: 4230 },
    { id: '3', name: '张芳', avatar: 'https://picsum.photos/id/66/40/40', area: 87.6, score: 3850 },
    { id: '4', name: '刘洋', avatar: 'https://picsum.photos/id/67/40/40', area: 65.2, score: 2980 },
    { id: '5', name: '陈静', avatar: 'https://picsum.photos/id/68/40/40', area: 52.8, score: 2150 },
  ];

  // Mock data for province leaderboard
  const provinceLeaderboard = [
    { id: '1', name: '闪电跑团', avatar: 'https://picsum.photos/id/70/40/40', area: 605.3 },
    { id: '2', name: '夜跑俱乐部', avatar: 'https://picsum.photos/id/71/40/40', area: 482.1 },
    { id: '3', name: '城市猎人', avatar: 'https://picsum.photos/id/72/40/40', area: 387.5 },
  ];

  // Mock data for national leaderboard
  const nationalLeaderboard = [
    { id: '1', name: '北京飞人队', avatar: 'https://picsum.photos/id/73/40/40', area: 1250.8 },
    { id: '2', name: '上海领跑者', avatar: 'https://picsum.photos/id/74/40/40', area: 1180.3 },
    { id: '3', name: '广州飞跑团', avatar: 'https://picsum.photos/id/75/40/40', area: 1056.7 },
  ];

  // Mock data for territories sorted by date
  const territoriesByDate: ClubTerritory[] = [
    {
      id: '1',
      name: 'Sas Nagar',
      area: 2.28,
      date: '2小时前',
      member: 'https://picsum.photos/id/64/40/40',
      memberName: '李明',
      lastTime: '2小时前',
      pace: '6:45',
      location: '中心广场'
    },
    {
      id: '2',
      name: 'Cuttack',
      area: 0.42,
      date: '5小时前',
      member: 'https://picsum.photos/id/65/40/40',
      memberName: '王伟',
      lastTime: '5小时前',
      pace: '7:12',
      location: '东部公园'
    },
    {
      id: '3',
      name: 'Lucknow',
      area: 0.13,
      date: '昨天',
      member: 'https://picsum.photos/id/66/40/40',
      memberName: '张芳',
      lastTime: '昨天 15:30',
      pace: '6:58',
      location: '西部湖畔'
    },
  ];

  // Mock data for territories sorted by area
  const territoriesByArea: ClubTerritory[] = [
    {
      id: '1',
      name: 'Sas Nagar',
      area: 2.28,
      date: '2小时前',
      member: 'https://picsum.photos/id/64/40/40',
      memberName: '李明',
      lastTime: '在线',
      totalDistance: '125.6 km',
      totalTime: '48h 23min',
      avgPace: '6:45',
      siege: '2.28 mi²'
    },
    {
      id: '2',
      name: 'Cuttack',
      area: 0.42,
      date: '5小时前',
      member: 'https://picsum.photos/id/65/40/40',
      memberName: '王伟',
      lastTime: '1小时前',
      totalDistance: '98.3 km',
      totalTime: '37h 15min',
      avgPace: '7:12',
      siege: '0.42 mi²'
    },
    {
      id: '3',
      name: 'Lucknow',
      area: 0.13,
      date: '昨天',
      member: 'https://picsum.photos/id/66/40/40',
      memberName: '张芳',
      lastTime: '3小时前',
      totalDistance: '87.6 km',
      totalTime: '32h 45min',
      avgPace: '6:58',
      siege: '0.13 mi²'
    },
  ];

  // Use passed club data or fallback to dynamic generation based on region
  const displayClub = club || {
    name: `${province}${cityName || countyName || ''}跑步俱乐部`,
    territory: mockClub.territory,
    memberCount: mockClub.memberCount
  };

  const clubName = displayClub.name;
  const territorySize = displayClub.territory;
  const memberCount = displayClub.memberCount || displayClub.members;

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
      <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-2 px-1 font-medium whitespace-nowrap transition-colors ${activeTab === 'leaderboard' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-white/60'
            }`}
        >
          排行榜
        </button>
        <button
          onClick={() => setActiveTab('territories')}
          className={`pb-2 px-1 font-medium whitespace-nowrap transition-colors ${activeTab === 'territories' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-white/60'
            }`}
        >
          跑步俱乐部领地
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-2 px-1 font-medium whitespace-nowrap transition-colors ${activeTab === 'history' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-white/60'
            }`}
        >
          历史
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'leaderboard' && (
        <div>
          {/* Leaderboard Sub-tabs */}
          <div className="flex gap-2 mb-4 border-b border-white/10 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setLeaderboardSubTab('club')}
              className={`pb-2 px-3 text-sm font-medium whitespace-nowrap transition-colors ${leaderboardSubTab === 'club' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-white/60'
                }`}
            >
              俱乐部内部
            </button>
            <button
              onClick={() => setLeaderboardSubTab('province')}
              className={`pb-2 px-3 text-sm font-medium whitespace-nowrap transition-colors ${leaderboardSubTab === 'province' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-white/60'
                }`}
            >
              省排行榜
            </button>
            <button
              onClick={() => setLeaderboardSubTab('national')}
              className={`pb-2 px-3 text-sm font-medium whitespace-nowrap transition-colors ${leaderboardSubTab === 'national' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-white/60'
                }`}
            >
              全国排行榜
            </button>
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
                    <img src={item.avatar} alt={item.name} className="w-10 h-10 rounded-full flex-shrink-0" />
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
                    <img src={item.avatar} alt={item.name} className="w-10 h-10 rounded-full flex-shrink-0" />
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
                    <img src={item.avatar} alt={item.name} className="w-10 h-10 rounded-full flex-shrink-0" />
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
                      <img src={item.member} alt={item.memberName} className="w-10 h-10 rounded-full flex-shrink-0" />
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
                      <img src={item.member} alt={item.memberName} className="w-10 h-10 rounded-full flex-shrink-0" />
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
            <div className="relative h-64 bg-zinc-900/50 rounded-lg p-4">
              <div className="absolute bottom-0 left-0 right-0 h-48">
                <svg className="w-full h-full" viewBox="0 0 400 192">
                  <path
                    d="M 20 180 L 60 160 L 100 140 L 140 120 L 180 100 L 220 80 L 260 60 L 300 40 L 340 20"
                    stroke="white"
                    strokeWidth="2"
                    fill="none"
                  />
                  <path
                    d="M 20 180 L 60 160 L 100 140 L 140 120 L 180 100 L 220 80 L 260 60 L 300 40 L 340 20 L 340 180 L 20 180"
                    stroke="none"
                    fill="rgba(255, 255, 255, 0.1)"
                  />
                </svg>
              </div>
              <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-white/60">
                <span>579.1 mi²</span>
                <span>386.1 mi²</span>
                <span>193.1 mi²</span>
                <span>0 mi²</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-white/60">
                <span>02/10</span>
                <span>09/09</span>
                <span>10/19</span>
                <span>11/25</span>
                <span>12/26</span>
                <span>01/28</span>
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

