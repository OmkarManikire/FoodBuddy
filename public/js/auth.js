import { getSupabase } from './supabase.js';
import { EDGE_FUNCTIONS, isLocalDev } from './config.js';

export async function getCurrentUser() {
  const supabase = getSupabase();
  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !session) return null;

  // Fetch verified profile
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  return {
    session,
    user: session.user,
    profile: profile || null,
    isOtpVerified: Boolean(profile && profile.otp_verified_until && new Date(profile.otp_verified_until) > new Date()),
  };
}

export async function requireAuth(expectedRole = 'student') {
  const authState = await getCurrentUser();
  if (!authState || !authState.session) {
    window.location.replace(`/login.html?redirect=${encodeURIComponent(window.location.pathname)}`);
    return null;
  }

  // If OTP is not verified yet, redirect to verify-otp
  if (!authState.isOtpVerified) {
    window.location.replace(`/verify-otp.html?role=${expectedRole}`);
    return null;
  }

  // Check role matching
  if (authState.profile && authState.profile.role !== expectedRole) {
    const roleRoutes = {
      student: '/student/',
      mess_manager: '/manager/',
      authority: '/authority/',
    };
    const targetRoute = roleRoutes[authState.profile.role] || '/login.html';
    window.location.replace(targetRoute);
    return null;
  }

  return authState;
}

export async function signOut() {
  try {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await Promise.race([
          supabase.rpc('clear_otp_verification'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
        ]);
      } catch (rpcErr) {
        // Ignore RPC error or timeout if session expired
      }

      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 700)),
        ]);
      } catch (authErr) {
        // Ignore network error or timeout
      }
    }
  } catch (e) {
    console.warn('[Auth] Sign out error:', e);
  } finally {
    try {
      sessionStorage.clear();
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase') || key.startsWith('fb_') || key.includes('auth'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (storageErr) {
      console.warn('[Auth] Storage clear error:', storageErr);
    }

    // Unconditionally redirect to the main 3-portal homepage grid
    window.location.href = '/';
  }
}

export function getPendingOtpSession() {
  try {
    const raw = sessionStorage.getItem('fb_pending_otp');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function signInStep1(email, password, role) {
  const supabase = getSupabase();
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authErr || !authData?.session) {
    return { success: false, error: authErr?.message || 'Invalid credentials' };
  }

  const token = authData.session.access_token;
  try {
    const res = await fetch(EDGE_FUNCTIONS.sendLoginOtp, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ selected_role: role }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to dispatch security code' };
    }

    sessionStorage.setItem('fb_pending_otp', JSON.stringify({
      email,
      role,
      devOtp: data.dev_otp || null,
    }));

    return { success: true, devOtp: data.dev_otp };
  } catch (err) {
    return { success: false, error: err.message || 'Network error sending verification code' };
  }
}

export async function resendLoginOtp(role) {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { success: false, error: 'Session expired. Please sign in again.' };
  }

  try {
    const res = await fetch(EDGE_FUNCTIONS.sendLoginOtp, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ selected_role: role }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to resend code' };
    }

    const pending = getPendingOtpSession() || {};
    pending.devOtp = data.dev_otp || null;
    sessionStorage.setItem('fb_pending_otp', JSON.stringify(pending));

    return { success: true, devOtp: data.dev_otp };
  } catch (err) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function verifyLoginOtp(otp) {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { success: false, error: 'Session expired. Please sign in again.' };
  }

  try {
    const res = await fetch(EDGE_FUNCTIONS.verifyLoginOtp, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ otp }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Invalid or expired passcode' };
    }

    const pending = getPendingOtpSession();
    sessionStorage.removeItem('fb_pending_otp');

    // Refresh session to get updated claims/profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    return { success: true, role: profile?.role || pending?.role || 'student' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function registerStudent({ email, password, name, studentId, roomNo, hostelBlock, role = 'student' }) {
  try {
    // 1. Call dedicated Edge Function which provisions account with email auto-confirmed
    // to bypass Supabase shared SMTP hourly email rate limits ("email rate limit exceeded")
    if (EDGE_FUNCTIONS.registerStudent) {
      const res = await fetch(EDGE_FUNCTIONS.registerStudent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          role,
          student_id: (studentId || '').trim().toUpperCase(),
          room_no: roomNo,
          hostel_block: hostelBlock,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      return { success: true, user: data.user, role: data.role || role, message: data.message, session: null };
    }
  } catch (edgeErr) {
    console.warn('Edge function registration failed, attempting standard signUp fallback:', edgeErr);
  }

  // Fallback: standard client signUp
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          name,
          student_id: (studentId || '').trim().toUpperCase(),
          room_no: roomNo,
          hostel_block: hostelBlock,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (err) {
    return { success: false, error: err.message || 'Registration failed' };
  }
}

export const registerUser = registerStudent;

