'use client';

import { useEffect, useState } from 'react';
import { createClient } from "@/lib/supabase/client";
import { ClubList } from "@/components/citylord/club/ClubList";
import { ClubDetailView } from "@/components/citylord/club/ClubDetailView";

export default function ClubPage() {
  const [loading, setLoading] = useState(true);
  const [myClubId, setMyClubId] = useState<string | null>(null);

  useEffect(() => {
    async function checkClub() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // 1. 优先查询：我是不是某个俱乐部的成员？
      const { data: member } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', user.id)
        .single();

      // 2. 再次查询：我是不是某个俱乐部的所有者（Owner）？
      const { data: owner } = await supabase
        .from('clubs')
        .select('id')
        .eq('owner_id', user.id)
        .single();
        
      setMyClubId(member?.club_id || owner?.id || null);
      setLoading(false);
    }
    checkClub();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (myClubId) {
    return <ClubDetailView clubId={myClubId} />;
  }

  return <ClubList />;
}
