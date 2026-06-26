"use client";

import { useState, useEffect } from "react";
import { Loader2, Users, Trophy, MapPin, Crown } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface ClubPublicProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  total_area: number;
  member_count: number;
  rank_national: number | null;
  rank_province: number | null;
  top_territories: {
    rank: number;
    member_id: string;
    nickname: string | null;
    avatar_url: string | null;
    total_area: number;
  }[];
}

interface Props {
  clubId: string;
}

export function ClubProfileCompactView({ clubId }: Props) {
  const [profile, setProfile] = useState<ClubPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    apiClient
      .get<ClubPublicProfile>(`/api/club/get-club-public-profile?clubId=${clubId}`)
      .then((res) => {
        if (!cancelled) {
          setProfile(res.data ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        无法加载俱乐部信息
      </div>
    );
  }

  const areaKm2 = (profile.total_area / 1_000_000).toFixed(2);

  return (
    <div className="px-4 pb-6 space-y-4">
      {/* Header: Avatar + Name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-muted/50 border-2 border-border flex-shrink-0">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
              {profile.name?.slice(0, 1) || "C"}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-lg font-bold">{profile.name}</h3>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {areaKm2} km²
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {profile.member_count}
            </span>
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/30 border border-border/50 p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">全国排名</div>
          <div className="text-xl font-bold text-amber-500">
            {profile.rank_national ? `#${profile.rank_national}` : "--"}
          </div>
        </div>
        <div className="rounded-xl bg-muted/30 border border-border/50 p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">省内排名</div>
          <div className="text-xl font-bold text-blue-500">
            {profile.rank_province ? `#${profile.rank_province}` : "--"}
          </div>
        </div>
      </div>

      {/* Top 5 Territories */}
      {profile.top_territories.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold">Top 5 Territories</span>
          </div>
          <div className="space-y-2">
            {profile.top_territories.map((member) => (
              <div
                key={member.member_id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 border border-border/30"
              >
                <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                  {member.rank <= 3 ? (
                    <Crown
                      className={`w-4 h-4 ${
                        member.rank === 1
                          ? "text-amber-500"
                          : member.rank === 2
                            ? "text-gray-400"
                            : "text-orange-700"
                      }`}
                    />
                  ) : (
                    member.rank
                  )}
                </span>
                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted/50 border border-border flex-shrink-0">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.nickname || ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {(member.nickname || "?")?.slice(0, 1)}
                    </div>
                  )}
                </div>
                <span className="flex-1 text-sm truncate">
                  {member.nickname || "Unknown"}
                </span>
                <span className="text-sm font-semibold text-amber-500">
                  {(member.total_area / 1_000_000).toFixed(1)} km²
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}