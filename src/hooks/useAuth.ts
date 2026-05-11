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
  isVisitor: boolean
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
      if (p) {
        setProfile(p);
      } else {
        // En cas d'échec de fetch, on ne remet pas à null si on a déjà un profil (cache)
        // sauf si c'est explicitement une déconnexion (gérée ailleurs)
        logger.warn('Auth', `Fetch profil ${myId} n'a rien renvoyé, conservation de l'état actuel`);
      }
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

    const lastCheckRef = { current: 0 }

    const initSession = async () => {
      logger.debug('Auth', 'initSession: vérification directe de la session...');
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          logger.warn('Auth', 'initSession: erreur getSession', { code: error.status, msg: error.message });
        }
        if (session?.user) {
          logger.info('Auth', 'initSession: session valide trouvée', { userId: session.user.id, expires: session.expires_at });
          setUser(session.user)
          // Profil chargé en arrière-plan — ne bloque PAS le loading
          loadProfile(session.user.id, false).catch(e =>
            logger.warn('Auth', 'initSession: erreur loadProfile (non bloquant)', e)
          )
        } else {
          logger.debug('Auth', 'initSession: aucune session active');
        }
      } catch (e) {
        logger.warn('Auth', 'initSession: exception inattendue', e)
      } finally {
        // On lève le loading dès qu'on connaît l'état de la session — profil ou pas
        if (!initializedRef.current) {
          logger.info('Auth', 'initSession: loading levé');
          initializedRef.current = true
          setLoading(false)
        }
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      logger.info('Auth', `Événement auth: ${event}`, {
        userId: u?.id,
        email: u?.email,
        expires: session?.expires_at,
        initDone: initializedRef.current
      });

      // 1. Mise à jour immédiate de l'état user (synchrone)
      setUser(u)

      // 2. Lever le loading dès qu'on connaît l'état — sans attendre le profil
      if (!initializedRef.current) {
        logger.info('Auth', `Event ${event}: loading levé immédiatement`);
        initializedRef.current = true
        setLoading(false)
      }

      // 3. Chargement du profil en arrière-plan (asynchrone, ne bloque rien)
      if (u) {
        loadProfile(u.id, event === 'SIGNED_IN').catch(e =>
          logger.warn('Auth', 'onAuthStateChange: erreur loadProfile (non bloquant)', e)
        )
      } else {
        fetchIdRef.current++
        setProfile(null)
        localStorage.removeItem('topsys_auth_profile_cache')
      }
    })

    // Check direct immédiat (n'attend pas l'event onAuthStateChange)
    initSession();

    // Vérification périodique au retour sur l'onglet (max 1x/5min)
    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && supabase && (now - lastCheckRef.current > 300000)) {
        lastCheckRef.current = now;
        logger.debug('Auth', 'Onglet réactivé: refresh session...');
        supabase.auth.getSession().then(({ data: { session }, error }) => {
          if (error) {
            logger.warn('Auth', 'Onglet réactivé: erreur getSession', error);
          } else if (!session) {
            logger.warn('Auth', 'Onglet réactivé: session expirée — déconnexion');
            setUser(null);
            setProfile(null);
          } else {
            logger.debug('Auth', 'Onglet réactivé: session encore valide', { expires: session.expires_at });
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Filet de sécurité ultime : si ni initSession ni l'event ne se terminent en 25s
    const timeout = setTimeout(() => {
      if (!initializedRef.current) {
        logger.warn('Auth', 'TIMEOUT 25s — loading forcé. Vérifier la connectivité Supabase.');
        initializedRef.current = true
        setLoading(false)
      }
    }, 25000)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    logger.info('Auth', 'Déconnexion lancée...');
    
    // 1. Réinitialisation immédiate de l'état local pour débloquer l'UI
    setUser(null)
    setProfile(null)
    
    try {
      // 2. Déconnexion Supabase avec timeout strict de 2s
      const signOutPromise = supabase.auth.signOut({ scope: 'local' });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_SIGNOUT')), 2000));
      await Promise.race([signOutPromise, timeoutPromise]).catch(() => {
        logger.warn('Auth', 'Supabase signOut a échoué ou expiré, on force le nettoyage.');
      });
      
      // 3. Suppression ciblée uniquement de notre clé de session (pas de purge nucléaire)
      localStorage.removeItem('topsys-explorer-auth-v2');
      localStorage.removeItem(PROFILE_CACHE_KEY);
      sessionStorage.clear();
      
      logger.info('Auth', 'Déconnexion réussie, rechargement...');
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
