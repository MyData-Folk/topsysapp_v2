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
        detectSessionInUrl: false, // false pour éviter les boucles de redirection en SPA
        // Clé de stockage explicite et stable — évite les collisions entre onglets/versions
        storageKey: 'topsys-explorer-auth-v2',
        storage: window.localStorage,
        // NE PAS utiliser flowType: 'pkce' — le code_verifier est en sessionStorage
        // (non partagé entre fenêtres) ce qui bloque le refresh dans les nouvelles fenêtres
      },
      global: {
        headers: { 'x-application-name': 'topsys-explorer-v2' },
        fetch: fetchWithTimeout
      }
    }) 
  : null

