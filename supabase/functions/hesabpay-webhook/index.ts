// ============================================================
// hesabpay-webhook
// ------------------------------------------------------------
// Confirmed against HesabPay's actual Webhooks documentation
// (Payload Structure + Verify Signature + Handle Events pages).
//
// Real payload shape:
// {
//   status_code, success (bool), message, sender_account,
//   transaction_id, amount, memo, signature, timestamp,
//   transaction_date, items: [{id, name, price}], email
// }
//
// Both "Payment Success" and "Payment Failure" events are sent to
// the SAME registered URL — differentiated by the `success` boolean
// and `status_code`, not by a separate endpoint/path.
//
// Verification: POST { signature, timestamp } (taken directly from
// the incoming payload) to HesabPay's verify-signature endpoint,
// with `Authorization: API-KEY <key>`. Response is { success: bool }.
// Only trust the payload if that comes back true.
//
// Matching back to our own payment_sessions row: we set
// items[0].id = session.id at creation time (see
// create-payment-session/index.ts), and HesabPay echoes items back
// unchanged — so items[0].id is a fully reliable client reference,
// no fallback/guessing needed.
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HESABPAY_API_KEY = Deno.env.get("HESABPAY_API_KEY")!;
const HESABPAY_VERIFY_URL = "https://api.hesab.com/api/v1/hesab/webhooks/verify-signature";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TIER_DAYS: Record<string, number> = { monthly: 30, six_month: 182 };

interface HesabPayWebhookPayload {
  status_code: number;
  success: boolean;
  message: string;
  sender_account: string;
  transaction_id: string;
  amount: number;
  memo?: string;
  signature: string;
  timestamp: string;
  transaction_date: string;
  items: { id: string; name: string; price: number }[];
  email?: string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload = (await req.json()) as HesabPayWebhookPayload;

    if (!payload?.signature || !payload?.timestamp) {
      return new Response(JSON.stringify({ error: "missing_signature_or_timestamp" }), {
        status: 400,
      });
    }

    // 1. Verify with HesabPay before trusting anything else in the
    // payload — never skip this, it's what stops a forged POST to
    // this URL from being treated as a real payment.
    const verifyResponse = await fetch(HESABPAY_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `API-KEY ${HESABPAY_API_KEY}`,
      },
      body: JSON.stringify({
        signature: payload.signature,
        timestamp: payload.timestamp,
      }),
    });

    const verifyResult = await verifyResponse.json();
    const isValid = verifyResponse.ok && verifyResult?.success === true;

    if (!isValid) {
      console.error("HesabPay signature verification failed", verifyResult);
      return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 401 });
    }

    // 2. Match back to our payment_sessions row via items[0].id.
    const sessionId = payload.items?.[0]?.id;
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "missing_session_reference" }), { status: 400 });
    }

    const { data: session, error: findErr } = await supabase
      .from("payment_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (findErr || !session) {
      console.error("payment_sessions row not found", { sessionId });
      return new Response(JSON.stringify({ error: "session_not_found" }), { status: 404 });
    }

    // Idempotency: HesabPay may retry delivery — don't double-process.
    if (session.status === "confirmed") {
      return new Response(JSON.stringify({ status: "already_confirmed" }), { status: 200 });
    }

    if (!payload.success) {
      await supabase
        .from("payment_sessions")
        .update({ status: "failed", raw_webhook_payload: payload })
        .eq("id", session.id);

      return new Response(JSON.stringify({ status: "recorded_failed" }), { status: 200 });
    }

    // Defense in depth: confirm the charged amount matches what we
    // expected for this session before activating a subscription.
    if (Number(payload.amount) !== Number(session.amount)) {
      console.error("Webhook amount mismatch", {
        expected: session.amount,
        received: payload.amount,
        sessionId: session.id,
      });
      await supabase
        .from("payment_sessions")
        .update({ status: "failed", raw_webhook_payload: payload })
        .eq("id", session.id);

      return new Response(JSON.stringify({ error: "amount_mismatch" }), { status: 400 });
    }

    // 3. Confirmed — create the subscription and mark the session done.
    const days = TIER_DAYS[session.tier];
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { error: subErr } = await supabase.from("subscriptions").insert({
      profile_id: session.profile_id,
      tier: session.tier,
      amount: session.amount,
      expires_at: expiresAt,
      payment_reference: payload.transaction_id,
      status: "active",
    });

    if (subErr) {
      console.error("failed to create subscription row", subErr);
      return new Response(JSON.stringify({ error: "subscription_create_failed" }), { status: 500 });
    }

    await supabase
      .from("payment_sessions")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        hesabpay_session_id: payload.transaction_id,
        raw_webhook_payload: payload,
      })
      .eq("id", session.id);

    // Respond quickly and with 200 — HesabPay expects a response
    // under 10 seconds.
    return new Response(JSON.stringify({ status: "confirmed" }), { status: 200 });
  } catch (err) {
    console.error("hesabpay-webhook error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500 });
  }
});
