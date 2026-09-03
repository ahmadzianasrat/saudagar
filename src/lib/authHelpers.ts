// Mirrors the phoneToSyntheticEmail() logic in
// supabase/functions/admin-approve-account/index.ts — must stay in
// sync with that function, since a login only works if both sides
// derive the same synthetic email from the same phone number.
export function phoneToSyntheticEmail(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  return `${digitsOnly}@saudagar.local`;
}
