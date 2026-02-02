'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Process a referral for a new user.
 * 
 * @param newUserId - The ID of the user being referred (Must match authenticated user)
 * @param referrerId - The ID of the user who invited
 */
export async function processReferral(newUserId: string, referrerId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 1. Authenticate
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // 2. Validate Permission
  // Users can only process their OWN referral acceptance
  if (user.id !== newUserId) {
    return { success: false, error: 'Unauthorized: Can only process own referral' }
  }

  // 3. Call Database RPC
  const { data, error } = await supabase.rpc('process_referral', {
    new_user_id: newUserId,
    referrer_id: referrerId
  })

  if (error) {
    console.error('Error processing referral:', error)
    return { success: false, error: error.message }
  }

  // Cast the JSONB result
  const result = data as { success: boolean; error?: string }
  return result
}

export async function getReferrerProfile(referrerId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, avatar_url')
    .eq('id', referrerId)
    .single()

  return profile
}
