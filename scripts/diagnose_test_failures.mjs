import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hyqdrbiqubnjwebiniha.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cWRyYmlxdWJuandlYmluaWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMTM1NzYsImV4cCI6MjEwNzg4OTU3Nn0.exuJG_AUI9aujaTydj51c1OjPoKHralj0_GHItPuL3M';

const EDGE_FUNCTIONS = {
  sendLoginOtp: `${SUPABASE_URL}/functions/v1/send-login-otp`,
  verifyLoginOtp: `${SUPABASE_URL}/functions/v1/verify-login-otp`,
};

function createAnonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loginAndVerify(email, password, role) {
  const client = createAnonClient();
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({ email, password });
  const token = authData.session.access_token;
  const sendRes = await fetch(EDGE_FUNCTIONS.sendLoginOtp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ selected_role: role }),
  });
  const sendData = await sendRes.json();
  const otpCode = sendData.dev_otp;
  await fetch(EDGE_FUNCTIONS.verifyLoginOtp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ otp: otpCode }),
  });
  await client.auth.setSession({ access_token: token, refresh_token: authData.session.refresh_token });
  return client;
}

async function diagnose() {
  const student = await loginAndVerify('student@foodbuddy.test', 'Student@Pass2025', 'student');
  const manager = await loginAndVerify('manager@foodbuddy.test', 'Manager@Pass2025', 'mess_manager');

  console.log('--- 1. Student update menu ---');
  const res1 = await student.from('menu').update({ title: 'Hacked' }).eq('date', '2026-10-18').select();
  console.log('menu update result:', JSON.stringify(res1));

  console.log('--- 2. Student delete attendance ---');
  const res2 = await student.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000').select();
  console.log('attendance delete result:', JSON.stringify(res2));

  console.log('--- 3. Manager get_manager_ratings_analytics ---');
  const res3 = await manager.rpc('get_manager_ratings_analytics');
  console.log('ratings analytics result:', JSON.stringify(res3));

  console.log('--- 4. Manager delete attendance ---');
  const res4 = await manager.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000').select();
  console.log('manager attendance delete result:', JSON.stringify(res4));

  console.log('--- 5. Student mark attendance fake token ---');
  const res5 = await student.rpc('mark_attendance', { p_token: 'QR-EXPIRED-OLD-TOKEN-123456' });
  console.log('fake token result:', JSON.stringify(res5));

  console.log('--- 6. Manager insert notice ---');
  const res6 = await manager.from('notices').insert([{
    title: 'Automated Test Notice',
    body: 'Testing',
    posted_by: 'Mess Manager',
    author_name: 'Operations Lead',
    priority: 'normal',
    is_archived: false
  }]).select();
  console.log('notice insert result:', JSON.stringify(res6));
}

diagnose();
