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

  await client.auth.setSession({
    access_token: token,
    refresh_token: authData.session.refresh_token,
  });

  return { client, user: authData.user };
}

async function runAuthorityTests() {
  console.log('\n======================================================');
  console.log('   FOOD BUDDY: HIGHER AUTHORITY COMPLETE VERIFICATION');
  console.log('======================================================\n');

  console.log('1. Authenticating test actors (Student, Manager, Authority)...');
  const student = await loginAndVerify('student@foodbuddy.test', 'Student@Pass2025', 'student');
  console.log('  → Student verified (Aarav Patel)');
  
  const manager = await loginAndVerify('manager@foodbuddy.test', 'Manager@Pass2025', 'mess_manager');
  console.log('  → Mess Manager verified (Rajesh Sharma)');
  
  const authority = await loginAndVerify('authority@foodbuddy.test', 'Authority@Pass2025', 'authority');
  console.log('  → Higher Authority verified (Dr. K. Raman)');

  // --------------------------------------------------------------------------
  console.log('\n2. Testing Hourly Escalation & Seeded Complaints (>48h)...');
  // --------------------------------------------------------------------------
  {
    // Test process_complaint_escalations RPC
    const { data: escCount, error: escErr } = await authority.client.rpc('process_complaint_escalations');
    assert(!escErr, `Authority can trigger process_complaint_escalations() (Escalated count: ${escCount ?? 0})`);

    // Verify student cannot execute process_complaint_escalations
    const { error: studentEscErr } = await student.client.rpc('process_complaint_escalations');
    assert(!!studentEscErr, `Student is strictly DENIED calling process_complaint_escalations() [Error: ${studentEscErr?.message}]`);

    // Verify manager cannot execute process_complaint_escalations
    const { error: managerEscErr } = await manager.client.rpc('process_complaint_escalations');
    assert(!!managerEscErr, `Manager is strictly DENIED calling process_complaint_escalations() [Error: ${managerEscErr?.message}]`);

    // Fetch escalated complaints
    const { data: escalatedComplaints, error: fetchEscErr } = await authority.client
      .from('complaints')
      .select('id, tracking_id, status, escalated, created_at, escalated_at')
      .eq('escalated', true);
    
    assert(!fetchEscErr && escalatedComplaints && escalatedComplaints.length > 0, 
      `Authority sees escalated complaints list (${escalatedComplaints?.length || 0} found)`);
  }

  // --------------------------------------------------------------------------
  console.log('\n3. Testing Official Directives ("Authority" Badge & Access Control)...');
  // --------------------------------------------------------------------------
  let testDirectiveId = null;
  {
    // Authority posts an official directive
    const directiveTitle = `Test Warden Directive - Hygiene Inspection ${Date.now()}`;
    const { data: newDirective, error: postErr } = await authority.client
      .from('notices')
      .insert({
        title: directiveTitle,
        body: 'Mandatory steam-clean of grease traps in North Mess before 18:00 hrs.',
        priority: 'high',
        posted_by: 'Authority',
        author_name: 'Dr. K. Raman (Warden & Dean)',
        is_archived: false,
      })
      .select()
      .single();

    assert(!postErr && newDirective, `Authority posted official directive (ID: ${newDirective?.id})`);
    testDirectiveId = newDirective?.id;

    // Student can read the directive and sees posted_by === 'Authority'
    const { data: studentRead, error: studentReadErr } = await student.client
      .from('notices')
      .select('*')
      .eq('id', testDirectiveId)
      .single();

    assert(!studentReadErr && studentRead && studentRead.posted_by === 'Authority',
      `Student can read directive and verifies posted_by: "Authority"`);

    // Manager can read the directive
    const { data: managerRead, error: managerReadErr } = await manager.client
      .from('notices')
      .select('*')
      .eq('id', testDirectiveId)
      .single();

    assert(!managerReadErr && managerRead && managerRead.posted_by === 'Authority',
      `Manager can read directive and verifies posted_by: "Authority"`);

    // Student is DENIED posting notices
    const { error: studentPostErr } = await student.client
      .from('notices')
      .insert({
        title: 'Unauthorized student notice',
        body: 'This should fail',
        posted_by: 'Authority',
        author_name: 'Student',
      });
    assert(!!studentPostErr, `Student is strictly DENIED posting notices/directives [Error: ${studentPostErr?.message}]`);
  }

  // --------------------------------------------------------------------------
  console.log('\n4. Testing "Demand Accountability" & Cross-Role Notification...');
  // --------------------------------------------------------------------------
  {
    // Find an escalated complaint
    const { data: complaints, error: cErr } = await authority.client
      .from('complaints')
      .select('id, tracking_id, status')
      .limit(1);

    assert(!cErr && complaints && complaints.length > 0, `Found target complaint for accountability demand (${complaints?.[0]?.tracking_id})`);
    const targetComplaintId = complaints[0].id;
    const commentText = `Urgent corrective action memo issued by Dean on ${new Date().toISOString()}`;

    // Student CANNOT call demand_accountability
    const { error: studentDemandErr } = await student.client.rpc('demand_accountability', {
      p_complaint_id: targetComplaintId,
      p_comment: 'Student trying to demand accountability'
    });
    assert(!!studentDemandErr, `Student is strictly DENIED demand_accountability() RPC [Error: ${studentDemandErr?.message}]`);

    // Manager CANNOT call demand_accountability
    const { error: managerDemandErr } = await manager.client.rpc('demand_accountability', {
      p_complaint_id: targetComplaintId,
      p_comment: 'Manager trying to demand accountability'
    });
    assert(!!managerDemandErr, `Manager is strictly DENIED demand_accountability() RPC [Error: ${managerDemandErr?.message}]`);

    // Authority successfully calls demand_accountability
    const { data: demandRes, error: authDemandErr } = await authority.client.rpc('demand_accountability', {
      p_complaint_id: targetComplaintId,
      p_comment: commentText
    });
    assert(!authDemandErr, `Authority successfully executed demand_accountability() (Comment ID: ${demandRes})`);

    // Verify comment recorded in accountability_comments
    const { data: commentRecord, error: commentFetchErr } = await authority.client
      .from('accountability_comments')
      .select('*')
      .eq('complaint_id', targetComplaintId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    assert(!commentFetchErr && commentRecord && commentRecord.comment === commentText,
      `accountability_comments table verified with correct authority payload`);

    // Verify Manager CAN READ the accountability comments for their mess!
    const { data: managerComments, error: mCommentErr } = await manager.client
      .from('accountability_comments')
      .select('*')
      .eq('complaint_id', targetComplaintId);

    assert(!mCommentErr && managerComments && managerComments.length > 0,
      `Manager can read accountability directive in their grievance triage view (${managerComments?.length} found)`);

    // Verify complaint was marked escalated = true and escalated_at is populated
    const { data: verifiedComplaint, error: vcErr } = await authority.client
      .from('complaints')
      .select('id, escalated, escalated_at')
      .eq('id', targetComplaintId)
      .single();

    assert(!vcErr && verifiedComplaint?.escalated === true && !!verifiedComplaint?.escalated_at,
      `Target complaint status flagged as escalated with timestamp ${verifiedComplaint?.escalated_at}`);

    // Verify complaint_history audit log entry exists
    const { data: historyEntries, error: histErr } = await authority.client
      .from('complaint_history')
      .select('*')
      .eq('complaint_id', targetComplaintId)
      .eq('actor_role', 'authority');

    assert(!histErr && historyEntries && historyEntries.length > 0,
      `Audit trail logged in complaint_history with actor_role: "authority"`);
  }

  // --------------------------------------------------------------------------
  console.log('\n5. Testing Overview KPIs & Quality Index RPC Security Matrix...');
  // --------------------------------------------------------------------------
  {
    // Overview KPIs RPC
    const { data: kpis, error: kpiErr } = await authority.client.rpc('get_authority_overview_kpis');
    assert(!kpiErr && kpis, 
      `Authority fetched Overview KPIs (Total: ${kpis?.total_complaints}, Pending: ${kpis?.pending_complaints}, Escalated >48h: ${kpis?.escalated_overdue}, Food Rating: ${kpis?.overall_food_rating}★, Staff Rating: ${kpis?.overall_staff_rating}★)`);

    // Student cannot access get_authority_overview_kpis
    const { error: studentKpiErr } = await student.client.rpc('get_authority_overview_kpis');
    assert(!!studentKpiErr, `Student is strictly DENIED get_authority_overview_kpis() [Error: ${studentKpiErr?.message}]`);

    // Manager cannot access get_authority_overview_kpis
    const { error: managerKpiErr } = await manager.client.rpc('get_authority_overview_kpis');
    assert(!!managerKpiErr, `Manager is strictly DENIED get_authority_overview_kpis() [Error: ${managerKpiErr?.message}]`);

    // Quality Index RPC
    const { data: qIndex, error: qIndexErr } = await authority.client.rpc('get_authority_quality_index', { p_days: 30 });
    assert(!qIndexErr && qIndex, 
      `Authority fetched Quality Index (Daily points: ${qIndex?.daily_trajectory?.length || 0}, Category breakdown: ${qIndex?.category_defects?.length || 0})`);

    // Student cannot access get_authority_quality_index
    const { error: studentQErr } = await student.client.rpc('get_authority_quality_index', { p_days: 30 });
    assert(!!studentQErr, `Student is strictly DENIED get_authority_quality_index() [Error: ${studentQErr?.message}]`);

    // Manager cannot access get_authority_quality_index
    const { error: managerQErr } = await manager.client.rpc('get_authority_quality_index', { p_days: 30 });
    assert(!!managerQErr, `Manager is strictly DENIED get_authority_quality_index() [Error: ${managerQErr?.message}]`);
  }

  // --------------------------------------------------------------------------
  console.log('\n6. Testing Caterer Governance & Vendor Scorecard RPCs...');
  // --------------------------------------------------------------------------
  {
    const targetMonth = new Date().toISOString().substring(0, 7); // '2026-10'

    // Scorecard RPC
    const { data: scorecard, error: scoreErr } = await authority.client.rpc('get_caterer_scorecard', { p_month: targetMonth });
    assert(!scoreErr && scorecard, 
      `Authority calculated Caterer Scorecard (Score: ${scorecard?.governance_score}/100, Tier: ${scorecard?.tier}, Avg Rating: ${scorecard?.avg_food_rating}★, Escalations: ${scorecard?.escalation_count})`);

    // Student cannot access get_caterer_scorecard
    const { error: studentScoreErr } = await student.client.rpc('get_caterer_scorecard', { p_month: targetMonth });
    assert(!!studentScoreErr, `Student is strictly DENIED get_caterer_scorecard() [Error: ${studentScoreErr?.message}]`);

    // Manager cannot access get_caterer_scorecard
    const { error: managerScoreErr } = await manager.client.rpc('get_caterer_scorecard', { p_month: targetMonth });
    assert(!!managerScoreErr, `Manager is strictly DENIED get_caterer_scorecard() [Error: ${managerScoreErr?.message}]`);

    // Record Governance Action: Penalty
    const penaltyNote = `₹5,000 SLA penalty applied for overdue hygiene resolution on ${targetMonth}`;
    const { data: govActionId, error: actionErr } = await authority.client.rpc('record_governance_action', {
      p_month: targetMonth,
      p_action: 'penalty',
      p_note: penaltyNote
    });
    assert(!actionErr, `Authority recorded vendor penalty action via RPC (Action ID: ${govActionId})`);

    // Record Governance Action: Renewal recommendation
    const renewalNote = `Vendor recommended for 3-month conditional renewal pending hygiene audit`;
    const { data: renewActionId, error: renewErr } = await authority.client.rpc('record_governance_action', {
      p_month: targetMonth,
      p_action: 'renewal',
      p_note: renewalNote
    });
    assert(!renewErr, `Authority recorded renewal recommendation via RPC (Action ID: ${renewActionId})`);

    // Student cannot call record_governance_action
    const { error: studentActionErr } = await student.client.rpc('record_governance_action', {
      p_month: targetMonth,
      p_action: 'penalty',
      p_note: 'Unauthorized penalty'
    });
    assert(!!studentActionErr, `Student is strictly DENIED record_governance_action() [Error: ${studentActionErr?.message}]`);

    // Manager cannot call record_governance_action
    const { error: managerActionErr } = await manager.client.rpc('record_governance_action', {
      p_month: targetMonth,
      p_action: 'penalty',
      p_note: 'Unauthorized penalty'
    });
    assert(!!managerActionErr, `Manager is strictly DENIED record_governance_action() [Error: ${managerActionErr?.message}]`);

    // Verify governance_actions table read
    const { data: govRecords, error: govFetchErr } = await authority.client
      .from('governance_actions')
      .select('*')
      .eq('month', targetMonth)
      .order('created_at', { ascending: false });

    assert(!govFetchErr && govRecords && govRecords.length >= 2,
      `governance_actions table contains recorded actions (${govRecords?.length} entries)`);

    // Student cannot read governance_actions table
    const { data: studentGovRead, error: studentGovErr } = await student.client
      .from('governance_actions')
      .select('*');
    assert(!!studentGovErr || (studentGovRead && studentGovRead.length === 0),
      `Student is blocked from viewing governance_actions table by RLS`);
  }

  // --------------------------------------------------------------------------
  console.log('\n7. Testing Full Audit Trail Read-Only Guarantee (Authority cannot alter complaint data)...');
  // --------------------------------------------------------------------------
  {
    // Authority can read all complaints
    const { data: allComplaints, error: readAllErr } = await authority.client
      .from('complaints')
      .select('id, tracking_id, description, status, category, created_at, resolved_at');
    assert(!readAllErr && allComplaints && allComplaints.length > 0,
      `Authority can view full audit trail (${allComplaints?.length} complaints accessible)`);

    // Authority CANNOT edit complaint title, category or description directly
    if (allComplaints && allComplaints.length > 0) {
      const sampleId = allComplaints[0].id;
      const { data: updateData, error: editErr } = await authority.client
        .from('complaints')
        .update({ description: 'Unauthorized modification by authority' })
        .eq('id', sampleId)
        .select();

      // The policy "authority_read_all_complaints" only grants SELECT. UPDATE is restricted to student/manager.
      assert(!!editErr || (!updateData || updateData.length === 0), `Authority CANNOT directly edit complaint content (SELECT-only RLS verified)`);
    }
  }

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED out of ${totalTests} total tests`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAuthorityTests().catch(err => {
  console.error('\nFatal error running authority test suite:', err);
  process.exit(1);
});
