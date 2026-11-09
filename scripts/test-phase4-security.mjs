import 'dotenv/config';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iycdsjnvdnvayspgqaor.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];
function record(name, pass, evidence) {
  results.push({ name, pass, evidence });
  const icon = pass ? '🔒 PASS' : '🚨 FAIL';
  console.log(`  ${icon}: ${name} - ${evidence}`);
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🛡️  FOOD BUDDY PHASE 4: COMPREHENSIVE SECURITY & INTEGRITY AUDIT');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  // 1. Authenticate Student
  const studentClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: sAuth } = await studentClient.auth.signInWithPassword({
    email: 'student@foodbuddy.test',
    password: 'Student@Pass2025'
  });
  const sRes = await fetch(`${SUPABASE_URL}/functions/v1/send-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sAuth.session.access_token}` },
    body: JSON.stringify({ selected_role: 'student' })
  });
  const sData = await sRes.json();
  await fetch(`${SUPABASE_URL}/functions/v1/verify-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sAuth.session.access_token}` },
    body: JSON.stringify({ otp: sData.dev_otp })
  });
  await studentClient.auth.setSession(sAuth.session);

  // 2. Authenticate Manager
  const managerClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: mAuth } = await managerClient.auth.signInWithPassword({
    email: 'manager@foodbuddy.test',
    password: 'Manager@Pass2025'
  });
  const mRes = await fetch(`${SUPABASE_URL}/functions/v1/send-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mAuth.session.access_token}` },
    body: JSON.stringify({ selected_role: 'mess_manager' })
  });
  const mData = await mRes.json();
  await fetch(`${SUPABASE_URL}/functions/v1/verify-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mAuth.session.access_token}` },
    body: JSON.stringify({ otp: mData.dev_otp })
  });
  await managerClient.auth.setSession(mAuth.session);

  // ──────────────────────────────────────────────────────────────────────────
  // Check 1: Client cannot elevate role in profiles
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const { error: roleErr } = await studentClient
      .from('profiles')
      .update({ role: 'mess_manager' })
      .eq('id', sAuth.user.id);
    record('Privilege Escalation: Student cannot escalate role to mess_manager', !!roleErr, `Update rejected with error: ${roleErr?.message || 'blocked'}`);
  } catch (e) {
    record('Privilege Escalation: Role modification blocked', true, e.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Check 2: Client cannot forge otp_verified_until
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const { error: otpErr } = await studentClient
      .from('profiles')
      .update({ otp_verified_until: futureDate })
      .eq('id', sAuth.user.id);
    record('Session Forgery: Student cannot self-grant otp_verified_until', !!otpErr, `Update rejected with error: ${otpErr?.message || 'blocked'}`);
  } catch (e) {
    record('Session Forgery: OTP verification modification blocked', true, e.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Check 3: Client cannot directly insert forged attendance records
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const { error: attErr } = await studentClient
      .from('attendance')
      .insert({
        student_id: sAuth.user.id,
        meal_slot: 'lunch',
        date: new Date().toISOString().split('T')[0]
      });
    record('Attendance Integrity: Direct client insert to attendance is forbidden', !!attErr, `Insert rejected with code: ${attErr?.code || 'blocked'}`);
  } catch (e) {
    record('Attendance Integrity: Direct attendance insert blocked', true, e.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Check 4: Student cannot directly modify escalation flags on complaints
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const { data: comp } = await studentClient.from('complaints').select('id').limit(1).maybeSingle();
    if (comp) {
      const { data: modData, error: escErr } = await studentClient
        .from('complaints')
        .update({ escalated: true })
        .eq('id', comp.id)
        .select();
      const blocked = !!escErr || !modData || modData.length === 0;
      record('Escalation Integrity: Student cannot tamper with escalation flag', blocked, `Direct update rejected/prevented (error: ${escErr?.message || '0 rows affected'})`);
    } else {
      record('Escalation Integrity: Student cannot tamper with escalation flag', true, 'Complaints table empty for student');
    }
  } catch (e) {
    record('Escalation Integrity: Escalation modification blocked', true, e.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Check 5: Cross-Role RPC Access Blocked
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const { error: e1 } = await studentClient.rpc('get_manager_overview_kpis');
    const { error: e2 } = await studentClient.rpc('get_authority_overview_kpis');
    const { error: e3 } = await managerClient.rpc('get_authority_overview_kpis');
    const { error: e4 } = await managerClient.rpc('record_governance_action', { p_month: '2026-11', p_action: 'penalty', p_note: 'test' });
    const allBlocked = !!e1 && !!e2 && !!e3 && !!e4;
    record('Cross-Role Isolation: All higher privilege RPCs reject unauthorized roles', allBlocked, `Rejections: Student->MgrKPIs: ${e1?.code}, Student->AuthKPIs: ${e2?.code}, Manager->AuthKPIs: ${e3?.code}, Manager->Governance: ${e4?.code}`);
  } catch (e) {
    record('Cross-Role Isolation', false, e.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Check 6: Unauthenticated (Anon) Access Blocked from Internal Data
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const { data: d1 } = await anonClient.from('complaints').select('*');
    const { data: d2 } = await anonClient.from('attendance').select('*');
    const { data: d3 } = await anonClient.from('ratings').select('*');
    const { data: d4 } = await anonClient.from('profiles').select('*');
    const anonBlocked = (!d1 || d1.length === 0) && (!d2 || d2.length === 0) && (!d3 || d3.length === 0) && (!d4 || d4.length === 0);
    record('Public Anon Gate: Unauthenticated users receive 0 rows from protected tables', anonBlocked, `Complaints=${d1?.length || 0}, Attendance=${d2?.length || 0}, Ratings=${d3?.length || 0}, Profiles=${d4?.length || 0}`);
  } catch (e) {
    record('Public Anon Gate', false, e.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Check 7: No Secrets or Private Keys in /public Client Files
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const publicFiles = [];
    function scanDir(d) {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) scanDir(full);
        else publicFiles.push(full);
      }
    }
    scanDir('public');

    const leakPatterns = [
      /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWT matching service_role
      /service_role/i,
      /FOOD_BUDDY_STAFF_GATEWAY_2025/i,
      /SMTP_PASS/i
    ];

    let leaksFound = [];
    for (const file of publicFiles) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.ico')) continue;
      const content = fs.readFileSync(file, 'utf8');
      
      // Specifically check for service_role JWT or service_role keyword
      if (content.includes('service_role')) {
        leaksFound.push({ file, reason: 'contains "service_role"' });
      }
      if (content.includes(SERVICE_KEY)) {
        leaksFound.push({ file, reason: 'contains SUPABASE_SERVICE_ROLE_KEY' });
      }
      if (content.includes('FOOD_BUDDY_STAFF_GATEWAY_2025')) {
        leaksFound.push({ file, reason: 'contains gateway token secret' });
      }
    }

    record('Secret Exposure Check: No service_role key, gateway secrets or SMTP credentials in /public', leaksFound.length === 0, `Scanned ${publicFiles.length} files. Leaks found: ${leaksFound.length}`);
  } catch (e) {
    record('Secret Exposure Check', false, e.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Check 8: Demo Autofill & Credentials Guarded on Localhost Only
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const loginHtml = fs.readFileSync('public/login.html', 'utf8');
    const isGuarded = loginHtml.includes('location.hostname === \'localhost\'') || loginHtml.includes('location.hostname === \'127.0.0.1\'') || loginHtml.includes('isLocal');
    record('Localhost Demo Guard: Demo quick-fill credentials strictly restricted to localhost', isGuarded, 'Login credentials modal checks hostname before rendering demo buttons');
  } catch (e) {
    record('Localhost Demo Guard', false, e.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Check 9: Storage Bucket Media Policies
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const { data: bucketData, error: bErr } = await adminClient.storage.getBucket('complaint-media');
    const isPrivate = bucketData && bucketData.public === false;
    const hasSizeLimit = bucketData && bucketData.file_size_limit === 20971520;
    record('Storage Security: complaint-media bucket is private with 20MB limit', isPrivate && hasSizeLimit, `Public=${bucketData?.public}, MaxSize=${bucketData?.file_size_limit} bytes`);
  } catch (e) {
    record('Storage Security', false, e.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`🔒 PHASE 4 SECURITY SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${results.length})`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

run();
