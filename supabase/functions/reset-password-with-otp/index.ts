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
    let body: { email?: string; otp?: string; new_password?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request payload." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const inputOtp = String(body.otp || "").trim();
    const newPassword = String(body.new_password || "");

    if (!email || !inputOtp || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Email, verification code, and new password are required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!/^\d{6}$/.test(inputOtp)) {
      return new Response(JSON.stringify({ error: "Invalid 6-digit verification code format." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters long." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Look up profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, name, email")
      .eq("email", email)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Invalid password reset request." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Look up reset OTP
    const { data: otpRecord } = await adminClient
      .from("login_otps")
      .select("id, otp_hash, expires_at, attempts")
      .eq("user_id", profile.id)
      .eq("purpose", "reset")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: "No active recovery code found. Please request a new code." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (otpRecord.attempts >= 3) {
      return new Response(
        JSON.stringify({ error: "Maximum verification attempts exceeded. Please request a new code." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (new Date() > new Date(otpRecord.expires_at)) {
      return new Response(
        JSON.stringify({ error: "Recovery code has expired. Please request a new code." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify hash
    const inputHash = await hashOtp(inputOtp);
    if (inputHash !== otpRecord.otp_hash) {
      const newAttempts = otpRecord.attempts + 1;
      await adminClient
        .from("login_otps")
        .update({ attempts: newAttempts })
        .eq("id", otpRecord.id);

      const remainingAttempts = Math.max(0, 3 - newAttempts);
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

    // Update password via Auth Admin API
    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (updateAuthError) {
      console.error("Failed to update user password:", updateAuthError);
      return new Response(
        JSON.stringify({ error: updateAuthError.message || "Failed to update password." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Delete used OTP and clear otp_verified_until
    await adminClient.from("login_otps").delete().eq("id", otpRecord.id);
    await adminClient
      .from("profiles")
      .update({ otp_verified_until: null, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Your password has been successfully reset. Please sign in with your new credentials.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("reset-password-with-otp error:", err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
