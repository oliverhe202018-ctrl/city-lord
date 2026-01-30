'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'

export async function getProfile() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }
  
  return profile
}

export async function updateProfile(data: Database['public']['Tables']['profiles']['Update']) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile, error } = await (supabase
    .from('profiles' as any) as any)
    .update(data)
    .eq('id', user.id)
    .select()
    .single()

  if (error) throw error
  return profile
}

// ==================== Atomic Operations ====================

export async function addExperience(amount: number) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data, error } = await supabase.rpc('add_user_experience' as any, { amount } as any)
  
  if (error) throw error
  return data
}

export async function consumeStamina(amount: number) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: success, error } = await supabase.rpc('consume_user_stamina' as any, { amount } as any)
  
  if (error) throw error
  if (!success) throw new Error('Not enough stamina')
  
  return success
}

export async function restoreStamina(amount: number) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: newStamina, error } = await supabase.rpc('restore_user_stamina' as any, { amount } as any)
  
  if (error) throw error
  return newStamina
}

export async function addTotalArea(amount: number) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: newArea, error } = await supabase.rpc('add_user_area' as any, { amount } as any)
  
  if (error) throw error
  return newArea
}
