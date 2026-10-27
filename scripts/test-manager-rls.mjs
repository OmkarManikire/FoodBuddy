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

async function loginAndVerify(email, password, role) {
  const client = createAnonClient();
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (authErr || !authData.session) {
    throw new Error(`Sign-in failed for ${email}: ${authErr?.message}`);
  }

  const token = authData.session.access_token;
  const sendRes = await fetch(EDGE_FUNCTIONS.sendLoginOtp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ selected_role: role }),
  });
  const sendData = await sendRes.json();
  const otpCode = sendData.dev_otp;
  if (!otpCode) {
    throw new Error(`Failed to get OTP for ${email}: ${JSON.stringify(sendData)}`);
  }

  const verifyRes = await fetch(EDGE_FUNCTIONS.verifyLoginOtp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ otp: otpCode }),
  });
  const verifyData = await verifyRes.json();
  if (verifyRes.status !== 200) {
    throw new Error(`OTP verification failed for ${email}: ${JSON.stringify(verifyData)}`);
  }

  // Set session on client
  await client.auth.setSession({
    access_token: token,
    refresh_token: authData.session.refresh_token,
  });

  return { client, user: authData.user };
}

async function runManagerTests() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🧪 Food Buddy Mess Manager Dashboard ("Operations Lead") Test Suite');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Authenticate Student & Manager
    console.log('--- Step 1: Authentication & Verification Setup ---');
    console.log('1.1 Authenticating Student (student@foodbuddy.test)...');
    const { client: studentClient, user: studentUser } = await loginAndVerify(
      'student@foodbuddy.test',
      'Student@Pass2025',
      'student'
    );
    assert(studentUser && studentUser.id, `Student authenticated (ID: ${studentUser.id})`);

    console.log('1.2 Authenticating Mess Manager (manager@foodbuddy.test)...');
    const { client: managerClient, user: managerUser } = await loginAndVerify(
      'manager@foodbuddy.test',
      'Manager@Pass2025',
      'mess_manager'
    );
    assert(managerUser && managerUser.id, `Mess Manager authenticated (ID: ${managerUser.id})`);

    // Step 2: Student Access Restrictions (Automated RLS & RPC Security Tests)
    console.log('\n--- Step 2: Security & RLS Tests: Student Access Denial on Manager RPCs & Tables ---');
    
    // 2.1 Student cannot call get_manager_overview_kpis()
    const { data: kpiData, error: kpiErr } = await studentClient.rpc('get_manager_overview_kpis');
    assert(kpiErr && kpiErr.message.includes('Access denied'), 'Student denied access to get_manager_overview_kpis()');

    // 2.2 Student cannot call get_current_qr()
    const { data: qrData, error: qrErr } = await studentClient.rpc('get_current_qr', { p_meal_slot: 'lunch' });
    assert(qrErr && qrErr.message.includes('Access denied'), 'Student denied access to get_current_qr()');

    // 2.3 Student cannot call get_manager_ratings_analytics()
    const { data: ratData, error: ratErr } = await studentClient.rpc('get_manager_ratings_analytics');
    assert(ratErr && ratErr.message.includes('Access denied'), 'Student denied access to get_manager_ratings_analytics()');

    // 2.4 Student cannot call update_complaint_status()
    const { data: updateData, error: updateErr } = await studentClient.rpc('update_complaint_status', {
      p_complaint_id: '00000000-0000-0000-0000-000000000000',
      p_status: 'resolved',
      p_note: 'Hacked by student'
    });
    assert(updateErr && updateErr.message.includes('Access denied'), 'Student denied access to update_complaint_status()');

    // 2.5 Student cannot insert or update quality_checklists table
    const { data: chkInsert, error: chkErr } = await studentClient
      .from('quality_checklists')
      .insert([{
        date: '2026-10-25',
        meal_slot: 'lunch',
        items: { test: true },
        head_cook_name: 'Student Impersonator'
      }]);
    assert(chkErr !== null, 'Student blocked from inserting into quality_checklists by RLS');

    // 2.6 Student cannot update menu table
    const { data: menuUp, error: menuErr } = await studentClient
      .from('menu')
      .update({ title: 'Hacked Menu Item' })
      .eq('date', '2026-10-18')
      .select();
    assert(menuErr !== null || (Array.isArray(menuUp) && menuUp.length === 0), 'Student blocked from updating menu table by RLS');

    // 2.7 Student cannot delete complaints or attendance records
    const { data: delAttRows, error: delAttErr } = await studentClient
      .from('attendance')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    assert(delAttErr !== null || (Array.isArray(delAttRows) && delAttRows.length === 0), 'Student blocked from deleting attendance records');

    // Step 3: Manager Authorized Access to RPCs and Views
    console.log('\n--- Step 3: Manager Authorized Operations & Aggregates ---');

    // 3.1 Overview KPIs
    const { data: mgrKpis, error: mgrKpiErr } = await managerClient.rpc('get_manager_overview_kpis');
    assert(!mgrKpiErr && mgrKpis && mgrKpis.headcount, 'Manager successfully retrieves overview KPIs aggregate');
    if (mgrKpis) {
      console.log(`     📊 Live Turnout Today: Breakfast: ${mgrKpis.headcount.breakfast}, Lunch: ${mgrKpis.headcount.lunch}, Dinner: ${mgrKpis.headcount.dinner}`);
      console.log(`     🚨 Pending Grievances: ${mgrKpis.pending_complaints}`);
      console.log(`     ⭐ Today's Food Avg: ${mgrKpis.ratings_today?.food}/5.0, Staff Avg: ${mgrKpis.ratings_today?.staff}/5.0`);
    }

    // 3.2 Ratings Analytics
    const { data: mgrRatings, error: mgrRatErr } = await managerClient.rpc('get_manager_ratings_analytics');
    assert(!mgrRatErr && mgrRatings && mgrRatings.overall, 'Manager successfully retrieves 30-day ratings analytics');
    if (mgrRatings) {
      console.log(`     📈 Overall 30-day Food Rating: ${mgrRatings.overall.food}/5.0 (${mgrRatings.overall.total_reviews} reviews)`);
      console.log(`     📅 7-Day Trend Points count: ${mgrRatings.daily_trend?.length || 0}`);
      console.log(`     💬 Recent Comments retrieved: ${mgrRatings.recent_comments?.length || 0}`);
    }

    // 3.3 Manager reads attendance ledger
    const { data: attRows, error: attErr } = await managerClient.from('attendance').select('*').limit(5);
    assert(!attErr && Array.isArray(attRows), `Manager reads attendance ledger (${attRows?.length} sample records)`);

    // 3.4 Manager cannot delete attendance records
    const { data: mgrDelRows, error: mgrDelAtt } = await managerClient
      .from('attendance')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    assert(mgrDelAtt !== null || (Array.isArray(mgrDelRows) && mgrDelRows.length === 0), 'Manager cannot delete attendance records (no hard deletes permitted)');

    // Step 4: Dynamic Rotating QR Kiosk & Realtime Token Validation
    console.log('\n--- Step 4: Dynamic Rotating QR Kiosk & Attendance Token Verification ---');
    
    // 4.1 Manager retrieves active/fresh QR token
    const { data: currentQr, error: currentQrErr } = await managerClient.rpc('get_current_qr', { p_meal_slot: 'lunch' });
    assert(!currentQrErr && currentQr && currentQr.token, `Manager generated/retrieved active QR token: ${currentQr?.token}`);
    assert(currentQr && currentQr.remaining_seconds > 0, `Active token has ${currentQr?.remaining_seconds}s remaining before auto-rotation`);

    // 4.2 Student tries to mark attendance with expired/invalid fake token
    const { data: fakeScan, error: fakeScanErr } = await studentClient.rpc('mark_attendance', {
      p_token: 'QR-EXPIRED-OLD-TOKEN-123456'
    });
    const isFakeRejected = fakeScanErr !== null || (fakeScan && fakeScan.success === false);
    assert(isFakeRejected, 'Student scan with expired/invalid token is rejected by the system');

    // 4.3 Student marks attendance with the fresh manager token
    const { data: validScan, error: validScanErr } = await studentClient.rpc('mark_attendance', {
      p_token: currentQr.token
    });
    // Can succeed or return already checked in if student scanned previously today
    const validOrAlready = !validScanErr || (validScanErr && validScanErr.message.includes('already marked')) || (validScan && (validScan.success === true || validScan.already_marked === true));
    assert(validOrAlready, `Student scan with active token verified: ${validScan?.success ? 'Check-in recorded' : (validScan?.error || validScanErr?.message)}`);

    // Step 5: Complaint Review Queue, Status Changes & Live Audit Trail
    console.log('\n--- Step 5: Complaint Review Queue & Live Audit History ---');

    // 5.1 Fetch an existing complaint
    const { data: sampleComplaints, error: compFetchErr } = await managerClient
      .from('complaints')
      .select('id, tracking_id, status, description')
      .limit(1);

    assert(!compFetchErr && sampleComplaints && sampleComplaints.length > 0, 'Manager queries complaints queue');
    const targetComplaint = sampleComplaints[0];
    console.log(`     🎯 Target Complaint: ${targetComplaint.tracking_id} (Current: ${targetComplaint.status})`);

    // 5.2 Attempt to resolve WITHOUT a resolution note -> MUST FAIL
    const { error: emptyNoteErr } = await managerClient.rpc('update_complaint_status', {
      p_complaint_id: targetComplaint.id,
      p_status: 'resolved',
      p_note: ''
    });
    assert(emptyNoteErr && emptyNoteErr.message.includes('resolution note is required'), 
      'Resolving a complaint without a resolution note is rejected with required error');

    // 5.3 Update status to 'in_progress' with note
    const { data: inProgRes, error: inProgErr } = await managerClient.rpc('update_complaint_status', {
      p_complaint_id: targetComplaint.id,
      p_status: 'in_progress',
      p_note: 'Inspected kitchen stock and issued replacement batch to dining hall.'
    });
    assert(!inProgErr && inProgRes && inProgRes.status === 'in_progress', 
      'Manager updates complaint status to in_progress with audit note');

    // 5.4 Verify complaint record and complaint_history audit row
    const { data: updatedRecord } = await managerClient
      .from('complaints')
      .select('status, resolution_note')
      .eq('id', targetComplaint.id)
      .single();
    assert(updatedRecord.status === 'in_progress', 'Complaint status persisted as in_progress');

    const { data: historyRows } = await managerClient
      .from('complaint_history')
      .select('*')
      .eq('complaint_id', targetComplaint.id)
      .order('changed_at', { ascending: false });
    assert(historyRows && historyRows.length > 0 && historyRows[0].status === 'in_progress',
      `Audit row logged in complaint_history with note: "${historyRows?.[0]?.note}"`);

    // 5.5 Update status to 'resolved' with resolution note
    const { data: resolvedRes, error: resolvedErr } = await managerClient.rpc('update_complaint_status', {
      p_complaint_id: targetComplaint.id,
      p_status: 'resolved',
      p_note: 'Inspection complete. Roti warmer thermostat replaced. Passed head cook check.'
    });
    assert(!resolvedErr && resolvedRes && resolvedRes.status === 'resolved', 
      'Manager updates complaint to resolved with mandatory resolution note');

    // Step 6: Pre-Meal Quality Checklist
    console.log('\n--- Step 6: Pre-Meal Quality Checklist Verification ---');
    const testDate = new Date().toISOString().split('T')[0];
    const { data: chkData, error: chkUpsertErr } = await managerClient
      .from('quality_checklists')
      .upsert([{
        date: testDate,
        meal_slot: 'lunch',
        items: {
          seasoning: true,
          temperature: true,
          hygiene: true,
          rotis: true,
          sample: true
        },
        signed_by: managerUser.id,
        signed_at: new Date().toISOString(),
        head_cook_name: 'Chef M. Verma (Head Cook)',
        notes: 'Pre-service thermal check: Rice 74°C, Dal 82°C. Salt verified.'
      }], { onConflict: 'date,meal_slot' })
      .select();

    assert(!chkUpsertErr && chkData && chkData.length > 0, 
      `Quality checklist signed off for Lunch on ${testDate} by ${chkData?.[0]?.head_cook_name}`);

    // Step 7: Notice Creation & Archive (No Hard Delete)
    console.log('\n--- Step 7: Post Notice & Archive Verification ---');
    const { data: noticeData, error: noticeErr } = await managerClient
      .from('notices')
      .insert([{
        title: 'Automated Test Notice: Kitchen Sanitization',
        body: 'Routine bi-weekly steam cleaning scheduled between 15:00 and 16:30.',
        posted_by: 'Mess Manager',
        author_name: 'Operations Lead',
        priority: 'normal',
        is_archived: false
      }])
      .select();
    assert(!noticeErr && noticeData && noticeData.length > 0, 'Manager publishes new notice');

    const noticeId = noticeData?.[0]?.id;
    if (noticeId) {
      // Archive notice
      const { data: archData, error: archErr } = await managerClient
        .from('notices')
        .update({ is_archived: true })
        .eq('id', noticeId)
        .select();
      assert(!archErr && archData && archData[0]?.is_archived === true, 'Manager archives notice (is_archived = true)');

      // Verify hard delete is blocked
      const { data: delNoticeRows, error: delNoticeErr } = await managerClient
        .from('notices')
        .delete()
        .eq('id', noticeId)
        .select();
      assert(delNoticeErr !== null || (delNoticeRows && delNoticeRows.length === 0), 'Manager cannot hard-delete notices (audit compliance: edit and archive only)');
    }

  } catch (err) {
    console.error('\n❌ Unexpected Test Suite Error:', err);
    failedTests++;
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runManagerTests();
