import { useState, useEffect, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { getMyProfile, UserProfile, UserRole } from '../lib/adminStorage'

export interface AuthState {
  user: User | null
  profile: UserProfile | null
  role: UserRole | null
  isApproved: boolean
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const initializedRef = useRef(false)

  const loadProfile = async () => {
    if (!supabase) return
    try {
      const p = await getMyProfile()
      setProfile(p)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    // onAuthStateChange fires INITIAL_SESSION on mount — use it as the single source
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      setUser(u)

      if (u) {
        await loadProfile()
      } else {
        setProfile(null)
      }

      // Only call setLoading(false) once, on the first event
      if (!initializedRef.current) {
        initializedRef.current = true
        setLoading(false)
      }
    })

    // Safety fallback: if no event fires within 5s, unlock the UI
    const timeout = setTimeout(() => {
      if (!initializedRef.current) {
        initializedRef.current = true
        setLoading(false)
      }
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase non configuré — ajoutez les variables dans .env.local')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase non configuré — ajoutez les variables dans .env.local')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
  }

  const signOut = async () => {
    if (!supabase) throw new Error('Supabase non configuré')
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }

  const role = profile?.role ?? null
  const isApproved = role === 'user' || role === 'admin'
  const isAdmin = role === 'admin'

  return { user, profile, role, isApproved, isAdmin, loading, signIn, signUp, signOut, refreshProfile: loadProfile }
}
