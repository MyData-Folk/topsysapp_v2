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

const PROFILE_CACHE_KEY = 'topsys_auth_profile_cache';

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
    // Sauvegarde en cache
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
    return data as UserProfile
  } catch (err) {
    logger.error('Auth', `Erreur fetchProfileById pour ${userId}`, err);
    return null
  }
}

async function fetchProfileWithRetry(userId: string, maxRetries = 3): Promise<UserProfile | null> {
  // On tente d'abord de charger le cache pour débloquer l'UI immédiatement
  const cached = localStorage.getItem(PROFILE_CACHE_KEY);
  let initialProfile: UserProfile | null = null;
  if (cached) {
    try {
      const p = JSON.parse(cached);
      if (p.id === userId) initialProfile = p;
    } catch {}
  }

  for (let i = 0; i < maxRetries; i++) {
    const profile = await fetchProfileById(userId)
    if (profile) return profile
    if (i < maxRetries - 1) {
      logger.debug('Auth', `Retry profil ${i+1}/${maxRetries}...`);
      await new Promise(r => setTimeout(r, 800))
    }
  }
  return initialProfile; // On retourne le cache si tout a échoué
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
    
    // Tenter de charger le cache tout de suite
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      try {
        const p = JSON.parse(cached);
        if (p.id === userId) {
          logger.debug('Auth', 'Hydratation profil depuis le cache local');
          setProfile(p);
        }
      } catch {}
    }

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

      try {
        if (u) {
          await loadProfile(u.id, event === 'SIGNED_IN')
        } else {
          fetchIdRef.current++
          setProfile(null)
        }
      } finally {
        if (!initializedRef.current) {
          logger.info('Auth', 'Initialisation terminée via event');
          initializedRef.current = true
          setLoading(false)
        }
      }
    })

    const timeout = setTimeout(() => {
      if (!initializedRef.current) {
        logger.warn('Auth', 'Timeout d\'initialisation (3s) force la levée du chargement');
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
    logger.info('Auth', 'Déconnexion radicale lancée...');
    
    // 1. Réinitialisation immédiate de l'état local pour débloquer l'UI
    setUser(null)
    setProfile(null)
    
    try {
      // 2. Déconnexion Supabase avec timeout strict de 2s
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_SIGNOUT')), 2000));
      await Promise.race([signOutPromise, timeoutPromise]).catch(() => {
        logger.warn('Auth', 'Supabase signOut a échoué ou expiré, on force le nettoyage.');
      });
      
      // 3. Nettoyage FORCÉ de TOUT le localStorage lié à l'app et à Supabase
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem(PROFILE_CACHE_KEY);
      
      // Purge nucléaire des clés Supabase (elles commencent toutes par sb-)
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      sessionStorage.clear();
      
      logger.info('Auth', 'Nettoyage nucléaire terminé, rechargement...');
      // 4. Rechargement de la page pour repartir sur un état vierge
      window.location.reload();
    } catch (err) {
      logger.error('Auth', 'Erreur lors de la déconnexion', err);
      window.location.reload();
    }
  }

  const role       = profile?.role ?? null
  const isApproved = role === 'user' || role === 'admin'
  const isAdmin    = role === 'admin'
  const isVisitor  = !isApproved && (user !== null || role === 'pending')

  return {
    user, profile, role, isApproved, isAdmin, isVisitor, loading,
    signIn, signUp, signOut,
    refreshProfile: () => loadProfile(user?.id ?? '', false),
  }
}
