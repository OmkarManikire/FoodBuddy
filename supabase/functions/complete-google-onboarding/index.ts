import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Rate limiter: Max 5 onboarding submissions per 5 minutes per user
const onboardingRateLimits = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = onboardingRateLimits.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    onboardingRateLimits.set(key, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= MAX_ATTEMPTS) {
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

    // 2. Rate limiting check
    if (isRateLimited(`onboarding_${user.id}`)) {
      return new Response(
        JSON.stringify({ error: "Too many enrollment attempts. Please wait 5 minutes before trying again." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Check Provider: Must be Google
    const isGoogleProvider =
      user.app_metadata?.provider === "google" ||
      (Array.isArray(user.identities) &&
        user.identities.some((id: { provider: string }) => id.provider === "google")) ||
      (typeof user.user_metadata?.iss === "string" &&
        user.user_metadata.iss.includes("accounts.google.com"));

    if (!isGoogleProvider) {
      return new Response(
        JSON.stringify({ error: "Authentication provider mismatch: Only Google accounts can complete this onboarding flow." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Check Verified Email
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

    // 5. Parse and validate body
    let body: {
      student_id?: string;
      room_no?: string;
      hostel_block?: string;
      name?: string;
    } = {};

    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request payload." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentId = (body.student_id || "").trim().toUpperCase();
    const roomNo = (body.room_no || "").trim();
    const hostelBlock = (body.hostel_block || "").trim();
    const studentName =
      (body.name || "").trim() ||
      user.user_metadata?.full_name ||
      splitEmail(user.email || "");

    function splitEmail(em: string) {
      return em.split("@")[0];
    }

    if (!studentId) {
      return new Response(
        JSON.stringify({ error: "Enrollment Error: College Student ID is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!roomNo || !hostelBlock) {
      return new Response(
        JSON.stringify({ error: "Please enter your hostel block and room number." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 6. Check if user already has an onboarded profile
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile && existingProfile.student_id && existingProfile.role === "student") {
      // Already onboarded, refresh session
      const verifiedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      await adminClient
        .from("profiles")
        .update({ otp_verified_until: verifiedUntil, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Profile already enrolled.",
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

    // 7. Verify Student ID against valid_student_ids
    const { data: idRecord, error: idErr } = await adminClient
      .from("valid_student_ids")
      .select("student_id, used")
      .eq("student_id", studentId)
      .maybeSingle();

    if (idErr || !idRecord) {
      return new Response(
        JSON.stringify({
          error: `Enrollment Error: Student ID ${studentId} is not found in the campus registrar roster.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (idRecord.used === true) {
      return new Response(
        JSON.stringify({
          error: `Enrollment Error: Student ID ${studentId} has already been registered for mess dining.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 8. Mark valid_student_ids as used
    const { error: markErr } = await adminClient
      .from("valid_student_ids")
      .update({ used: true })
      .eq("student_id", studentId);

    if (markErr) {
      console.error("Error marking valid_student_ids used:", markErr);
      return new Response(
        JSON.stringify({ error: "Failed to reserve Student ID. Please try again." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 9. Upsert Profile with role = 'student' and otp_verified_until = now() + 12h
    const verifiedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const { error: profileUpsertErr } = await adminClient
      .from("profiles")
      .upsert({
        id: user.id,
        name: studentName,
        email: (user.email || "").toLowerCase(),
        role: "student",
        student_id: studentId,
        room_no: roomNo,
        hostel_block: hostelBlock,
        otp_verified_until: verifiedUntil,
        updated_at: new Date().toISOString(),
      });

    if (profileUpsertErr) {
      console.error("Error creating student profile:", profileUpsertErr);
      // Revert valid_student_ids used status
      await adminClient
        .from("valid_student_ids")
        .update({ used: false })
        .eq("student_id", studentId);

      return new Response(
        JSON.stringify({ error: "Failed to complete enrollment profile. Please try again." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Enrollment complete! Welcome to Food Buddy.",
        role: "student",
        redirect: "/student/",
        verified_until: verifiedUntil,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("complete-google-onboarding error:", err);
    return new Response(JSON.stringify({ error: "Internal server error during student onboarding." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
