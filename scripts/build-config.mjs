#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.resolve('public/js/config.js');

// Default fallback values (public by design)
const DEFAULT_SUPABASE_URL = 'https://iycdsjnvdnvayspgqaor.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Y2Rzam52ZG52YXlzcGdxYW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzY4NDIsImV4cCI6MjEwNzMxMjg0Mn0.jfRSAMmW_QJahx0rOh1cXFZJp4SuqoHYxJ7IuutUQPs';

const supabaseUrl = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

// Safety check: ensure service role key is NEVER injected into client config
if (process.env.SUPABASE_SERVICE_ROLE_KEY && supabaseAnonKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: SUPABASE_ANON_KEY matches SUPABASE_SERVICE_ROLE_KEY. Never inject service role keys into client config!');
  process.exit(1);
}

const configContent = `// Food Buddy Client Configuration
// Generated during build: ${new Date().toISOString()}
export const SUPABASE_URL = '${supabaseUrl}';
export const SUPABASE_ANON_KEY = '${supabaseAnonKey}';

export const EDGE_FUNCTIONS = {
  sendLoginOtp: \`\${SUPABASE_URL}/functions/v1/send-login-otp\`,
  verifyLoginOtp: \`\${SUPABASE_URL}/functions/v1/verify-login-otp\`,
  sendResetOtp: \`\${SUPABASE_URL}/functions/v1/send-reset-otp\`,
  resetPasswordWithOtp: \`\${SUPABASE_URL}/functions/v1/reset-password-with-otp\`,
  registerStudent: \`\${SUPABASE_URL}/functions/v1/register-student\`,
  completeGoogleLogin: \`\${SUPABASE_URL}/functions/v1/complete-google-login\`,
  completeGoogleOnboarding: \`\${SUPABASE_URL}/functions/v1/complete-google-onboarding\`,
};

export const isLocalDev = Boolean(
  typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.endsWith('.local')
  )
);
`;

fs.writeFileSync(CONFIG_FILE, configContent, 'utf8');
console.log('✅ Generated public/js/config.js with Supabase URL:', supabaseUrl);
