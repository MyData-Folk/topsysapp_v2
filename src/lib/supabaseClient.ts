import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Un fetch custom avec timeout pour éviter les requêtes infinies (deadlocks réseau)
const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000); // 15 secondes max
  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('La connexion au Cloud a expiré (Timeout). Veuillez vérifier votre connexion.');
    }
    throw error;
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
        storage: window.localStorage
      },
      global: {
        headers: { 'x-application-name': 'topsys-explorer-v2' },
        fetch: fetchWithTimeout
      }
    }) 
  : null

