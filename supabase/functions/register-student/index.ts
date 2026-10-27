import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function computeGatewayToken(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase() + "FOOD_BUDDY_STAFF_GATEWAY_2025");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let body: {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
      student_id?: string;
      room_no?: string;
      hostel_block?: string;
    } = {};

    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request payload." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const rawRole = String(body.role || "student").trim().toLowerCase();
    const role = (rawRole === "mess_manager" || rawRole === "manager") ? "mess_manager"
               : (rawRole === "authority" || rawRole === "higher_authority") ? "authority"
               : "student";

    const studentId = role === "student" ? String(body.student_id || "").trim().toUpperCase() : null;
    const roomNo = body.room_no ? String(body.room_no).trim() : null;
    const hostelBlock = body.hostel_block ? String(body.hostel_block).trim() : "";

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "Full Name, Official Email, and Password are required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (role === "student" && !studentId) {
      return new Response(
        JSON.stringify({ error: "Roll Number / Student ID is required for student registration." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address with a domain (e.g., name@gmail.com or operator@campus.edu)." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters long." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Check if another user is already using this student_id (if student)
    if (studentId) {
      const { data: conflictingProfile } = await adminClient
        .from("profiles")
        .select("id, email, student_id")
        .eq("student_id", studentId)
        .maybeSingle();

      if (conflictingProfile && conflictingProfile.email.toLowerCase() !== email) {
        return new Response(
          JSON.stringify({
            error: `Student ID ${studentId} is already registered to another student account (${conflictingProfile.email}).`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // 2. Check if user already exists in auth.users
    const { data: usersData } = await adminClient.auth.admin.listUsers();
    const existingUser = usersData?.users?.find(
      (u: any) => u.email?.toLowerCase() === email
    );

    const gatewayToken = await computeGatewayToken(email);
    let returnUser = null;

    if (existingUser) {
      // User exists: update password, verify email, and update role & profile
      const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(
        existingUser.id,
        {
          password,
          email_confirm: true,
          app_metadata: {
            role,
          },
          user_metadata: {
            role,
            name,
            student_id: studentId,
            room_no: roomNo,
            hostel_block: hostelBlock,
            gateway_token: gatewayToken,
          },
        }
      );

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      returnUser = updated?.user || existingUser;

      // Update public.profiles
      await adminClient.from("profiles").upsert({
        id: existingUser.id,
        email,
        name,
        role,
        student_id: studentId,
        room_no: roomNo,
        hostel_block: hostelBlock,
      });

      if (studentId) {
        await adminClient.from("valid_student_ids").upsert({
          student_id: studentId,
          used: true,
          used_at: new Date().toISOString(),
        });
      }
    } else {
      // Brand new user: provision user with app_metadata.role and email_confirm: true
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          role,
        },
        user_metadata: {
          role,
          name,
          student_id: studentId,
          room_no: roomNo,
          hostel_block: hostelBlock,
          gateway_token: gatewayToken,
        },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      returnUser = created?.user;
    }

    const roleName = role === "mess_manager" ? "Mess Manager" : role === "authority" ? "Higher Authority" : "Student";

    return new Response(
      JSON.stringify({
        success: true,
        user: returnUser,
        role,
        message: `${roleName} account registered successfully. You can now sign in.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "An unexpected error occurred during registration." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
