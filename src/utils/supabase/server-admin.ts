import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    // Return null or throw, but better to be explicit so we can catch it in the action
    console.error('SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.')
    throw new Error('CONFIG_ERROR: SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local to use Admin features.')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
