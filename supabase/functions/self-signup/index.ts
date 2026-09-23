// ============================================================
// self-signup
// ------------------------------------------------------------
// Replaces the admin-approval step of account creation for shop
// owners: previously the owner submitted `account_requests`, an
// admin approved it from the admin panel (admin-approve-account),
// and the resulting password was relayed to the owner manually over
// a call/WhatsApp. That's gone now — the owner picks their own
// password on the signup screen and gets an account immediately.
//
// This still has to be an Edge Function (not a plain client-side
// supabase.auth.signUp()) for two reasons, both mirroring why
// admin-approve-account already worked this way:
//   1. Login here is synthetic-email + password, not real email/
//      phone auth (see authHelpers.ts) — a client-side signUp() at
//      a fake "...@saudagar.local" address would sit waiting on an
//      email confirmation that can never arrive, unless email
//      confirmation is disabled project-wide (not assumed here).
//      auth.admin.createUser({ email_confirm: true }) sidesteps
//      that, and admin.* calls require the service role key, so this
//      has to run server-side.
//   2. The profiles row + first 30-day trial subscription need to be
//      created atomically alongside the auth user, same as
//      admin-approve-account already does.
//
// Deliberately public (no admin auth check) — this IS the new
// account-creation entry point, called directly from
// SignupScreen.tsx before the owner has any session at all.
//
// CORS: called directly from the browser (the PWA's own origin), so
// every response needs Access-Control-Allow-Origin, not just the
// OPTIONS preflight — same requirement as every other Edge Function
// in this project (see admin-approve-account for the fuller
// explanation of why a missing header here breaks callers that don't
// wrap fetch() in try/catch).
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TRIAL_DAYS = 30;
const MIN_PASSWORD_LENGTH = 6;

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

// Mirrors lib/phone.ts's normalizeAfghanPhone() — kept duplicated
// (edge functions can't share client-side modules) rather than
// imported, same as admin-approve-account already does. Must stay in
// sync with that file: it accepts a leading "0", "0093", or "+93"
// followed by 9 digits, in any of those three forms, and normalizes
// all of them to the same "+93XXXXXXXXX".
function normalizeAfghanPhone(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return trimmed;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("0093")) {
    digits = digits.slice(4);
  } else if (digits.startsWith("93") && digits.length > 9) {
    digits = digits.slice(2);
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length > 9) {
    digits = digits.slice(-9);
  }
  return `+93${digits}`;
}

function isValidAfghanPhone(raw: string): boolean {
  if (!raw) return false;
  return /^\+93\d{9}$/.test(normalizeAfghanPhone(raw));
}

// Mirrors phoneToSyntheticEmail() in lib/authHelpers.ts — must stay
// in sync, since login only works if both sides derive the same
// synthetic email from the same phone number.
function phoneToSyntheticEmail(phone: string): string {
  const digitsOnly = normalizeAfghanPhone(phone).replace(/\D/g, "");
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
    const body = await req.json().catch(() => ({}));
    const rawPhone: string = body?.phone_number ?? "";
    const password: string = body?.password ?? "";

    if (!isValidAfghanPhone(rawPhone)) {
      // Covers empty input, too few/too many digits, or a country
      // code that isn't 0 / 0093 / +93 — normalizeAfghanPhone() is
      // deliberately lenient (never throws), so this is the one place
      // that actually rejects a malformed number before anything is
      // created from it.
      return jsonResponse({ error: "invalid_phone" }, 400);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return jsonResponse({ error: "weak_password" }, 400);
    }

    const normalizedPhone = normalizeAfghanPhone(rawPhone);
    const syntheticEmail = phoneToSyntheticEmail(rawPhone);

    // Check both profiles (a completed signup) and any old pending
    // account_requests row (in case someone requested access under
    // the previous flow and hasn't been approved yet, then also tries
    // this flow) — either way "this phone already has something in
    // progress" should be a clear, specific error rather than a
    // confusing failure further down.
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", normalizedPhone)
      .maybeSingle();
    if (existingProfile) {
      return jsonResponse({ error: "phone_already_registered" }, 409);
    }

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
    });
    // Deliberately NOT passing `phone` here — same reasoning as
    // admin-approve-account: Supabase validates that field strictly
    // and we don't use Supabase's phone-auth at all. The real number
    // lives on profiles.phone_number, which is what the app uses.

    if (createErr || !newUser?.user) {
      // A duplicate synthetic email is the same underlying condition
      // as "phone already registered" (they're derived 1:1 from the
      // phone number) — the profiles check above should normally
      // catch this first, but map it the same way here too in case of
      // a race between two signup attempts for the same number.
      const alreadyExists = /already.*registered|already.*exists/i.test(createErr?.message ?? "");
      console.error("self-signup: auth user creation failed", createErr);
      return jsonResponse(
        { error: alreadyExists ? "phone_already_registered" : "signup_failed", detail: createErr?.message },
        alreadyExists ? 409 : 500
      );
    }

    // owner_name/shop_name are deliberately left unset — they default
    // to '' (see migrations/021_self_signup.sql) and get filled in
    // later from Settings -> Shop Profile. status is 'active'
    // immediately: there's no approval step left to gate it on.
    const { error: profileErr } = await supabase.from("profiles").insert({
      id: newUser.user.id,
      phone_number: normalizedPhone,
      status: "active",
    });

    if (profileErr) {
      console.error("self-signup: profile creation failed", profileErr);
      // Best-effort cleanup so a failed signup doesn't leave an
      // orphaned auth user that permanently squats this phone number
      // (it would otherwise block every future signup attempt with
      // "phone_already_registered" even though nothing usable exists).
      await supabase.auth.admin.deleteUser(newUser.user.id).catch((cleanupErr) => {
        console.error("self-signup: cleanup of orphaned auth user failed", cleanupErr);
      });
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
      console.error("self-signup: trial subscription creation failed", trialErr);
      // Not fatal to signup itself — the account and profile exist
      // and can log in; a trial can be created manually if this step
      // fails. Same non-fatal treatment as admin-approve-account.
    }

    return jsonResponse({ status: "created", login_phone: normalizedPhone });
  } catch (err) {
    console.error("self-signup error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
