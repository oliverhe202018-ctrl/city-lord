import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ClubList } from "@/components/citylord/club/ClubList";
import { ClubDetailView } from "@/components/citylord/club/ClubDetailView";

export default async function ClubPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <ClubList />;

  // 1. 优先查询：我是不是某个俱乐部的成员？
  const { data: member } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', user.id)
    .single();

  // 2. 再次查询：我是不是某个俱乐部的所有者（Owner）？
  // (防止作为 Owner 但不在 member 表里的边缘情况)
  const { data: ownerClub } = await supabase
    .from('clubs')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  const targetClubId = member?.club_id || ownerClub?.id;

  // 3. 逻辑分流：只要找到关联，直接进详情页
  if (targetClubId) {
    return <ClubDetailView clubId={targetClubId} />;
  }

  // 4. 没加入也没创建，才显示列表
  return <ClubList />;
}
