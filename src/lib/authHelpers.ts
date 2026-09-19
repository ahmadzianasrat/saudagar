import { normalizeAfghanPhone } from "./phone";

// Mirrors the phoneToSyntheticEmail() logic in
// supabase/functions/admin-approve-account/index.ts — must stay in
// sync with that function, since a login only works if both sides
// derive the same synthetic email from the same phone number.
//
// Normalizing to +93XXXXXXXXX before stripping non-digits means the
// digit string used here is stable regardless of how the number was
// originally typed (with/without "+93", with/without a leading "0"),
// as long as phone numbers are saved normalized (see lib/phone.ts) —
// which they now are, everywhere the app collects one.
export function phoneToSyntheticEmail(phone: string): string {
  const digitsOnly = normalizeAfghanPhone(phone).replace(/\D/g, "");
  return `${digitsOnly}@saudagar.local`;
}
