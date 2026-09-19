// ============================================================
// Phone number normalization.
// ------------------------------------------------------------
// Every mobile/WhatsApp number the app saves — on registration,
// login, a ledger contact, an inventory purchase/sale party, or the
// shop's own WhatsApp number — gets normalized to a single canonical
// form: +93XXXXXXXXX (9 digits after the country code).
//
// This matters beyond cosmetics: phoneToSyntheticEmail() (see
// authHelpers.ts) derives a shop owner's login email from their
// phone number by stripping non-digits. Before this normalization
// existed, "+93793111222", "0793111222", and "793111222" all
// produced DIFFERENT digit strings (93793111222 / 0793111222 /
// 793111222) and therefore different synthetic emails — so someone
// who registered typing one format and later logged in typing another
// couldn't sign in. Normalizing every input to the same canonical
// string before it's ever saved or hashed into an email fixes that
// at the source.
// ============================================================

/**
 * Normalize a raw, user-typed Afghan mobile number to "+93XXXXXXXXX"
 * (9 digits after the country code). Handles the common ways people
 * type it: with or without a leading "+93"/"0093", with or without
 * the local trunk "0", with spaces/dashes/parentheses.
 *
 * Best-effort: if the input doesn't resolve to a clean 9-digit local
 * number (too short, extra digits, non-Afghan number), it still
 * returns "+93" followed by whatever digits are left — it never
 * throws — but a length check is available via isValidAfghanPhone()
 * for callers that want to flag it to the user.
 */
export function normalizeAfghanPhone(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return trimmed;

  let digits = trimmed.replace(/\D/g, "");

  // Strip an international trunk prefix: "0093..." -> "93..."
  if (digits.startsWith("0093")) {
    digits = digits.slice(4);
  } else if (digits.startsWith("93") && digits.length > 9) {
    // "+93793111222" (no +, already dialed as country code + number)
    digits = digits.slice(2);
  }

  // Strip a local trunk "0": "0793111222" -> "793111222"
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // If something longer still made it through (e.g. stray leading
  // zeros), keep just the last 9 digits — a mobile number's most
  // significant digits are always at the end of what was typed.
  if (digits.length > 9) {
    digits = digits.slice(-9);
  }

  return `+93${digits}`;
}

/** True when normalizeAfghanPhone() produced a clean 9-digit number. */
export function isValidAfghanPhone(raw: string): boolean {
  if (!raw) return false;
  const normalized = normalizeAfghanPhone(raw);
  return /^\+93\d{9}$/.test(normalized);
}
