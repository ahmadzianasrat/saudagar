// ============================================================
// hesabpay-webhook
// ------------------------------------------------------------
// Receives HesabPay's payment-attempt webhook, verifies its
// signature via HesabPay's own verify-signature endpoint (never
// trust an incoming webhook body without this step — anyone could
// POST a fake "payment succeeded" body otherwise), then:
//   - marks the matching payment_sessions row as confirmed/failed
//   - on confirmed: creates the actual `subscriptions` row,
//     which is what the RLS paywall check reads from.
//
// STILL UNCONFIRMED as of this version — HesabPay's dashboard
// ("Subscribe to HesabPay events") registers this endpoint per-event
// (Payment Success / Payment Failure) and likely issues a signing
// secret at registration time, shown once. That points to local HMAC
// verification using a shared secret rather than a call-back
// verify-signature API — but the dedicated "Webhooks" documentation
// page (linked from the sidebar, not yet fetched) is the source of
// truth for the exact payload schema and signature method. Pull that
// page's content before relying on this in production; the fallback
// verify-signature API call below is kept as a secondary guess from
// an earlier, less-authoritative source (a HesabPay WooCommerce
// plugin listing) and should be replaced once confirmed.
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HESABPAY_API_KEY = Deno.env.get("HESABPAY_API_KEY")!;
const HESABPAY_VERIFY_URL = "https://api.hesab.com/api/v1/hesab/webhooks/verify-signature";
// TODO: set this from the signing secret HesabPay shows when you
// click "Add endpoint" on the webhook registration page, if they
// issue one — this is the more likely verification path.
const HESABPAY_WEBHOOK_SECRET = Deno.env.get("HESABPAY_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TIER_DAYS: Record<string, number> = { monthly: 30, six_month: 182 };

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    // 1. Verify the signature with HesabPay before trusting anything
    //    in this payload. Never update payment status on an
    //    unverified webhook — this is the step that stops someone
    //    from just POSTing a fake "paid" event at this URL.
    const signatureHeader = req.headers.get("X-Hesab-Signature") ?? "";
    let isValid = false;

    if (HESABPAY_WEBHOOK_SECRET) {
      // PREFERRED PATH (once confirmed): local HMAC verification using
      // the signing secret from the "Add endpoint" dashboard step.
      // TODO: confirm algorithm (assuming HMAC-SHA256 over the raw body,
      // the common default) and header name once the Webhooks doc page
      // is available — "X-Hesab-Signature" is a guess.
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(HESABPAY_WEBHOOK_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
      const computedSig = Array.from(new Uint8Array(sigBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      isValid = computedSig === signatureHeader;
    } else {
      // FALLBACK PATH (unconfirmed, lower-confidence source): call
      // HesabPay's verify-signature endpoint, per an earlier reference
      // (their WooCommerce plugin listing) rather than the authoritative
      // Webhooks doc. Keep only until the real doc page is confirmed.
      const verifyResponse = await fetch(HESABPAY_VERIFY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `API-KEY ${HESABPAY_API_KEY}`,
        },
        body: JSON.stringify({ payload: rawBody, signature: signatureHeader }),
      });
      const verifyResult = await verifyResponse.json();
      isValid = verifyResult?.valid === true || verifyResult?.verified === true;
      if (!verifyResponse.ok) {
        console.error("HesabPay verify-signature call failed", verifyResult);
      }
    }

    if (!isValid) {
      console.error("HesabPay webhook signature invalid or unverifiable");
      return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 401 });
    }

    // 2. Extract the fields we need. Payload schema not yet confirmed
    // from an authoritative source. Since we set items[0].id = our
    // payment_sessions.id at creation, check for it being echoed back
    // in a few plausible shapes; fall back to any HesabPay-assigned
    // session/transaction id if items aren't echoed at all.
    // TODO: replace this guesswork once a real webhook payload is seen
    // (log `payload` from a real test transaction and adjust).
    const clientReference =
      payload?.items?.[0]?.id ??
      payload?.data?.items?.[0]?.id ??
      payload?.client_reference ??
      payload?.data?.client_reference;
    const hesabSessionId =
      payload?.session_id ?? payload?.data?.session_id ?? payload?.transaction_id;
    // Event type may arrive as a top-level "event" field (matching the
    // dashboard's Payment Success / Payment Failure subscription choice)
    // rather than a "status" field — checking both.
    const paymentStatus =
      payload?.status ?? payload?.data?.status ?? payload?.event ?? payload?.data?.event;

    if (!hesabSessionId && !clientReference) {
      return new Response(JSON.stringify({ error: "missing_reference" }), { status: 400 });
    }

    // 3. Find our pending session — prefer matching on our own
    // client_reference (the payment_sessions.id we sent at creation),
    // fall back to HesabPay's session id if that's what's echoed back.
    const { data: session, error: findErr } = await supabase
      .from("payment_sessions")
      .select("*")
      .or(
        clientReference
          ? `id.eq.${clientReference}`
          : `hesabpay_session_id.eq.${hesabSessionId}`
      )
      .single();

    if (findErr || !session) {
      console.error("payment_sessions row not found for webhook", { hesabSessionId, clientReference });
      return new Response(JSON.stringify({ error: "session_not_found" }), { status: 404 });
    }

    // Idempotency: if we've already confirmed this session, don't
    // double-process (HesabPay may retry webhook delivery).
    if (session.status === "confirmed") {
      return new Response(JSON.stringify({ status: "already_confirmed" }), { status: 200 });
    }

    const isSuccessEvent =
      ["paid", "success", "payment_success", "payment.success"].includes(
        String(paymentStatus).toLowerCase()
      );

    if (!isSuccessEvent) {
      await supabase
        .from("payment_sessions")
        .update({ status: "failed", raw_webhook_payload: payload })
        .eq("id", session.id);

      return new Response(JSON.stringify({ status: "recorded_failed" }), { status: 200 });
    }

    // 4. Mark the session confirmed and create the actual subscription.
    const days = TIER_DAYS[session.tier];
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { error: subErr } = await supabase.from("subscriptions").insert({
      profile_id: session.profile_id,
      tier: session.tier,
      amount: session.amount,
      expires_at: expiresAt,
      payment_reference: hesabSessionId ?? session.hesabpay_session_id,
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
        raw_webhook_payload: payload,
      })
      .eq("id", session.id);

    return new Response(JSON.stringify({ status: "confirmed" }), { status: 200 });
  } catch (err) {
    console.error("hesabpay-webhook error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500 });
  }
});
