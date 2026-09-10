import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function getJwtRole(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role as string | undefined
  } catch {
    return undefined
  }
}

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? 'Supabase n’est pas configuré.'
  : getJwtRole(supabaseAnonKey) === 'service_role'
    ? 'La clé Supabase fournie est une clé service_role. Utilisez la clé anon/public dans VITE_SUPABASE_ANON_KEY.'
    : null

export const supabase = supabaseUrl && supabaseAnonKey && !supabaseConfigError
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
