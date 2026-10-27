import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let clientInstance = null;

export function getSupabase() {
  if (clientInstance) return clientInstance;

  if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    clientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return clientInstance;
  }

  if (typeof window !== 'undefined' && window.foodBuddySupabase) {
    return window.foodBuddySupabase;
  }

  throw new Error('Supabase SDK not loaded on window. Ensure CDN or vendor script tag is present.');
}

export async function ensureSupabase() {
  if (clientInstance) return clientInstance;
  try {
    return getSupabase();
  } catch (e) {
    // Wait up to 2 seconds for script to attach to window
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
        return getSupabase();
      }
    }
    throw e;
  }
}

export const supabase = {
  get client() {
    return getSupabase();
  },
};

if (typeof window !== 'undefined') {
  window.getSupabase = getSupabase;
  window.ensureSupabase = ensureSupabase;
  try {
    window.foodBuddySupabase = getSupabase();
  } catch (e) {
    // Will be initialized once window.supabase is available
  }
}


