import { useState, useEffect, useRef, useCallback } from 'react'
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
  // Tracks the ID of the in-flight profile fetch so stale results are discarded
  const fetchIdRef            = useRef(0)

  const loadProfile = useCallback(async (userId: string, isSignIn = false) => {
    // Stamp this fetch; if a newer fetch starts before this one finishes, discard result
    const myId = ++fetchIdRef.current
    const p = isSignIn
      ? await fetchProfileWithRetry(userId)
      : await fetchProfileById(userId)
    // Only commit if no newer fetch has started
    if (myId === fetchIdRef.current) {
      setProfile(p)
    }
  }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null

      // 1. Synchronous state update — never block on async work here.
      //    Supabase does NOT await async callbacks; overlapping calls cause
      //    stale state races and an apparent UI freeze.
      setUser(u)

      if (u) {
        // 2. Fire-and-forget profile fetch (cancellation via fetchIdRef).
        //    SIGNED_IN on a brand-new account: retry until DB trigger runs.
        loadProfile(u.id, event === 'SIGNED_IN')
      } else {
        // Logout: cancel any in-flight fetch and clear profile
        fetchIdRef.current++
        setProfile(null)
      }

      // 3. Unlock UI exactly once on the first event (INITIAL_SESSION / SIGNED_OUT)
      if (!initializedRef.current) {
        initializedRef.current = true
        setLoading(false)
      }
    })

    // Safety net: unlock UI after 3s if Supabase never fires (offline / misconfigured)
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
  }, [loadProfile])

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
    refreshProfile: () => loadProfile(user?.id ?? '', false),
  }
}
