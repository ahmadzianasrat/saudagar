// ============================================================
// admin-reset-password
// ------------------------------------------------------------
// Since login uses a synthetic email (no real inbox to send a
// reset link to), "forgot password" is handled the same way
// account creation is: the shop owner contacts the admin, who
// generates a new password here and relays it manually (WhatsApp/
// call) — same pattern as admin-approve-account's temp password.
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

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
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

    const { data: admin } = await supabase
      .from("admin_users")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (!admin || !admin.can_approve_accounts) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const { profile_id } = await req.json();
    if (!profile_id) {
      return jsonResponse({ error: "missing_profile_id" }, 400);
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("phone_number, shop_name")
      .eq("id", profile_id)
      .single();

    if (profileErr || !profile) {
      return jsonResponse({ error: "profile_not_found" }, 404);
    }

    const newPassword = generatePassword();
    const { error: updateErr } = await supabase.auth.admin.updateUserById(profile_id, {
      password: newPassword,
    });

    if (updateErr) {
      console.error("password reset failed:", updateErr);
      return jsonResponse({ error: "reset_failed", detail: updateErr.message }, 500);
    }

    return jsonResponse({
      status: "reset",
      phone_number: profile.phone_number,
      shop_name: profile.shop_name,
      new_password: newPassword,
    });
  } catch (err) {
    console.error("admin-reset-password error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
