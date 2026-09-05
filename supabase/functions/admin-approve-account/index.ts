// ============================================================
// admin-approve-account
// ------------------------------------------------------------
// Called from the admin panel when an admin approves a pending
// account_requests row. Only callable by an authenticated admin
// with can_approve_accounts = true (checked below).
//
// Auth model: "phone-number + admin-created login" — no self-serve
// OTP/SMS at all. Supabase auth requires an email or phone identity;
// since we're deliberately avoiding SMS-based phone auth (cost +
// deliverability concerns into Afghanistan), we create the user with
// a SYNTHETIC email derived from their phone number
// (e.g. "0793111222@saudagar.local") plus a randomly generated
// password. The real phone number lives on profiles.phone_number
// for actual use (WhatsApp, display, etc).
//
// The generated password is returned in this function's response
// ONLY — never stored in plaintext anywhere — so the admin can relay
// it to the shop owner manually (call or WhatsApp), consistent with
// how verification already happens in this flow.
//
// Also creates the 30-day free trial subscription immediately on
// approval, so a newly approved shop can start using the ledger/
// inventory right away without a separate "start trial" step.
//
// CORS: this is called directly from the browser (admin-panel's
// Vercel-hosted origin), so every response — not just the OPTIONS
// preflight — needs Access-Control-Allow-Origin, or the browser
// rejects the response before the app's code ever sees it. Without
// this, fetch() throws, and any caller not wrapping that in a
// try/catch/finally can end up stuck in a permanent "loading" state.
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TRIAL_DAYS = 30;

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

function phoneToSyntheticEmail(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  return `${digitsOnly}@saudagar.local`;
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

    const { data: admin, error: adminErr } = await supabase
      .from("admin_users")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (adminErr || !admin || !admin.can_approve_accounts) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const { request_id } = await req.json();
    if (!request_id) {
      return jsonResponse({ error: "missing_request_id" }, 400);
    }

    const { data: request, error: reqErr } = await supabase
      .from("account_requests")
      .select("*")
      .eq("id", request_id)
      .eq("status", "pending")
      .single();

    if (reqErr || !request) {
      return jsonResponse({ error: "request_not_found_or_not_pending" }, 404);
    }

    const tempPassword = generatePassword();
    const syntheticEmail = phoneToSyntheticEmail(request.phone_number);

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      password: tempPassword,
      phone: request.phone_number,
      email_confirm: true,
    });

    if (createErr || !newUser?.user) {
      console.error("auth user creation failed", createErr);
      return jsonResponse({ error: "user_creation_failed", detail: createErr?.message }, 500);
    }

    const { error: profileErr } = await supabase.from("profiles").insert({
      id: newUser.user.id,
      phone_number: request.phone_number,
      owner_name: request.owner_name,
      shop_name: request.shop_name,
      market_id: request.market_id,
      status: "active",
    });

    if (profileErr) {
      console.error("profile creation failed", profileErr);
      return jsonResponse({ error: "profile_creation_failed" }, 500);
    }

    const trialExpiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error: trialErr } = await supabase.from("subscriptions").insert({
      profile_id: newUser.user.id,
      tier: "trial",
      amount: 0,
      expires_at: trialExpiresAt,
      status: "active",
    });

    if (trialErr) {
      console.error("trial subscription creation failed", trialErr);
      // Not fatal to the approval itself — profile exists, trial can be
      // created manually if this step fails. Log and continue.
    }

    await supabase
      .from("account_requests")
      .update({ status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
      .eq("id", request_id);

    return jsonResponse({
      status: "approved",
      login_phone: request.phone_number,
      temp_password: tempPassword,
      trial_expires_at: trialExpiresAt,
    });
  } catch (err) {
    console.error("admin-approve-account error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
