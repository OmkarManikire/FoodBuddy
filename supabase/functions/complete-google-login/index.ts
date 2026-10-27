import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// In-memory sliding window rate limiter
const rateLimits = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(key, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  entry.count++;
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Verify caller session JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session. Please sign in again." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Rate Limiting by user ID
    if (isRateLimited(`google_login_${user.id}`)) {
      return new Response(
        JSON.stringify({ error: "Too many login attempts. Please wait a minute before retrying." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Check Provider: Must be Google
    const isGoogleProvider =
      user.app_metadata?.provider === "google" ||
      (Array.isArray(user.identities) &&
        user.identities.some((id: { provider: string }) => id.provider === "google")) ||
      (typeof user.user_metadata?.iss === "string" &&
        user.user_metadata.iss.includes("accounts.google.com"));

    if (!isGoogleProvider) {
      return new Response(
        JSON.stringify({ error: "Authentication provider mismatch: Only Google sign-in is accepted for this method." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Check Verified Email
    const isEmailVerified = Boolean(
      user.user_metadata?.email_verified === true ||
      user.user_metadata?.email_verified === "true" ||
      user.email_confirmed_at
    );

    if (!isEmailVerified) {
      return new Response(
        JSON.stringify({ error: "Unverified Google Account. Email address must be verified by Google." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let body: { requested_role?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty
    }

    let requestedRole = (body.requested_role || "student").trim().toLowerCase();
    if (requestedRole === "manager") requestedRole = "mess_manager";

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Look up profile (by user.id first, or case-insensitive email)
    const userEmail = (user.email || "").trim().toLowerCase();
    let { data: profile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile && userEmail) {
      const { data: emailProfile } = await adminClient
        .from("profiles")
        .select("*")
        .ilike("email", userEmail)
        .maybeSingle();

      if (emailProfile) {
        // Link existing profile to this new auth user ID
        await adminClient.rpc("link_profile_to_user", {
          p_old_id: emailProfile.id,
          p_new_id: user.id,
        });
        profile = { ...emailProfile, id: user.id };
      }
    }

    // 5. Role Enforcement
    if (requestedRole === "mess_manager" || requestedRole === "authority") {
      // Rule 2.b: Mess Manager and Authority login is allowed ONLY if a profile
      // with that exact verified email already exists with the matching role.
      if (!profile || profile.role !== requestedRole) {
        return new Response(
          JSON.stringify({
            error: "This Google account is not authorised for this portal",
            not_authorized: true,
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Valid manager / authority: Activate 12-hour session
      const verifiedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      await adminClient
        .from("profiles")
        .update({
          otp_verified_until: verifiedUntil,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      const redirectPath = requestedRole === "mess_manager" ? "/manager/" : "/authority/";
      return new Response(
        JSON.stringify({
          success: true,
          role: profile.role,
          redirect: redirectPath,
          verified_until: verifiedUntil,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Requested role is Student
    if (profile) {
      // If profile exists with a different role, deny
      if (profile.role !== "student") {
        return new Response(
          JSON.stringify({
            error: "This Google account is not authorised for this portal",
            not_authorized: true,
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // If student profile exists but missing student_id, onboarding is needed
      if (!profile.student_id) {
        return new Response(
          JSON.stringify({
            success: true,
            needs_onboarding: true,
            redirect: "/onboarding",
            email: userEmail,
            name: profile.name || user.user_metadata?.full_name || "",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Student has completed profile: Activate 12-hour session
      const verifiedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      await adminClient
        .from("profiles")
        .update({
          otp_verified_until: verifiedUntil,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      return new Response(
        JSON.stringify({
          success: true,
          role: "student",
          redirect: "/student/",
          verified_until: verifiedUntil,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Brand new Google student: no profile exists yet -> Send to onboarding
    return new Response(
      JSON.stringify({
        success: true,
        needs_onboarding: true,
        redirect: "/onboarding",
        email: userEmail,
        name: user.user_metadata?.full_name || "",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("complete-google-login error:", err);
    return new Response(JSON.stringify({ error: "Internal server error during verification." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
