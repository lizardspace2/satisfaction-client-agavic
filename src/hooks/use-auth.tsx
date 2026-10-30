import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Profile, AppRole } from '@/lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  canWrite: boolean          // admin | manager
  isAdmin: boolean
  role: AppRole | null
}

const AuthContext = createContext<AuthState>({
  session: null, profile: null, loading: true,
  signIn: async () => 'Non configuré', signOut: async () => {},
  canWrite: false, isAdmin: false, role: null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadProfile(data.session.user.id)
      else setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) loadProfile(s.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('enquete_satisfaction_profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data as Profile | null)
    setLoading(false)
  }

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message === 'Invalid login credentials'
      ? "Identifiants incorrects. Vérifiez l'e-mail et le mot de passe."
      : error.message
    return null
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const role = profile?.role ?? null
  const canWrite = role === 'admin' || role === 'manager'
  const isAdmin = role === 'admin'

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut, canWrite, isAdmin, role }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
