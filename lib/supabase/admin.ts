import { createClient } from '@supabase/supabase-js'

// Note: access to SUPABASE_SERVICE_ROLE_KEY is server-side only
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables for Admin client')
}

// Create a Supabase client with the SERVICE_ROLE_KEY
// This client has admin privileges and should ONLY be used in Server Actions or API routes
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})
