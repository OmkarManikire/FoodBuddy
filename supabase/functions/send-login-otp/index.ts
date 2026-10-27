import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

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

    // Client with user JWT to get user identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user session. Please sign in again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client to query tables bypassing RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let body: { selected_role?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is allowed
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, name, email, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found for this account." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate selected role against account role
    if (body.selected_role && body.selected_role !== profile.role) {
      return new Response(
        JSON.stringify({
          error: `Selected role (${body.selected_role}) does not match your registered account role (${profile.role}).`,
          role_mismatch: true,
          actual_role: profile.role,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check rate limit: 30-second cooldown
    const { data: existingOtp } = await adminClient
      .from("login_otps")
      .select("last_sent_at, attempts")
      .eq("user_id", user.id)
      .eq("purpose", "login")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = Date.now();
    if (existingOtp?.last_sent_at) {
      const lastSentTime = new Date(existingOtp.last_sent_at).getTime();
      const elapsedSeconds = Math.floor((now - lastSentTime) / 1000);
      if (elapsedSeconds < 30) {
        const remainingCooldown = 30 - elapsedSeconds;
        return new Response(
          JSON.stringify({
            error: `Please wait ${remainingCooldown}s before requesting a new code.`,
            cooldown_remaining: remainingCooldown,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Generate random 6-digit OTP
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const otp = String(100000 + (array[0] % 900000));
    const otpHash = await hashOtp(otp);

    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString(); // 5 minutes

    // Reset otp_verified_until to null on profiles
    await adminClient
      .from("profiles")
      .update({ otp_verified_until: null, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    // Clean up previous login OTPs for this user
    await adminClient
      .from("login_otps")
      .delete()
      .eq("user_id", user.id)
      .eq("purpose", "login");

    // Insert new OTP record
    const { error: insertError } = await adminClient.from("login_otps").insert({
      user_id: user.id,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempts: 0,
      last_sent_at: new Date(now).toISOString(),
      purpose: "login",
    });

    if (insertError) {
      console.error("Error inserting OTP:", insertError);
      return new Response(JSON.stringify({ error: "Failed to generate security code." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Development log of OTP for local testing
    console.log(`[DEV_MODE] Login OTP for ${profile.email} (${profile.role}): ${otp}`);

    // Send email via Gmail SMTP
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    let emailSent = false;

    if (smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: `"Food Buddy Campus Dining" <${smtpUser}>`,
          to: profile.email,
          subject: `${otp} is your Food Buddy Verification Code`,
          html: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
              <div style="margin-bottom: 24px; display: flex; align-items: center; gap: 12px;">
                <div style="background-color: #059669; color: #ffffff; font-weight: bold; width: 36px; height: 36px; border-radius: 8px; text-align: center; line-height: 36px; font-size: 20px;">FB</div>
                <div>
                  <h2 style="margin: 0; font-size: 18px; color: #0f172a; font-weight: 700;">Food Buddy</h2>
                  <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Campus Hostel Mess Management</p>
                </div>
              </div>
              <p style="font-size: 15px; color: #334155; line-height: 1.5; margin-bottom: 20px;">
                Hello <strong>${profile.name}</strong>,<br>
                Use the following 6-digit verification code to complete your sign-in to the <strong>Food Buddy ${profile.role.replace('_', ' ').toUpperCase()}</strong> portal.
              </p>
              <div style="background-color: #f8fafc; border: 2px dashed #059669; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #059669; font-family: monospace;">${otp}</span>
              </div>
              <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 24px;">
                ⏱ This code is valid for <strong>5 minutes</strong>. For your security, do not share this passcode with anyone. A maximum of 3 attempts are allowed.
              </p>
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;">
              <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
                Food Buddy • Better Food • Better Hygiene • Better Experience<br>
                Institutional Campus Dining OS
              </p>
            </div>
          `,
        });
        emailSent = true;
      } catch (mailError) {
        console.error("Gmail SMTP Delivery Error:", mailError);
      }
    } else {
      console.log("SMTP_USER and/or SMTP_PASS not set. Skipping SMTP delivery (OTP logged in dev logs).");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent
          ? "Verification code sent to your campus email."
          : "Verification code generated and logged (SMTP pending configuration).",
        dev_otp: otp, // For local testing demo banner
        expires_at: expiresAt,
        role: profile.role,
        email: profile.email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("send-login-otp error:", err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
