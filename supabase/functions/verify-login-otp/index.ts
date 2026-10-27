import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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

    // Identify user from JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session. Please sign in again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { otp?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request payload." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inputOtp = String(body.otp || "").trim();
    if (!/^\d{6}$/.test(inputOtp)) {
      return new Response(JSON.stringify({ error: "Please enter a valid 6-digit verification code." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client to manage security records
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the active OTP record for login
    const { data: otpRecord, error: otpError } = await adminClient
      .from("login_otps")
      .select("id, otp_hash, expires_at, attempts")
      .eq("user_id", user.id)
      .eq("purpose", "login")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      return new Response(
        JSON.stringify({ error: "No active verification code found. Please request a new code." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if max attempts already reached
    if (otpRecord.attempts >= 3) {
      return new Response(
        JSON.stringify({ error: "Maximum verification attempts exceeded. Please request a new code." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: "Verification code has expired. Please request a new code." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Compare hash
    const inputHash = await hashOtp(inputOtp);
    if (inputHash !== otpRecord.otp_hash) {
      const newAttempts = otpRecord.attempts + 1;
      await adminClient
        .from("login_otps")
        .update({ attempts: newAttempts })
        .eq("id", otpRecord.id);

      const remainingAttempts = Math.max(0, 3 - newAttempts);
      if (remainingAttempts === 0) {
        return new Response(
          JSON.stringify({
            error: "Incorrect code. Maximum attempts reached. Please request a new code.",
            remaining_attempts: 0,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`,
          remaining_attempts: remainingAttempts,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // OTP verified successfully!
    // Set otp_verified_until = now() + 12 hours
    const verifiedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    const { data: updatedProfile, error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({
        otp_verified_until: verifiedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id, name, email, role, student_id, room_no, hostel_block")
      .single();

    if (profileUpdateError) {
      console.error("Error setting otp_verified_until:", profileUpdateError);
      return new Response(JSON.stringify({ error: "Failed to establish verified session." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete used OTP
    await adminClient.from("login_otps").delete().eq("id", otpRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "OTP verified successfully. Access granted.",
        verified_until: verifiedUntil,
        profile: updatedProfile,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("verify-login-otp error:", err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
