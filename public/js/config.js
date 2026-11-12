// Food Buddy Client Configuration
// Generated during build: 2026-11-12T14:25:51.994Z
export const SUPABASE_URL = 'https://iycdsjnvdnvayspgqaor.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Y2Rzam52ZG52YXlzcGdxYW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzY4NDIsImV4cCI6MjEwNzMxMjg0Mn0.jfRSAMmW_QJahx0rOh1cXFZJp4SuqoHYxJ7IuutUQPs';

export const EDGE_FUNCTIONS = {
  sendLoginOtp: `${SUPABASE_URL}/functions/v1/send-login-otp`,
  verifyLoginOtp: `${SUPABASE_URL}/functions/v1/verify-login-otp`,
  sendResetOtp: `${SUPABASE_URL}/functions/v1/send-reset-otp`,
  resetPasswordWithOtp: `${SUPABASE_URL}/functions/v1/reset-password-with-otp`,
  registerStudent: `${SUPABASE_URL}/functions/v1/register-student`,
  completeGoogleLogin: `${SUPABASE_URL}/functions/v1/complete-google-login`,
  completeGoogleOnboarding: `${SUPABASE_URL}/functions/v1/complete-google-onboarding`,
};

export const isLocalDev = Boolean(
  typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.endsWith('.local')
  )
);