export async function updateOperatorProfile({ name, facility }) {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Database client unavailable' };

  try {
    const { data, error } = await supabase.rpc('update_my_profile', {
      p_name: name,
      p_hostel_block: facility || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, profile: data };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to update operator profile' };
  }
}

export async function signInWithGoogle(role = 'student', redirectUrl = null) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Authentication service unavailable');

  // Remember which role initiated the sign-in
  sessionStorage.setItem('fb_auth_role', role);
  if (redirectUrl) {
    sessionStorage.setItem('fb_auth_redirect', redirectUrl);
  } else {
    sessionStorage.removeItem('fb_auth_redirect');
  }

  // Real Google OAuth via Supabase with PKCE
  const callbackUrl = `${window.location.origin}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function completeGoogleLogin(requestedRole = 'student') {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Authentication service unavailable' };

  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !session) {
    return { success: false, error: 'No active Google session found. Please sign in again.' };
  }

  try {
    const res = await fetch(EDGE_FUNCTIONS.completeGoogleLogin, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ requested_role: requestedRole }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'Google login verification failed',
        not_authorized: Boolean(data.not_authorized),
        status: res.status,
      };
    }

    return {
      success: true,
      needs_onboarding: Boolean(data.needs_onboarding),
      role: data.role,
      redirect: data.redirect,
      email: data.email,
      name: data.name,
      verified_until: data.verified_until,
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error verifying Google session' };
  }
}

export async function completeGoogleOnboarding({ student_id, room_no, hostel_block, name }) {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Authentication service unavailable' };

  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !session) {
    return { success: false, error: 'Session expired. Please sign in with Google again.' };
  }

  try {
    const res = await fetch(EDGE_FUNCTIONS.completeGoogleOnboarding, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        student_id: (student_id || '').trim().toUpperCase(),
        room_no: (room_no || '').trim(),
        hostel_block: (hostel_block || '').trim(),
        name: (name || '').trim(),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Student onboarding failed' };
    }

    return {
      success: true,
      message: data.message,
      role: data.role,
      redirect: data.redirect || '/student/',
      verified_until: data.verified_until,
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error during onboarding' };
  }
}

export async function quickDemoLogin(role = 'student') {
  if (!isLocalDev) {
    throw new Error('Demo login shortcuts are strictly restricted to local development environments.');
  }

  const credentials = {
    student: { email: 'student@foodbuddy.test', password: 'Student@Pass2025' },
    mess_manager: { email: 'manager@foodbuddy.test', password: 'Manager@Pass2025' },
    authority: { email: 'authority@foodbuddy.test', password: 'Authority@Pass2025' },
  };
  const creds = credentials[role];
  if (!creds) throw new Error('Unknown role: ' + role);

  const step1 = await signInStep1(creds.email, creds.password, role);
  if (!step1.success) {
    throw new Error(step1.error || 'Sign in failed');
  }

  if (!step1.devOtp) {
    throw new Error('Verification code must be entered from the sent email.');
  }
  const step2 = await verifyLoginOtp(step1.devOtp);
  if (!step2.success) {
    throw new Error(step2.error || 'OTP verification failed');
  }

  const routes = {
    student: '/student/',
    mess_manager: '/manager/',
    authority: '/authority/',
  };
  window.location.href = routes[role] || '/';
}

export async function sendPasswordResetOtp(email) {
  try {
    const res = await fetch(EDGE_FUNCTIONS.sendResetOtp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: (email || '').trim().toLowerCase() }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to send recovery passcode' };
    }

    return { success: true, message: data.message, devOtp: data.dev_otp };
  } catch (err) {
    return { success: false, error: err.message || 'Network error sending recovery code' };
  }
}

export async function resetPasswordWithOtp(email, otp, newPassword) {
  try {
    const res = await fetch(EDGE_FUNCTIONS.resetPasswordWithOtp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: (email || '').trim().toLowerCase(),
        otp: (otp || '').trim(),
        new_password: newPassword,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to reset password' };
    }

    return { success: true, message: data.message };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating password' };
  }
}

if (typeof window !== 'undefined') {
  window.getCurrentUser = getCurrentUser;
  window.requireAuth = requireAuth;
  window.signOut = signOut;
  window.signInStep1 = signInStep1;
  window.verifyLoginOtp = verifyLoginOtp;
  window.resendLoginOtp = resendLoginOtp;
  window.getPendingOtpSession = getPendingOtpSession;
  if (isLocalDev) {
    window.quickDemoLogin = quickDemoLogin;
  }
  window.registerStudent = registerStudent;
  window.registerUser = registerUser;
  window.updateOperatorProfile = updateOperatorProfile;
  window.sendPasswordResetOtp = sendPasswordResetOtp;
  window.resetPasswordWithOtp = resetPasswordWithOtp;
  window.signInWithGoogle = signInWithGoogle;
  window.completeGoogleLogin = completeGoogleLogin;
  window.completeGoogleOnboarding = completeGoogleOnboarding;
}


