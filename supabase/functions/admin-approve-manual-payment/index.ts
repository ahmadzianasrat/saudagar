// ============================================================
// admin-approve-manual-payment
// ------------------------------------------------------------
// Approves a cash/mobile-top-up payment claim submitted by a shop
// owner. Creates a real subscriptions row on approval — mirrors the
// trial-subscription creation in admin-approve-account, just for a
// paid tier with a real amount instead of the automatic 30-day trial.
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TIER_DAYS: Record<string, number> = { monthly: 30, six_month: 182 };

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

    const { data: admin } = await supabase
      .from("admin_users")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (!admin || !admin.can_approve_accounts) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const { request_id } = await req.json();
    if (!request_id) {
      return jsonResponse({ error: "missing_request_id" }, 400);
    }

    const { data: request, error: reqErr } = await supabase
      .from("manual_payment_requests")
      .select("*")
      .eq("id", request_id)
      .eq("status", "pending")
      .single();

    if (reqErr || !request) {
      return jsonResponse({ error: "request_not_found_or_not_pending" }, 404);
    }

    const days = TIER_DAYS[request.tier];
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { error: subErr } = await supabase.from("subscriptions").insert({
      profile_id: request.profile_id,
      tier: request.tier,
      amount: request.amount,
      expires_at: expiresAt,
      payment_reference: `manual:${request.id}`,
      status: "active",
    });

    if (subErr) {
      console.error("failed to create subscription from manual payment:", subErr);
      return jsonResponse({ error: "subscription_create_failed" }, 500);
    }

    await supabase
      .from("manual_payment_requests")
      .update({ status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
      .eq("id", request_id);

    return jsonResponse({ status: "approved", expires_at: expiresAt });
  } catch (err) {
    console.error("admin-approve-manual-payment error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
