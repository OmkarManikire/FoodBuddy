// Standalone Supabase Client for Food Buddy Traditional Scripts
(function() {
  const SUPABASE_URL = 'https://iycdsjnvdnvayspgqaor.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Y2Rzam52ZG52YXlzcGdxYW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzY4NDIsImV4cCI6MjEwNzMxMjg0Mn0.jfRSAMmW_QJahx0rOh1cXFZJp4SuqoHYxJ7IuutUQPs';

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
