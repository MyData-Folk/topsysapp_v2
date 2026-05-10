import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// null when env vars are absent — app remains fully functional without Supabase
export const supabase: SupabaseClient | null = (url && key) 
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      },
      global: {
        headers: { 'x-application-name': 'topsys-explorer-v2' }
      }
    }) 
  : null
