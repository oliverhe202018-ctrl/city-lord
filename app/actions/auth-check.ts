
'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Define input validation Schema
const CheckEmailSchema = z.object({
  email: z.string().email({ message: "无效的邮箱格式" }),
})

export async function checkEmailExists(email: string) {
  // 1. Input validation
  const parsed = CheckEmailSchema.safeParse({ email })
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, exists: false }
  }

  const supabase = await createClient()

  try {
    // 2. Query profiles table (faster than auth.users and safer with RLS)
    // We assume all registered users have a profile due to ensureUserProfile logic
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email) 
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 means not found
      throw error
    }

    return { exists: !!data, error: null }

  } catch (error) {
    console.error('Check email failed:', error)
    return { error: '系统繁忙，请稍后再试', exists: false }
  }
}
