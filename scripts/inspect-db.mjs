import 'dotenv/config';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const candidateTables = [
  'profiles',
  'valid_student_ids',
  'login_otps',
  'password_reset_tokens',
  'menu',
  'attendance',
  'ratings',
  'complaints',
  'complaint_history',
  'notices',
  'notice_reads',
  'qr_sessions',
  'food_suggestions',
  'food_suggestion_votes',
  'quality_checklists',
  'accountability_comments',
  'governance_actions',
  'cron_logs',
];

console.log('Inspecting public tables in Supabase...');

for (const t of candidateTables) {
  const { data, count, error } = await client.from(t).select('*', { count: 'exact' }).limit(1);
  if (error) {
    console.log(`❌ ${t.padEnd(25)}: ERROR -> ${error.message} (${error.code})`);
  } else {
    const cols = data && data.length > 0 ? Object.keys(data[0]) : '(empty table)';
    console.log(`✅ ${t.padEnd(25)}: EXISTS, count=${count}, sample keys: ${Array.isArray(cols) ? cols.join(', ') : cols}`);
  }
}

