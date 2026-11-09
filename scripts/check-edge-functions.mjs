import 'dotenv/config';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iycdsjnvdnvayspgqaor.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const functions = [
  'send-login-otp',
  'verify-login-otp',
  'send-reset-otp',
  'reset-password-with-otp',
  'register-student',
  'complete-google-login',
  'complete-google-onboarding',
];

console.log('Testing Edge Function deployments at:', SUPABASE_URL);

for (const fn of functions) {
  const url = `${SUPABASE_URL}/functions/v1/${fn}`;
  try {
    // OPTIONS request for CORS check
    const optionsRes = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Origin': 'http://localhost:3000',
      },
    });

    // POST request with dummy or empty payload to see if function executes (returns 400/401/403 rather than 404)
    const postRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({}),
    });

    const bodyText = await postRes.text();
    let parsed = null;
    try { parsed = JSON.parse(bodyText); } catch {}

    const isDeployed = postRes.status !== 404;
    console.log(`${isDeployed ? '✅' : '❌'} ${fn.padEnd(28)}: Status ${postRes.status} (OPTIONS ${optionsRes.status}) - ${parsed?.error || parsed?.message || bodyText.slice(0, 60)}`);
  } catch (err) {
    console.error(`❌ ${fn}: Network Error: ${err.message}`);
  }
}
