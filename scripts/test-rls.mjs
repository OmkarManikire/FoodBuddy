import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iycdsjnvdnvayspgqaor.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Y2Rzam52ZG52YXlzcGdxYW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzY4NDIsImV4cCI6MjEwNzMxMjg0Mn0.jfRSAMmW_QJahx0rOh1cXFZJp4SuqoHYxJ7IuutUQPs';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EDGE_FUNCTIONS = {
  sendLoginOtp: `${SUPABASE_URL}/functions/v1/send-login-otp`,
  verifyLoginOtp: `${SUPABASE_URL}/functions/v1/verify-login-otp`,
  sendResetOtp: `${SUPABASE_URL}/functions/v1/send-reset-otp`,
  resetPasswordWithOtp: `${SUPABASE_URL}/functions/v1/reset-password-with-otp`,
  registerStudent: `${SUPABASE_URL}/functions/v1/register-student`,
  completeGoogleLogin: `${SUPABASE_URL}/functions/v1/complete-google-login`,
  completeGoogleOnboarding: `${SUPABASE_URL}/functions/v1/complete-google-onboarding`,
};

function createAnonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createAdminClient() {
  if (!SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
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

async function runTests() {
  console.log('🧪 Starting Food Buddy Comprehensive Security, RLS & Google Auth Test Suite...\n');

  // ==========================================================
  // Test Suite 1: Password-Only Access Denial (RLS Enforcement)
  // ==========================================================
  console.log('--- Test Suite 1: Password-Only Access Denial (Strict RLS) ---');
  const client1 = createAnonClient();
  const { data: authData1, error: authErr1 } = await client1.auth.signInWithPassword({
    email: 'student@foodbuddy.test',
    password: 'Student@Pass2025',
  });

  assert(!authErr1 && authData1.session, 'Student can authenticate with email + password');

  // Ensure clean pre-OTP state in case of prior test runs
  await client1.rpc('clear_otp_verification');

  // Attempt to select from profiles BEFORE OTP verification
  const { data: profilesPreOtp } = await client1
    .from('profiles')
    .select('*');

  assert(
    !profilesPreOtp || profilesPreOtp.length === 0,
    'Querying profiles table after password step only returns 0 rows (ACCESS DENIED by RLS)'
  );

  // Attempt to select from valid_student_ids
  const { data: vIds } = await client1
    .from('valid_student_ids')
    .select('*');

  assert(!vIds || vIds.length === 0, 'Client cannot read valid_student_ids (Server-only table)');

  // Attempt to select from login_otps
  const { data: otps } = await client1
    .from('login_otps')
    .select('*');

  assert(!otps || otps.length === 0, 'Client cannot read login_otps (Server-only table)');

  // ==========================================================
  // Test Suite 2: Role Validation & Wrong Tab Selection
  // ==========================================================
  console.log('\n--- Test Suite 2: Role Validation (Wrong Tab Selected) ---');
  const { data: roleCheckWrong } = await client1.rpc('check_user_role', {
    selected_role: 'mess_manager',
  });

  assert(
    roleCheckWrong && roleCheckWrong.role_mismatch === true && roleCheckWrong.actual_role === 'student',
    'Selecting wrong role tab (mess_manager for student) is detected and blocked'
  );

  const { data: roleCheckCorrect } = await client1.rpc('check_user_role', {
    selected_role: 'student',
  });

  assert(
    roleCheckCorrect && roleCheckCorrect.success === true && roleCheckCorrect.role === 'student',
    'Selecting correct role tab (student for student) succeeds'
  );

  // ==========================================================
  // Test Suite 3: Registration Security & Student ID Verification
  // ==========================================================
  console.log('\n--- Test Suite 3: Registration Security & Outsider Rejection ---');
  const clientAnon = createAnonClient();

  // Test 3a: Unregistered Student ID
  const { error: regFakeErr } = await clientAnon.auth.signUp({
    email: `fake.outsider_${Date.now()}@campus.test`,
    password: 'Password123!',
    options: {
      data: {
        role: 'student',
        name: 'Outsider Imposter',
        student_id: 'FAKE999999',
        room_no: 'B-101',
        hostel_block: 'Block B - Mandakini Hostel',
      },
    },
  });

  assert(
    regFakeErr !== null,
    'Outsider with unrecognized Student ID (FAKE999999) is REJECTED by database trigger'
  );

  // Test 3b: Already Used Student ID (2025CSB1001 is used by seed student)
  const { error: regDupErr } = await clientAnon.auth.signUp({
    email: `duplicate.student_${Date.now()}@campus.test`,
    password: 'Password123!',
    options: {
      data: {
        role: 'student',
        name: 'Duplicate Student',
        student_id: '2025CSB1001',
        room_no: 'B-101',
        hostel_block: 'Block B - Mandakini Hostel',
      },
    },
  });

  assert(
    regDupErr !== null,
    'Already used Student ID (2025CSB1001) is REJECTED by database trigger'
  );

  // Test 3c: Regular signup attempting to claim 'mess_manager' role
  const { error: regManagerErr } = await clientAnon.auth.signUp({
    email: `fake.manager_${Date.now()}@campus.test`,
    password: 'Password123!',
    options: {
      data: {
        role: 'mess_manager',
        name: 'Imposter Manager',
      },
    },
  });

  assert(
    regManagerErr !== null,
    'Public client attempting to register as mess_manager without valid student ID is REJECTED'
  );

  // ==========================================================
  // Test Suite 4: Edge Function OTP Flow & Rate Limiting
  // ==========================================================
  console.log('\n--- Test Suite 4: OTP Generation, Rate Limiting & Cooldown ---');
  const token = authData1.session.access_token;

  const sendRes = await fetch(EDGE_FUNCTIONS.sendLoginOtp, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ selected_role: 'student' }),
  });

  const sendData = await sendRes.json();
  assert(sendRes.status === 200 && sendData.success === true, 'Edge function send-login-otp generates code');
  const generatedOtp = sendData.dev_otp;
  assert(Boolean(generatedOtp), `Generated 6-digit OTP code received: ${generatedOtp}`);

  // Test Cooldown: immediately request again (< 30s)
  const cooldownRes = await fetch(EDGE_FUNCTIONS.sendLoginOtp, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ selected_role: 'student' }),
  });

  const cooldownData = await cooldownRes.json();
  assert(
    cooldownRes.status === 429 && cooldownData.error.includes('wait'),
    'Resending OTP within 30 seconds returns 429 Cooldown Rate Limit'
  );

  // ==========================================================
  // Test Suite 5: OTP Verification Errors (Wrong OTP & Lockout)
  // ==========================================================
  console.log('\n--- Test Suite 5: OTP Verification Errors (Wrong Code & Max Attempts) ---');

  const wrongRes1 = await fetch(EDGE_FUNCTIONS.verifyLoginOtp, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ otp: '000000' }),
  });
  const wrongData1 = await wrongRes1.json();
  assert(
    wrongRes1.status === 400 && wrongData1.remaining_attempts === 2,
    'Attempt 1 with wrong OTP returns error and 2 remaining attempts'
  );

  const wrongRes2 = await fetch(EDGE_FUNCTIONS.verifyLoginOtp, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ otp: '000000' }),
  });
  const wrongData2 = await wrongRes2.json();
  assert(
    wrongRes2.status === 400 && wrongData2.remaining_attempts === 1,
    'Attempt 2 with wrong OTP returns error and 1 remaining attempt'
  );

  const wrongRes3 = await fetch(EDGE_FUNCTIONS.verifyLoginOtp, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ otp: '000000' }),
  });
  const wrongData3 = await wrongRes3.json();
  assert(
    wrongRes3.status === 400 && wrongData3.remaining_attempts === 0,
    'Attempt 3 with wrong OTP locks out code (Maximum attempts reached)'
  );

  // Valid OTP rejected once max attempts exceeded
  const lockedRes = await fetch(EDGE_FUNCTIONS.verifyLoginOtp, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ otp: generatedOtp }),
  });
  assert(lockedRes.status === 429, 'Even valid OTP is rejected once maximum attempts are exceeded');

  // ==========================================================
  // Test Suite 6: Full Successful Login + OTP Flow (All 3 Roles)
  // ==========================================================
  console.log('\n--- Test Suite 6: Full Successful Login + OTP Flow (Mess Manager & Authority) ---');
  
  // Test Manager
  const clientMgr = createAnonClient();
  const { data: authMgr } = await clientMgr.auth.signInWithPassword({
    email: 'manager@foodbuddy.test',
    password: 'Manager@Pass2025',
  });
  assert(Boolean(authMgr?.session), 'Mess Manager signs in with password');

  const sendMgrRes = await fetch(EDGE_FUNCTIONS.sendLoginOtp, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authMgr.session.access_token}`,
    },
    body: JSON.stringify({ selected_role: 'mess_manager' }),
  });
  const sendMgrData = await sendMgrRes.json();
  assert(sendMgrData.success === true, 'Mess Manager receives login OTP');

  const verifyMgrRes = await fetch(EDGE_FUNCTIONS.verifyLoginOtp, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authMgr.session.access_token}`,
    },
    body: JSON.stringify({ otp: sendMgrData.dev_otp }),
  });
  const verifyMgrData = await verifyMgrRes.json();
  assert(verifyMgrData.success === true && verifyMgrData.profile.role === 'mess_manager', 'Mess Manager OTP verified');

  const { data: mgrProfiles } = await clientMgr.from('profiles').select('*');
  assert(
    mgrProfiles && mgrProfiles.length > 0,
    `Mess Manager can read profiles table after OTP verification (Read ${mgrProfiles?.length} rows)`
  );

  // Test Authority
  const clientAuth = createAnonClient();
  const { data: authWarden } = await clientAuth.auth.signInWithPassword({
    email: 'authority@foodbuddy.test',
    password: 'Authority@Pass2025',
  });
  assert(Boolean(authWarden?.session), 'Higher Authority signs in with password');

  const sendAuthRes = await fetch(EDGE_FUNCTIONS.sendLoginOtp, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authWarden.session.access_token}`,
    },
    body: JSON.stringify({ selected_role: 'authority' }),
  });
  const sendAuthData = await sendAuthRes.json();
  assert(sendAuthData.success === true, 'Higher Authority receives login OTP');

  const verifyAuthRes = await fetch(EDGE_FUNCTIONS.verifyLoginOtp, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authWarden.session.access_token}`,
    },
    body: JSON.stringify({ otp: sendAuthData.dev_otp }),
  });
  const verifyAuthData = await verifyAuthRes.json();
  assert(verifyAuthData.success === true && verifyAuthData.profile.role === 'authority', 'Higher Authority OTP verified');

  const { data: wardenProfiles } = await clientAuth.from('profiles').select('*');
  assert(
    wardenProfiles && wardenProfiles.length > 0,
    `Higher Authority can read profiles table after OTP verification (Read ${wardenProfiles?.length} rows)`
  );

  // Clear OTP Verification on logout
  await clientAuth.rpc('clear_otp_verification');
  const { data: profilesPostLogout } = await clientAuth.from('profiles').select('*');
  assert(
    !profilesPostLogout || profilesPostLogout.length === 0,
    'After clear_otp_verification(), access to profiles is IMMEDIATELY DENIED again by RLS'
  );

  // ==========================================================
  // Test Suite 7: Google Sign-In & Onboarding Security Suite
  // ==========================================================
  console.log('\n--- Test Suite 7: Google Sign-In & Onboarding Security Suite ---');
  const admin = createAdminClient();

  if (!admin) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY missing, skipping simulated Google token verification tests.');
  } else {
    // 7a. Non-Google provider calling complete-google-login is rejected
    const nonGoogleRes = await fetch(EDGE_FUNCTIONS.completeGoogleLogin, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authMgr.session.access_token}`, // password/email provider
      },
      body: JSON.stringify({ requested_role: 'mess_manager' }),
    });
    const nonGoogleData = await nonGoogleRes.json();
    assert(
      nonGoogleRes.status === 403 && nonGoogleData.error.includes('Only Google sign-in'),
      'Non-Google session calling complete-google-login is REJECTED (403 Provider Mismatch)'
    );

    // Helper: Create a real Google authenticated test user via Admin API
    async function createGoogleUser(email, role = null, studentId = null) {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        await admin.auth.admin.deleteUser(existing.id);
      }

      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: 'GoogleSecretPassword123!',
        email_confirm: true,
        app_metadata: { provider: 'google', providers: ['google'] },
        user_metadata: { email_verified: true, full_name: 'Test Google User', is_google: 'true' },
      });

      if (createErr) throw createErr;

      if (role && role !== 'unregistered') {
        await admin.from('profiles').upsert({
          id: newUser.user.id,
          name: 'Test Google User',
          email: email.toLowerCase(),
          role,
          student_id: studentId,
          room_no: 'B-101',
          hostel_block: 'Aryabhatta Block',
          otp_verified_until: null,
        });
      }

      // Generate a user session
      const client = createAnonClient();
      const { data: loginData } = await client.auth.signInWithPassword({
        email,
        password: 'GoogleSecretPassword123!',
      });

      return { user: newUser.user, session: loginData.session, client };
    }

    // 7b. Known Manager Google Account (works)
    console.log('\n  Testing Known Manager Google Account...');
    const knownManager = await createGoogleUser('verified.manager@campus.edu', 'mess_manager');
    const mgrGoogleRes = await fetch(EDGE_FUNCTIONS.completeGoogleLogin, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${knownManager.session.access_token}`,
      },
      body: JSON.stringify({ requested_role: 'mess_manager' }),
    });
    const mgrGoogleData = await mgrGoogleRes.json();
    assert(
      mgrGoogleRes.status === 200 && mgrGoogleData.success === true && mgrGoogleData.role === 'mess_manager',
      'Known Mess Manager Google account completes verification successfully'
    );

    // Verify manager can read profiles after Google completion
    const { data: mgrCheck } = await knownManager.client.from('profiles').select('*');
    assert(
      mgrCheck && mgrCheck.length > 0,
      'Known Mess Manager Google account can read records under RLS'
    );

    // 7c. Unknown Google Account on Manager and Authority Portals (rejected)
    console.log('\n  Testing Unknown Google Account on Manager / Authority...');
    const unknownGoogle = await createGoogleUser('stranger.google@gmail.com', null);
    
    // Attempt manager
    const unknownMgrRes = await fetch(EDGE_FUNCTIONS.completeGoogleLogin, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unknownGoogle.session.access_token}`,
      },
      body: JSON.stringify({ requested_role: 'mess_manager' }),
    });
    const unknownMgrData = await unknownMgrRes.json();
    assert(
      unknownMgrRes.status === 403 && unknownMgrData.error === 'This Google account is not authorised for this portal',
      'Unknown Google account on Mess Manager portal is REJECTED with exact error message'
    );

    // Attempt authority
    const unknownAuthRes = await fetch(EDGE_FUNCTIONS.completeGoogleLogin, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unknownGoogle.session.access_token}`,
      },
      body: JSON.stringify({ requested_role: 'authority' }),
    });
    const unknownAuthData = await unknownAuthRes.json();
    assert(
      unknownAuthRes.status === 403 && unknownAuthData.error === 'This Google account is not authorised for this portal',
      'Unknown Google account on Authority portal is REJECTED with exact error message'
    );

    // 7d. Student Google user before onboarding (has no data access)
    console.log('\n  Testing Student Google Account Before Onboarding...');
    const freshStudent = await createGoogleUser('fresh.student@campus.edu', null);
    
    const freshStuRes = await fetch(EDGE_FUNCTIONS.completeGoogleLogin, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freshStudent.session.access_token}`,
      },
      body: JSON.stringify({ requested_role: 'student' }),
    });
    const freshStuData = await freshStuRes.json();
    assert(
      freshStuRes.status === 200 && freshStuData.needs_onboarding === true,
      'First-time Student Google login prompts needs_onboarding: true'
    );

    // Verify zero data access before onboarding
    const { data: freshProfiles } = await freshStudent.client.from('profiles').select('*');
    assert(
      !freshProfiles || freshProfiles.length === 0,
      'Student BEFORE onboarding has ZERO data access (0 profiles returned by RLS)'
    );

    // 7e. Onboarding with invalid or used Student ID (rejected)
    console.log('\n  Testing Onboarding Validation (Invalid & Duplicate IDs)...');
    
    // Invalid ID
    const invOnboardRes = await fetch(EDGE_FUNCTIONS.completeGoogleOnboarding, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freshStudent.session.access_token}`,
      },
      body: JSON.stringify({
        student_id: 'NONEXISTENT_STUDENT_999',
        room_no: 'B-201',
        hostel_block: 'Aryabhatta Block',
      }),
    });
    const invOnboardData = await invOnboardRes.json();
    assert(
      invOnboardRes.status === 400 && invOnboardData.error.includes('not found in the campus registrar roster'),
      'Onboarding with non-existent Student ID is REJECTED (400)'
    );

    // Already used ID (2025CSB1001)
    const dupOnboardRes = await fetch(EDGE_FUNCTIONS.completeGoogleOnboarding, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freshStudent.session.access_token}`,
      },
      body: JSON.stringify({
        student_id: '2025CSB1001',
        room_no: 'B-201',
        hostel_block: 'Aryabhatta Block',
      }),
    });
    const dupOnboardData = await dupOnboardRes.json();
    assert(
      dupOnboardRes.status === 400 && dupOnboardData.error.includes('already been registered'),
      'Onboarding with already registered Student ID is REJECTED (400)'
    );

    // 7f. Successful Student Onboarding with valid unused ID
    console.log('\n  Testing Successful Student Onboarding with valid unused ID...');
    // Find an unused student ID
    const { data: unusedIdRow } = await admin
      .from('valid_student_ids')
      .select('student_id')
      .eq('used', false)
      .limit(1)
      .single();

    assert(Boolean(unusedIdRow?.student_id), `Found available unused Student ID: ${unusedIdRow?.student_id}`);
    const validUnusedId = unusedIdRow.student_id;

    const validOnboardRes = await fetch(EDGE_FUNCTIONS.completeGoogleOnboarding, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freshStudent.session.access_token}`,
      },
      body: JSON.stringify({
        student_id: validUnusedId,
        room_no: 'B-201',
        hostel_block: 'Mandakini Hostel',
        name: 'Fresh Verified Student',
      }),
    });
    const validOnboardData = await validOnboardRes.json();
    assert(
      validOnboardRes.status === 200 && validOnboardData.success === true,
      `Student onboarding SUCCEEDS with valid unused ID (${validUnusedId})`
    );

    // Check valid_student_ids updated to used = true
    const { data: updatedIdRow } = await admin
      .from('valid_student_ids')
      .select('used')
      .eq('student_id', validUnusedId)
      .single();
    assert(updatedIdRow?.used === true, `Student ID ${validUnusedId} is now marked used in valid_student_ids`);

    // 7g. Normal Student Google Login after onboarding
    console.log('\n  Testing Normal Student Google Login after onboarding...');
    const postOnboardLoginRes = await fetch(EDGE_FUNCTIONS.completeGoogleLogin, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freshStudent.session.access_token}`,
      },
      body: JSON.stringify({ requested_role: 'student' }),
    });
    const postOnboardLoginData = await postOnboardLoginRes.json();
    assert(
      postOnboardLoginRes.status === 200 && postOnboardLoginData.success === true && postOnboardLoginData.role === 'student',
      'Normal Student Google Login succeeds after onboarding without prompting again'
    );

    // Check student has data access to profiles
    const { data: studentProfiles } = await freshStudent.client.from('profiles').select('*');
    assert(
      studentProfiles && studentProfiles.length > 0,
      'Onboarded Student Google session CAN now read profiles table under RLS'
    );

    // 7h. Student Google session trying /manager is BLOCKED
    console.log('\n  Testing Student Google Session trying Manager Portal...');
    const studentAsMgrRes = await fetch(EDGE_FUNCTIONS.completeGoogleLogin, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freshStudent.session.access_token}`,
      },
      body: JSON.stringify({ requested_role: 'mess_manager' }),
    });
    const studentAsMgrData = await studentAsMgrRes.json();
    assert(
      studentAsMgrRes.status === 403 && studentAsMgrData.error === 'This Google account is not authorised for this portal',
      'Student Google session attempting Mess Manager portal is BLOCKED (403)'
    );

    // Clean up temporary test users
    await admin.auth.admin.deleteUser(knownManager.user.id);
    await admin.auth.admin.deleteUser(unknownGoogle.user.id);
    await admin.auth.admin.deleteUser(freshStudent.user.id);
  }

  // ==========================================================
  // Summary
  // ==========================================================
  console.log('\n==========================================================');
  console.log(`Test Execution Finished: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('==========================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
