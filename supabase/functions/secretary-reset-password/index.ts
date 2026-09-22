// ============================================================
// secretary-reset-password
// ------------------------------------------------------------
// Owner-initiated password reset for one of their own secretaries —
// mirrors admin-reset-password's pattern (generate + return a temp
// password, relay it manually) but scoped to "your own secretary"
// instead of "any shop", and callable by an owner rather than an
// admin.
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

    const { secretary_id } = await req.json();
    if (!secretary_id) {
      return jsonResponse({ error: "missing_secretary_id" }, 400);
    }

    // Ownership check: this secretary must belong to the caller —
    // without this, any authenticated user could reset any
    // secretary's password by guessing an id.
    const { data: secretary, error: secErr } = await supabase
      .from("shop_secretaries")
      .select("id, secretary_user_id, name, phone_number, owner_profile_id")
      .eq("id", secretary_id)
      .eq("owner_profile_id", userData.user.id)
      .single();

    if (secErr || !secretary) {
      return jsonResponse({ error: "secretary_not_found" }, 404);
    }

    const newPassword = generatePassword();
    const { error: updateErr } = await supabase.auth.admin.updateUserById(secretary.secretary_user_id, {
      password: newPassword,
    });

    if (updateErr) {
      console.error("secretary password reset failed:", updateErr);
      return jsonResponse({ error: "reset_failed", detail: updateErr.message }, 500);
    }

    return jsonResponse({
      status: "reset",
      name: secretary.name,
      phone_number: secretary.phone_number,
      new_password: newPassword,
    });
  } catch (err) {
    console.error("secretary-reset-password error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
