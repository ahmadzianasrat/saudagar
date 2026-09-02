// ============================================================
// create-payment-session
// ------------------------------------------------------------
// Called by the app when a user taps "Subscribe" on either the
// monthly (250 AFN) or six-month (1,250 AFN) tier.
//
// Flow:
//   1. Validate the request and look up the user's profile.
//   2. Create a `payment_sessions` row (status = pending).
//   3. Call HesabPay's create-session API.
//   4. Store HesabPay's session id + redirect URL on our row.
//   5. Return the redirect URL to the app, which opens it
//      (in-app browser or external) for the user to pay.
//
// TODO markers below need HesabPay's actual API reference —
// field names are best-guess placeholders based on their
// WooCommerce plugin's public description, not a confirmed spec.
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HESABPAY_API_KEY = Deno.env.get("HESABPAY_API_KEY")!;
const HESABPAY_CREATE_SESSION_URL = "https://api.hesab.com/api/v1/payment/create-session";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Pricing is defined server-side, never trusted from the client,
// so a tampered request can't buy a subscription at the wrong price.
const TIER_PRICING: Record<string, { amount: number; days: number; label: string }> = {
  monthly: { amount: 250, days: 30, label: "Saudagar — Monthly subscription" },
  six_month: { amount: 1250, days: 182, label: "Saudagar — 6-month subscription" },
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Identify the calling user from their JWT (passed through from the app).
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }
    const profileId = userData.user.id;

    const body = await req.json();
    const tier = body?.tier as string;
    if (!tier || !(tier in TIER_PRICING)) {
      return new Response(JSON.stringify({ error: "invalid_tier" }), { status: 400 });
    }
    const { amount, label } = TIER_PRICING[tier];

    // 1. Create the pending session row first, so we have an internal
    //    reference id to hand to HesabPay and match on the webhook.
    const { data: session, error: sessionErr } = await supabase
      .from("payment_sessions")
      .insert({
        profile_id: profileId,
        tier,
        amount,
        currency: "AFN",
        status: "pending",
      })
      .select()
      .single();

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: "session_create_failed" }), { status: 500 });
    }

    // 2. Call HesabPay to create the actual payment session.
    // Confirmed against HesabPay's published Get Started docs:
    //   - Auth header: "Authorization: API-KEY <key>" (not Bearer)
    //   - Body: { email?, items: [{id, name, price}], redirect_success_url?, redirect_failure_url? }
    //   - No webhook_url field here — webhooks are registered separately
    //     via the HesabPay developer dashboard, not per-transaction.
    // We set items[0].id = our internal session.id so that, IF HesabPay
    // echoes item ids back in the webhook payload, we have a ready-made
    // reference to match against. Still needs confirming once we see a
    // real webhook payload (see hesabpay-webhook/index.ts for the fallback).
    const hesabResponse = await fetch(HESABPAY_CREATE_SESSION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `API-KEY ${HESABPAY_API_KEY}`,
      },
      body: JSON.stringify({
        items: [
          { id: session.id, name: label, price: amount },
        ],
        redirect_success_url: `saudagar://payment/success?session=${session.id}`,
        redirect_failure_url: `saudagar://payment/cancelled?session=${session.id}`,
      }),
    });

    const hesabData = await hesabResponse.json();

    if (!hesabResponse.ok || hesabData?.success === false) {
      await supabase
        .from("payment_sessions")
        .update({ status: "failed", raw_create_response: hesabData })
        .eq("id", session.id);

      return new Response(JSON.stringify({ error: "hesabpay_create_failed", detail: hesabData }), {
        status: 502,
      });
    }

    // Confirmed response shape: { success, payment_url, message }.
    // HesabPay's docs don't show a distinct "session_id" field in the
    // create-session response — payment_url itself may embed one. If so,
    // parse it out here once you've seen a real response; for now we rely
    // on our own session.id (sent as items[0].id) as the primary reference.
    const sessionUrl = hesabData?.payment_url;
    const hesabSessionId = hesabData?.session_id ?? null;

    await supabase
      .from("payment_sessions")
      .update({
        hesabpay_session_id: hesabSessionId,
        session_url: sessionUrl,
        raw_create_response: hesabData,
      })
      .eq("id", session.id);

    return new Response(
      JSON.stringify({ session_id: session.id, payment_url: sessionUrl }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-payment-session error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500 });
  }
});
