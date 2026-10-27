// Standalone Supabase Client for Food Buddy Traditional Scripts
(function() {
  const SUPABASE_URL = 'https://hyqdrbiqubnjwebiniha.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cWRyYmlxdWJuandlYmluaWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMTM1NzYsImV4cCI6MjEwNzg4OTU3Nn0.exuJG_AUI9aujaTydj51c1OjPoKHralj0_GHItPuL3M';

  function init() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      });
      window.foodBuddySupabase = window.supabaseClient;
      return window.supabaseClient;
    }
    return null;
  }

  if (typeof window !== 'undefined') {
    init();
    if (!window.supabaseClient) {
      window.addEventListener('DOMContentLoaded', init);
    }
  }
})();
