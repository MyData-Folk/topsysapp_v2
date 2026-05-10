import { useState, useEffect, useRef, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { UserProfile, UserRole } from '../lib/adminStorage'
import { logger } from '../utils/logger'

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
    if (error) {
      logger.warn('Auth', `Échec récupération profil pour ${userId}`, error);
      return null
    }
    logger.info('Auth', `Profil récupéré pour ${userId}`, data);
    return data as UserProfile
  } catch (err) {
    logger.error('Auth', `Erreur fetchProfileById pour ${userId}`, err);
    return null
  }
}

async function fetchProfileWithRetry(userId: string, maxRetries = 3): Promise<UserProfile | null> {
  for (let i = 0; i < maxRetries; i++) {
    const profile = await fetchProfileById(userId)
    if (profile) return profile
    if (i < maxRetries - 1) {
      logger.debug('Auth', `Retry profil ${i+1}/${maxRetries}...`);
      await new Promise(r => setTimeout(r, 800))
    }
  }
  return null
}

export function useAuth(): AuthState {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const initializedRef        = useRef(false)
  const fetchIdRef            = useRef(0)

  const loadProfile = useCallback(async (userId: string, isSignIn = false) => {
    const myId = ++fetchIdRef.current
    logger.debug('Auth', `Démarrage fetch profil (ID: ${myId})`);
    const p = isSignIn
      ? await fetchProfileWithRetry(userId)
      : await fetchProfileById(userId)
    
    if (myId === fetchIdRef.current) {
      setProfile(p)
    } else {
      logger.debug('Auth', `Fetch profil ${myId} ignoré (périmé)`);
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      logger.error('Auth', 'Supabase non configuré !');
      setLoading(false); 
      return 
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null
      logger.info('Auth', `Événement: ${event}`, { userId: u?.id, email: u?.email });
      setUser(u)

      if (u) {
        // On attend que le profil soit chargé avant de terminer l'initialisation
        await loadProfile(u.id, event === 'SIGNED_IN')
      } else {
        fetchIdRef.current++
        setProfile(null)
      }

      if (!initializedRef.current) {
        logger.info('Auth', 'Initialisation terminée');
        initializedRef.current = true
        setLoading(false)
      }
    })

    const timeout = setTimeout(() => {
      if (!initializedRef.current) {
        logger.warn('Auth', 'Timeout d\'initialisation (3s)');
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
    logger.info('Auth', `Tentative connexion: ${email}`);
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  const signUp = async (email: string, password: string) => {
    logger.info('Auth', `Tentative inscription: ${email}`);
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
  }

  const signOut = async () => {
    if (!supabase) return
    logger.info('Auth', 'Déconnexion...');
    try {
      await supabase.auth.signOut()
    } catch (err) {
      logger.error('Auth', 'Erreur lors de la déconnexion', err)
    }
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
