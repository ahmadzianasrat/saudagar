// ============================================================
// admin-create-admin
// ------------------------------------------------------------
// Super-admin-only. Creates a new admin user (real email/password,
// same pattern as AdminLoginScreen — admins are a small trusted
// population, unlike shop owners' synthetic-email scheme) and their
// admin_users row with the permissions the super admin assigns.
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const { data: caller } = await supabase
      .from("admin_users")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    // Only a super_admin can create other admins — no bypass logic
    // needed here since this IS the super_admin-only action.
    if (!caller || !caller.is_active || caller.role !== "super_admin") {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const { email, password, name, phone_number, role, can_approve_accounts, allowed_markets } = await req.json();
    if (!email || !password || !name) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr || !newUser?.user) {
      console.error("admin auth user creation failed:", createErr);
      return jsonResponse({ error: "user_creation_failed", detail: createErr?.message }, 500);
    }

    const { error: insertErr } = await supabase.from("admin_users").insert({
      id: newUser.user.id,
      name,
      phone_number: phone_number ?? "",
      role: role === "super_admin" ? "super_admin" : "staff",
      can_approve_accounts: !!can_approve_accounts,
      allowed_markets: Array.isArray(allowed_markets) ? allowed_markets : [],
    });

    if (insertErr) {
      console.error("admin_users insert failed:", insertErr);
      return jsonResponse({ error: "admin_row_creation_failed" }, 500);
    }

    return jsonResponse({ status: "created", admin_id: newUser.user.id });
  } catch (err) {
    console.error("admin-create-admin error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
