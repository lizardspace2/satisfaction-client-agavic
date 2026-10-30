import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured =
  Boolean(url && key && url.startsWith('http') && key.length > 20)

// Client unique — jamais de clé "service_role" ici : la sécurité repose sur les RLS.
export const supabase = createClient(
  isSupabaseConfigured ? url! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? key! : 'placeholder-key'
)
