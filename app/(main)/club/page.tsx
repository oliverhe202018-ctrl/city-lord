import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClubList from '@/components/citylord/club/ClubList'
import { ClubDetailView } from '@/components/citylord/club/ClubDetailView'

export default async function ClubPage() {
  const supabase = await createClient()
  
  // 1. 获取当前用户
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // 2. ✅ 查询用户的俱乐部信息（从 profiles 表）
  const { data: profile } = await supabase
    .from('profiles')
    .select('club_id')
    .eq('id', user.id)
    .single()

  // 3. ✅ 如果 club_id 存在，验证成员关系
  if (profile?.club_id) {
    // 验证成员关系是否真实存在
    const { data: membership } = await supabase
      .from('club_members')
      .select('status, club_id')
      .eq('user_id', user.id)
      .eq('club_id', profile.club_id)
      .maybeSingle()

    // 如果成员关系存在（无论是 pending 还是 active），显示详情
    if (membership) {
      return <ClubDetailView clubId={profile.club_id} isJoined={membership.status === 'active'} />
    }
    
    // 如果成员关系不存在但 profile.club_id 存在（数据不一致），修复它
    await supabase
      .from('profiles')
      .update({ club_id: null })
      .eq('id', user.id)
  }

  // 4. 未加入任何俱乐部，显示列表
  return <ClubList />
}
