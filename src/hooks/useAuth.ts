import { useState, useEffect, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { UserProfile, UserRole } from '../lib/adminStorage'

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

// Load profile by user ID directly — no extra getUser() round-trip
async function fetchProfileById(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, approved_by, approved_at, created_at')
      .eq('id', userId)
      .single()
    if (error) return null
    return data as UserProfile
  } catch {
    return null
  }
}

// After signup the DB trigger may not have run yet — retry up to 3x
async function fetchProfileWithRetry(userId: string, maxRetries = 3): Promise<UserProfile | null> {
  for (let i = 0; i < maxRetries; i++) {
    const profile = await fetchProfileById(userId)
    if (profile) return profile
    if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 800))
  }
  return null
}

export function useAuth(): AuthState {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const initializedRef        = useRef(false)

  const loadProfile = async (userId?: string) => {
    const id = userId ?? user?.id
    if (!id || !supabase) { setProfile(null); return }
    const p = await fetchProfileById(id)
    setProfile(p)
  }

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null
      setUser(u)

      if (u) {
        if (event === 'SIGNED_IN') {
          // On login, profile may not exist yet for brand-new accounts — retry
          const p = await fetchProfileWithRetry(u.id)
          setProfile(p)
        } else {
          // INITIAL_SESSION / TOKEN_REFRESHED: profile already exists, single query
          const p = await fetchProfileById(u.id)
          setProfile(p)
        }
      } else {
        setProfile(null)
      }

      if (!initializedRef.current) {
        initializedRef.current = true
        setLoading(false)
      }
    })

    // Safety: unlock UI after 3s if no auth event fires (offline / slow Supabase)
    const timeout = setTimeout(() => {
      if (!initializedRef.current) {
        initializedRef.current = true
        setLoading(false)
      }
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase non configuré')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase non configuré')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
  }

  const signOut = async () => {
    if (!supabase) throw new Error('Supabase non configuré')
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }

  const role       = profile?.role ?? null
  const isApproved = role === 'user' || role === 'admin'
  const isAdmin    = role === 'admin'

  return {
    user, profile, role, isApproved, isAdmin, loading,
    signIn, signUp, signOut,
    refreshProfile: () => loadProfile(),
  }
}
