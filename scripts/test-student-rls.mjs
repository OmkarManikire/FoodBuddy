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

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runStudentTests() {
  console.log('🧪 Starting Food Buddy Student Dashboard Security & RLS Test Suite...\n');

  // Step 1: Login & Verify OTP for Student Aarav Patel
  console.log('--- Step 1: Student Authentication & OTP Verification ---');
  const studentClient = createAnonClient();
  const { data: authData, error: authErr } = await studentClient.auth.signInWithPassword({
    email: 'student@foodbuddy.test',
    password: 'Student@Pass2025',
  });
  assert(!authErr && authData.session, 'Student signs in with password');

  const token = authData.session.access_token;
  const sendRes = await fetch(EDGE_FUNCTIONS.sendLoginOtp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ selected_role: 'student' }),
  });
  const sendData = await sendRes.json();
  const otpCode = sendData.dev_otp;
  assert(sendRes.status === 200 && otpCode, `Received dev OTP code: ${otpCode}`);

  const verifyRes = await fetch(EDGE_FUNCTIONS.verifyLoginOtp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ otp: otpCode }),
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 200 && verifyData.success, 'Student OTP verified successfully (12-hour session granted)');

  // Step 2: Test get_student_kpis RPC
  console.log('\n--- Step 2: Live KPI Cards RPC ---');
  const { data: kpiData, error: kpiErr } = await studentClient.rpc('get_student_kpis');
  assert(!kpiErr && kpiData.success, `KPI RPC succeeds: Meals=${kpiData?.meals_attended}, OpenComplaints=${kpiData?.open_complaints}, UnreadNotices=${kpiData?.unread_notices}`);

  // Step 3: Test Menu Read Access
  console.log('\n--- Step 3: Menu Access & Details ---');
  const { data: menuList, error: menuErr } = await studentClient
    .from('menu')
    .select('*')
    .order('meal_slot');
  assert(!menuErr && menuList && menuList.length >= 4, `Student can read active menu items (Retrieved ${menuList?.length} meal slots)`);

  // Step 4: Test Notice Feeds & Notice Reads
  console.log('\n--- Step 4: Notices Feed & Mark as Read ---');
  const { data: noticesList, error: noticesErr } = await studentClient
    .from('notices')
    .select('*')
    .order('created_at', { ascending: false });
  assert(!noticesErr && noticesList && noticesList.length >= 3, `Student can read active circulars (Retrieved ${noticesList?.length} notices)`);

  const firstNoticeId = noticesList[0].id;
  const { data: readRes, error: readErr } = await studentClient.rpc('mark_notice_as_read', {
    p_notice_id: firstNoticeId,
  });
  assert(!readErr && readRes?.success, 'Student marks notice as read via RPC');

  // Step 5: Test QR Attendance Flow
  console.log('\n--- Step 5: QR Attendance Marking & Rejection Tests ---');
  // 5a. Invalid Token
  const { data: fakeScan } = await studentClient.rpc('mark_attendance', { p_token: 'FB-INVALID-TOKEN' });
  assert(fakeScan && !fakeScan.success && fakeScan.error.includes('Invalid QR code'), 'Invalid QR code is rejected');

  // 5b. Expired Token
  const { data: expiredScan } = await studentClient.rpc('mark_attendance', { p_token: 'FB-EXPIRED-TEST' });
  assert(expiredScan && !expiredScan.success && expiredScan.error.includes('expired'), 'Expired QR code is rejected');

  // 5c. Valid Token
  const { data: validScan } = await studentClient.rpc('mark_attendance', { p_token: 'FB-DINNER-2025' });
  const isOkScan = validScan && (validScan.success || (validScan.already_marked && validScan.meal_slot));
  assert(isOkScan, `Attendance scan verified: ${validScan?.meal_slot} (success or already marked)`);

  // 5d. Duplicate Scan
  const { data: dupScan } = await studentClient.rpc('mark_attendance', { p_token: 'FB-DINNER-2025' });
  assert(dupScan && !dupScan.success && dupScan.already_marked, `Duplicate attendance scan is rejected: "${dupScan?.error}"`);

  // 5e. Direct client INSERT into attendance is blocked by RLS
  const { error: directAttErr } = await studentClient
    .from('attendance')
    .insert({ meal_slot: 'snacks', date: new Date().toISOString().split('T')[0] });
  assert(directAttErr !== null, 'Direct client INSERT on attendance table is DENIED by RLS (Must use mark_attendance RPC)');

  // 5f. Direct client SELECT on qr_sessions is blocked by RLS (Server-only table)
  const { data: qrSessions, error: qrErr } = await studentClient
    .from('qr_sessions')
    .select('*');
  assert(!qrSessions || qrSessions.length === 0, 'qr_sessions table is completely blocked from client reads (0 rows returned)');

  // Step 6: Test Ratings & Duplicate Rating Prevention
  console.log('\n--- Step 6: Rate Food Flow & Duplicate Restriction ---');
  const todayDate = new Date().toISOString().split('T')[0];
  const { data: rateRes, error: rateErr } = await studentClient
    .from('ratings')
    .insert({
      student_id: authData.user.id,
      meal_slot: 'dinner',
      date: todayDate,
      food_rating: 4,
      staff_rating: 5,
      hygiene_rating: 4,
      comment: 'Delicious paneer and crispy roti!',
    })
    .select();
  const isOkRate = (!rateErr && rateRes && rateRes.length > 0) || rateErr?.message?.includes('duplicate key');
  assert(isOkRate, 'Student meal rating submitted or unique constraint active');

  // Duplicate rating for same meal slot and day
  const { error: dupRateErr } = await studentClient
    .from('ratings')
    .insert({
      student_id: authData.user.id,
      meal_slot: 'dinner',
      date: todayDate,
      food_rating: 5,
    });
  assert(dupRateErr !== null, 'Duplicate rating for same meal slot and date is REJECTED by unique constraint');

  // Step 7: Test Complaints Flow & Rate Limiting
  console.log('\n--- Step 7: Complaint Registration & Rate Limiting ---');
  const { data: compRes, error: compErr } = await studentClient.rpc('create_complaint', {
    p_category: 'Food Quality',
    p_description: 'Rice was slightly undercooked during today lunch.',
    p_media_paths: ['test_photo.jpg'],
  });
  const isOkComp = (!compErr && compRes?.success && compRes?.tracking_id?.startsWith('FB-')) || (compRes && compRes.error?.includes('Rate limit exceeded'));
  assert(isOkComp, `Complaint registration or rate limit check verified: ${compRes?.tracking_id || compRes?.error}`);

  // Test rate limiting by creating complaints until rate limit is reached
  let hitRateLimit = false;
  for (let i = 0; i < 6; i++) {
    const { data: spamComp } = await studentClient.rpc('create_complaint', {
      p_category: 'Other',
      p_description: `Test stress complaint #${i + 1}`,
    });
    if (spamComp && !spamComp.success && spamComp.error?.includes('Rate limit exceeded')) {
      hitRateLimit = true;
      break;
    }
  }
  assert(hitRateLimit, 'Rate limit (>5 complaints/hour per student) is successfully triggered and enforced');

  // Step 8: Strict Cross-User Data Isolation (RLS)
  console.log('\n--- Step 8: Cross-User Data Isolation (Strict RLS) ---');
  // Sign in as pre-seeded Student 2 (Rohan Sharma, 2025CSB1002)
  const client2 = createAnonClient();
  const { data: authB, error: authBErr } = await client2.auth.signInWithPassword({
    email: 'student2@foodbuddy.test',
    password: 'Student2@Pass2025',
  });
  assert(!authBErr && authB?.session, 'Student B (Rohan Sharma) signs in with password');

  const tokenB = authB.session.access_token;
  const sendResB = await fetch(EDGE_FUNCTIONS.sendLoginOtp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ selected_role: 'student' }),
  });
  const sendDataB = await sendResB.json();
  const verifyResB = await fetch(EDGE_FUNCTIONS.verifyLoginOtp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ otp: sendDataB.dev_otp }),
  });
  assert(verifyResB.status === 200, 'Student B OTP verified');

  // Student B tries to read complaints
  const { data: compB } = await client2.from('complaints').select('*');
  const hasStudentAComplaints = compB.some((c) => c.student_id === authData.user.id);
  assert(!hasStudentAComplaints, "Student B CANNOT see Student A's complaints (Strict RLS Isolation)");

  // Student B tries to read attendance
  const { data: attB } = await client2.from('attendance').select('*');
  const hasStudentAAttendance = attB.some((a) => a.student_id === authData.user.id);
  assert(!hasStudentAAttendance, "Student B CANNOT see Student A's attendance records (Strict RLS Isolation)");

  // Student B tries to read ratings
  const { data: ratingsB } = await client2.from('ratings').select('*');
  const hasStudentARatings = ratingsB.some((r) => r.student_id === authData.user.id);
  assert(!hasStudentARatings, "Student B CANNOT see Student A's food ratings (Strict RLS Isolation)");

  console.log('\n==========================================================');
  console.log(`Student Dashboard Test Execution: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('==========================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runStudentTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
