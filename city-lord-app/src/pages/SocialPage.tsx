import { SocialPage as MemoizedSocialPage } from '@/components/citylord/social/social-page'
import { useState } from 'react'

export default function SocialPage() {
  // If we had initial data passed, we would fetch or use context, but SWR handles it mostly.
  return (
    <div id="nav-social" className="flex-1 w-full h-full bg-[#0f172a] z-40 relative pointer-events-auto">
      <MemoizedSocialPage
        onShowDemo={() => {}}
        initialFriends={[]}
        initialRequests={[]}
      />
    </div>
  )
}
