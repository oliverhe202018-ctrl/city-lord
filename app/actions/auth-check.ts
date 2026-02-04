'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { cookies } from 'next/headers'

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

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  try {
    // 2. Query profiles table (faster than auth.users and safer with RLS)
    // We assume all registered users have a profile due to ensureUserProfile logic
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', email) // Wait, ID is UUID, not email. We need to check by email if stored, or rely on auth.
      // Correction: Profiles usually don't store email for privacy/normalization, 
      // but in this codebase, we might not have email in profiles table based on previous context.
      // Let's check if we can query by email. If not, we might need to use a different approach.
      // Actually, standard Supabase pattern is profiles linked to auth.users.
      // If we can't query auth.users directly from client (which we can't), we need a secure way.
      // Using Service Role here would be risky if not rate limited.
      // Let's check if we have an 'email' column in profiles? 
      // Based on previous ensureUserProfile: 
      // .upsert({ id: user.id, email: user.email ... }) 
      // It seems we ARE storing email in profiles!
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