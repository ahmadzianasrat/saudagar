// ============================================================
// admin-update-admin
// ------------------------------------------------------------
// Super-admin-only. Updates another admin's permissions
// (can_approve_accounts, allowed_markets) or active status.
// Client-side direct updates to admin_users are intentionally never
// allowed (no update RLS policy exists on that table) — all changes
// go through this function so they're deliberate and auditable.
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

    if (!caller || !caller.is_active || caller.role !== "super_admin") {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const { admin_id, can_approve_accounts, allowed_markets, is_active } = await req.json();
    if (!admin_id) {
      return jsonResponse({ error: "missing_admin_id" }, 400);
    }

    const updates: Record<string, unknown> = {};
    if (typeof can_approve_accounts === "boolean") updates.can_approve_accounts = can_approve_accounts;
    if (Array.isArray(allowed_markets)) updates.allowed_markets = allowed_markets;
    if (typeof is_active === "boolean") updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return jsonResponse({ error: "no_updates_provided" }, 400);
    }

    const { error: updateErr } = await supabase.from("admin_users").update(updates).eq("id", admin_id);

    if (updateErr) {
      console.error("admin_users update failed:", updateErr);
      return jsonResponse({ error: "update_failed" }, 500);
    }

    return jsonResponse({ status: "updated" });
  } catch (err) {
    console.error("admin-update-admin error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
