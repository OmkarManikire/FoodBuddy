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
    let body: { email?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request payload." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Please provide a valid email address." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Look up user in auth.users by email using admin client
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, name, email")
      .eq("email", email)
      .maybeSingle();

    // If profile not found, return generic success to avoid user enumeration
    if (!profile) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "If your email is registered in our records, a recovery code has been sent.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check cooldown
    const { data: existingOtp } = await adminClient
      .from("login_otps")
      .select("last_sent_at, attempts")
      .eq("user_id", profile.id)
      .eq("purpose", "reset")
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
            error: `Please wait ${remainingCooldown}s before requesting another reset code.`,
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
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString();

    // Clean up previous reset OTPs
    await adminClient
      .from("login_otps")
      .delete()
      .eq("user_id", profile.id)
      .eq("purpose", "reset");

    // Insert new reset OTP
    await adminClient.from("login_otps").insert({
      user_id: profile.id,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempts: 0,
      last_sent_at: new Date(now).toISOString(),
      purpose: "reset",
    });

    console.log(`[DEV_MODE] Password Reset OTP for ${profile.email}: ${otp}`);

    // Send email via SMTP if configured
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: `"Food Buddy Security" <${smtpUser}>`,
          to: profile.email,
          subject: `${otp} is your Food Buddy Password Recovery Code`,
          html: `
            <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #0f172a; font-size: 20px; margin-top: 0;">Password Recovery Request</h2>
              <p style="color: #475569; font-size: 14px;">We received a request to reset your Food Buddy password. Use the code below:</p>
              <div style="background-color: #fffbeb; border: 2px dashed #d97706; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #d97706; font-family: monospace;">${otp}</span>
              </div>
              <p style="font-size: 12px; color: #64748b;">This code expires in 5 minutes. If you did not request this, please disregard this email.</p>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send reset email:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "If your email is registered in our records, a recovery code has been sent.",
        dev_otp: otp, // For local testing demo banner
        expires_at: expiresAt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("send-reset-otp error:", err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
