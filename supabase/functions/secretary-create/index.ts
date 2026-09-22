// ============================================================
// secretary-create
// ------------------------------------------------------------
// Called by a shop OWNER (from Settings → Secretaries) to create a
// secretary login for their own shop. Same synthetic-email pattern
// as admin-approve-account (see that file for why), but this one is
// owner-initiated rather than admin-initiated — a shop owner doesn't
// need saudagar's own staff involved to delegate access to
// their own shop.
//
// Creating an auth user needs the service role key, which only an
// Edge Function has access to — this is why secretary creation can't
// just be a client-side insert the way adding a counterparty is.
//
// The generated password is returned in the response ONLY — never
// stored in plaintext — so the owner can relay it to the secretary
// directly (in person, call, WhatsApp).
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

// Mirrors lib/phone.ts's normalizeAfghanPhone() — kept duplicated
// (edge functions can't share client-side modules). Must stay in sync.
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    // Caller must be a shop OWNER (has their own profiles row) — a
    // secretary creating another secretary would be exactly the kind
    // of privilege escalation this feature exists to prevent.
    const { data: ownerProfile, error: ownerErr } = await supabase
      .from("profiles")
      .select("id, shop_name")
      .eq("id", userData.user.id)
      .single();

    if (ownerErr || !ownerProfile) {
      return jsonResponse({ error: "forbidden_not_an_owner" }, 403);
    }

    const { name, phone_number } = await req.json();
    if (!name || !phone_number) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }

    const normalizedPhone = normalizeAfghanPhone(phone_number);
    const syntheticEmail = phoneToSyntheticEmail(phone_number);
    const tempPassword = generatePassword();

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      password: tempPassword,
      email_confirm: true,
    });

    if (createErr || !newUser?.user) {
      console.error("secretary auth user creation failed", createErr);
      // A duplicate phone number (already registered as an owner or
      // another secretary) lands here as a conflict, not a 500.
      const isDuplicate = createErr?.message?.toLowerCase().includes("already");
      return jsonResponse(
        { error: isDuplicate ? "phone_already_registered" : "user_creation_failed", detail: createErr?.message },
        isDuplicate ? 409 : 500
      );
    }

    const { error: linkErr } = await supabase.from("shop_secretaries").insert({
      owner_profile_id: ownerProfile.id,
      secretary_user_id: newUser.user.id,
      name,
      phone_number: normalizedPhone,
      status: "active",
    });

    if (linkErr) {
      console.error("shop_secretaries insert failed", linkErr);
      // Roll back the orphaned auth user so a failed creation doesn't
      // leave an unlinked, unusable login behind.
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return jsonResponse({ error: "link_creation_failed", detail: linkErr.message }, 500);
    }

    return jsonResponse({
      status: "created",
      login_phone: normalizedPhone,
      temp_password: tempPassword,
      name,
    });
  } catch (err) {
    console.error("secretary-create error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
