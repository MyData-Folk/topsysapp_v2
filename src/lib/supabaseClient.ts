import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Un fetch custom avec timeout pour éviter les requêtes infinies (deadlocks réseau)
const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 25000); // 25 secondes pour les environnements lents
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(id);
  }
};

// null when env vars are absent — app remains fully functional without Supabase
export const supabase: SupabaseClient | null = (url && key) 
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Clé de stockage explicite pour éviter les collisions entre versions/onglets
        storageKey: 'topsys-explorer-auth-v2',
        storage: window.localStorage,
        // PKCE est le flow recommandé : il gère le multi-onglet nativement
        // et ne crée pas de conflit de token entre fenêtres
        flowType: 'pkce',
      },
      global: {
        headers: { 'x-application-name': 'topsys-explorer-v2' },
        fetch: fetchWithTimeout
      }
    }) 
  : null

