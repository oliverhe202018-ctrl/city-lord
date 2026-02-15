
'use client';

import { useState, useEffect } from 'react';
import { useRegion } from '@/contexts/RegionContext';
import { Crown, Users, MapPin, Trophy, LineChart, TrendingUp, CheckCircle2, Loader2 } from 'lucide-react';

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const getClubs = async () => {
  const res = await fetchWithTimeout('/api/club/get-clubs', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch clubs')
  return await res.json()
}

const getUserClub = async () => {
  const res = await fetchWithTimeout('/api/club/get-user-club', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch user club')
  return await res.json()
}
import ClubDetails from './ClubDetails';

interface ClubMember {
  id: string;
  name: string;
  avatarUrl: string;
  isOnline: boolean;
  contribution: string;
  totalDistance: string;
}

function MemberCard({ member }: { member: ClubMember }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50">
      <div className="relative">
        <img src={member.avatarUrl} alt={member.name} className="w-12 h-12 rounded-full object-cover bg-zinc-700" />
        {member.isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-800 rounded-full"></span>
        )}
      </div>
      <span className="font-semibold">{member.name}</span>
    </div>
  );
}

// Cache outside component to persist across unmounts
let cachedClubs: any[] | null = null;
let lastFetchTime = 0;
// Reduce cache duration to 1 second to ensure freshness after updates
const CACHE_DURATION = 1 * 1000; 

function ClubList() {
  const { region } = useRegion();
  const { province, cityName, countyName } = region || {};
  const [joinedClubs, setJoinedClubs] = useState<Set<string>>(new Set());
  const [availableClubs, setAvailableClubs] = useState<any[]>(cachedClubs || []);
  const [loading, setLoading] = useState(!cachedClubs);

  // 获取位置名称，避免 undefined
  const locationName = cityName || countyName || '城市';

  useEffect(() => {
    async function loadClubs() {
      // Use cache if valid
      if (cachedClubs && Date.now() - lastFetchTime < CACHE_DURATION) {
        setAvailableClubs(cachedClubs);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const clubs = await getClubs();
        setAvailableClubs(clubs);
        
        // Update cache
        cachedClubs = clubs;
        lastFetchTime = Date.now();
      } catch (error) {
        console.error('Failed to load clubs:', error);
      } finally {
        setLoading(false);
      }
    }
    loadClubs();
  }, []);

  const handleJoinClub = (clubId: string, clubName: string) => {
    if (joinedClubs.has(clubId)) {
      alert(`你已经是 ${clubName} 的成员了！`);
      return;
    }

    const confirm = window.confirm(`确定要加入 ${clubName} 吗？`);
    if (confirm) {
      setJoinedClubs(new Set([...joinedClubs, clubId]));
      alert(`成功加入 ${clubName}！`);
    }
  };


  const handleViewClub = (clubId: string, clubName: string) => {
    alert(`查看 ${clubName} 详情功能开发中...`);
  };

  return (
    <div className="p-4 text-white min-h-[500px] pb-24">
      <h2 className="text-2xl font-bold mb-4">选择跑步俱乐部</h2>

      <div className="space-y-3">
        {availableClubs.map(club => (
          <div
            key={club.id}
            onClick={() => handleViewClub(club.id, club.name)}
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 cursor-pointer transition-colors"
          >
            <img src={club.avatar} alt={club.name} className="w-12 h-12 rounded-full flex-shrink-0 object-cover bg-zinc-700" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold flex items-center gap-2 truncate">
                {club.name}
                {joinedClubs.has(club.id) && (
                  <span className="flex items-center gap-1 text-green-400 text-xs flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    已加入
                  </span>
                )}
              </div>
              <div className="text-sm text-white/60 flex items-center gap-3 sm:gap-4">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Users className="w-3 h-3 flex-shrink-0" />
                  <span>{club.members} 位成员</span>
                </span>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span>{club.territory}</span>
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleJoinClub(club.id, club.name);
              }}
              disabled={joinedClubs.has(club.id)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                joinedClubs.has(club.id)
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
              }`}
            >
              {joinedClubs.has(club.id) ? '已加入' : '加入'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MyClub({ hasClub: initialHasClub = false }: { hasClub?: boolean }) {
  const [userClub, setUserClub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(!initialHasClub);

  useEffect(() => {
    async function fetchUserClub() {
      try {
        const club = await getUserClub();
        if (club) {
          setUserClub(club);
          setShowList(false);
        } else {
            // If explicit hasClub=true was passed but we found none, what to do?
            // Maybe just trust the API.
            setShowList(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchUserClub();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center min-h-[200px]"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
  }

  if (showList) {
    return <ClubList />;
  }

  return <ClubDetails club={userClub} onBack={() => setShowList(true)} />;
}
