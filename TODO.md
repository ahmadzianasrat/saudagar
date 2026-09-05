# Saudagar — Build TODO

Status: Supabase schema (incl. trial tier + triggers) written, HesabPay
integration confirmed and implemented end-to-end, admin-created auth
flow implemented, admin panel scaffolded with both screens working,
core app screens (ledger/inventory/prices/subscription) wired to real
data + the offline queue, renewal banner implemented, PWA icons
generated (placeholder), policy content drafted in all 3 languages.
**Nothing has been deployed to Supabase yet in this latest round —
see section 1 and 2.**

---

## 1. Supabase — migrations to run (in order)
- [x] `001_initial_schema.sql` — already run previously
- [x] `002_payment_sessions.sql` — already run previously
- [ ] **`003_trial_tier.sql`** — NEW, not yet run. Adds 'trial' as a valid subscription tier.
- [ ] **`004_triggers.sql`** — NEW, not yet run. Adds:
  - a trigger that updates `inventory_items.quantity` / `avg_cost_per_unit` automatically whenever an `inventory_transactions` row is inserted (this was a silent gap before — transactions were being recorded but never actually updating stock levels)
  - a trigger that computes `prices.change_from_previous` automatically on insert
- [ ] Confirm RLS is enabled on all tables (should already be true from 001, worth a dashboard check)
- [ ] Seed `markets` (launch city) and 2–3 `commodities` if not already done

## 2. Deploy Edge Functions (2 new ones added this round)
- [ ] Redeploy `create-payment-session` and `hesabpay-webhook` if not already done from the last round of fixes
- [ ] **Deploy `admin-approve-account`** (NEW) — creates the real auth user (synthetic email + generated password), profile, and 30-day trial subscription on approval
- [ ] **Deploy `admin-decline-account`** (NEW) — marks a request declined, creates nothing
- [ ] Set `HESABPAY_API_KEY` secret if not already set (should already be done)

## 3. Auth & onboarding — IMPLEMENTED
- [x] "Phone-number + admin-created login" model: no OTP/SMS at all. `admin-approve-account` generates a password and creates the Supabase auth user under a synthetic email (`<digits>@saudagar.local`) mapped from their real phone number. The phone itself lives on `profiles.phone_number` for actual use.
- [x] `LoginScreen.tsx` — phone + password form, maps phone to the same synthetic email client-side
- [x] `RequestAccessScreen.tsx` — writes to `account_requests`, unchanged from before
- [x] `App.tsx` — real Supabase auth state via `useAuth()`, routes between Login/RequestAccess/main app
- [ ] **Manual step, every approval**: after tapping Approve in the admin panel, the generated password is shown once — actually send it via the "Send via WhatsApp" link before navigating away, since it isn't stored anywhere retrievable afterward
- [ ] Decide if/when to add a "change your password" screen for users — not built yet, admin-issued passwords are permanent until changed via the Supabase dashboard otherwise

## 4. Admin panel — IMPLEMENTED (not yet deployed anywhere)
- [x] Scaffolded as a fully separate Vite app under `admin-panel/`
- [x] `AccountRequestsScreen.tsx` — approve/decline queue, calls the two new Edge Functions, shows generated credentials + a wa.me send-link on approval
- [x] `PriceUploadScreen.tsx` — market + commodity picker filtered to the logged-in admin's `allowed_markets`, price entry form
- [x] `AdminLoginScreen.tsx` — ordinary email/password login (admins are a small trusted population, don't need the shop-owner synthetic-email workaround)
- [x] `useAdminAuth.ts` — checks for a matching `admin_users` row after login, not just a valid Supabase session; blocks access with a clear message if someone authenticates but has no admin row
- [x] `App.tsx` — tabs now hide themselves based on the logged-in admin's actual permissions (`can_approve_accounts`, `allowed_markets`), rather than always showing both
- [ ] Deploy this as its own hosted app (Vercel/Netlify/etc.) or run locally for now — not yet decided where this lives long-term
- [x] Your own super_admin row — created manually via Supabase SQL Editor per the auth.users-first fix (create a real Auth user in the Dashboard, then insert into admin_users using that user's UUID and `ARRAY[...]::uuid[]` for allowed_markets)

## 5. Core app screens — IMPLEMENTED, needs real-device testing
- [x] `LedgerHome.tsx` — real balance summary, given/received cards, entry list with per-entry synced/pending indicator, new-entry form (including inline new-contact creation) wired to `enqueueWrite`
- [x] `InventoryHome.tsx` — item list with quantity/cost, today's market price shown against each item's stock value, purchase/sale/adjustment transaction form wired to `enqueueWrite`
- [x] `PricesHome.tsx` — market-grouped price list, market picker (currently only shows the picker UI once more than one market exists)
- [x] `SubscriptionScreen.tsx` — unchanged from before, already calls `create-payment-session`
- [x] `RenewalBanner.tsx` — shows 5 days before expiry (`RENEWAL_WARNING_DAYS = 5` in `useSubscriptionStatus.ts`), and a separate read-only notice once actually expired
- [x] **i18n string lookup — DONE.** `src/i18n/index.ts` (the `t()` function with English fallback + `{var}` interpolation) and `src/i18n/useTranslation.ts` (the `useTranslation()` hook bound to `LanguageContext`) now exist, and every screen — `BottomNav`, `LedgerHome`, `InventoryHome`, `PricesHome`, `SubscriptionScreen`, `LoginScreen`, `RequestAccessScreen`, `RenewalBanner`, `App.tsx` — pulls its text from `tr("some.key")` instead of hardcoded English. Translation files (`en.json`/`ps.json`/`da.json`) were expanded from ~9 keys to ~70 to cover every screen.
- [x] **Language/format settings screen — DONE.** `src/features/settings/SettingsScreen.tsx` — language switch (ps/da/en), digit-style toggle, thousand-separator checkbox, plus links to Manage Subscription and Change Password, plus Log Out. Reachable via the bottom nav's 4th tab, which — this was a pre-existing bug, now fixed — previously pointed at `/subscription` despite being labeled "Settings."
- [ ] WhatsApp "send today's entries" export button — discussed earlier, not yet built
- [ ] Test the whole ledger/inventory flow on an actual Android device, not just desktop browser — touch targets, RTL rendering, and offline behavior all need real-device verification

## 6. Offline sync
- [x] `enqueueWrite` calls wired into both `LedgerHome` and `InventoryHome`
- [ ] Real-device test: go offline, add several ledger + inventory entries, go back online, confirm both sync and indicators flip correctly
- [ ] Test idempotency: force a failed sync, retry, confirm no duplicate rows (relies on the `unique(profile_id, client_id)` / `unique(inventory_item_id, client_id)` constraints)

## 7. PWA polish
- [x] Placeholder icons generated (`public/icons/icon-192.png`, `icon-512.png`) — functional but genuinely placeholder (a teal square with "S"), swap for real designed icons before any Play Store submission
- [ ] Test "Add to Home Screen" on real Android devices
- [ ] Confirm service-worker app-shell caching doesn't conflict with the offline data queue

## 8. Pricing & policy content — DRAFTED in all 3 languages
- [x] `content/policies/terms.en.md` — subscription pricing, refund/cancellation policy, read-only-after-expiry explanation, dispute/record-keeping clause, price-accuracy disclaimer
- [x] `content/policies/terms.ps.md` — Pashto draft (machine-assisted, flagged for your manual review as planned)
- [x] `content/policies/terms.da.md` — Dari draft (same caveat)
- [ ] **Your planned manual review pass on the Pashto/Dari content** — especially the "Record-Keeping & Disputes" section, where precise wording carries real weight, per the earlier advice to get that specific section natively reviewed rather than relying on machine translation alone
- [ ] Build the actual in-app screen that displays this content (currently just markdown files, not wired into the app's UI/routing)

## 9. Free trial mechanics — DECIDED AND IMPLEMENTED
- [x] Modeled as a real `subscriptions` row with `tier='trial'`, `amount=0`, 30-day `expires_at` — NOT a separate flag on `profiles`. This means the existing `has_active_subscription()` RLS function needed zero changes; a trial subscription satisfies the same "active and not expired" check as a paid one.
- [x] Trial subscription is created automatically inside `admin-approve-account` at the moment of approval

## 10. Renewal reminder — DECIDED AND IMPLEMENTED
- [x] Banner shows starting 5 days before `expires_at` (`RENEWAL_WARNING_DAYS` constant in `src/lib/useSubscriptionStatus.ts`) — change that one constant if you want a different threshold later
- [x] Separate, distinct banner state once actually expired (read-only notice)

## 11. Data safety
- [ ] Upgrade Supabase to Pro once you have paying users, for daily backups (not before)

## 12. Pre-launch
- [ ] Hire/confirm the price-uploader; walk them through `PriceUploadScreen`
- [ ] Manually onboard the first handful of shops via the request-access + admin-approval flow
- [ ] Sanity-check subscribe → HesabPay checkout → webhook → active subscription end-to-end with one real small transaction before opening to real users
- [ ] Decide where the admin panel is hosted for your price-uploader to actually reach it day-to-day

---

## 13. Change password screen — NEW, IMPLEMENTED
- [x] `src/features/settings/ChangePasswordScreen.tsx` — re-verifies the CURRENT password via a fresh `signInWithPassword` call before allowing a change (not just relying on an existing session), specifically because admin-issued passwords are shared once via WhatsApp and devices may stay logged in long-term
- [x] Reachable from Settings → Change Password
- [ ] No equivalent screen built for the admin panel yet — admins still change password only via the Supabase Dashboard directly. Add one later if this becomes friction for your price-uploader or other admins.
- [ ] Still not enforced: forcing a password change on first login for admin-issued credentials — the change-password screen exists, but nothing requires using it

---

## Both Vercel projects are live
- Main app: https://saudagar-tan.vercel.app/
- Admin panel: https://saudagar-4bgv.vercel.app/

## Remaining open items
- [ ] Real-device testing (section 5/6) — still not done, now more meaningful to do since the UI is actually translated
- [ ] WhatsApp "send today's entries" export button — not yet built
- [ ] In-app screen displaying the policy content — markdown files exist in `content/policies/`, not routed into the app yet
- [ ] Your manual native-review pass on the Pashto/Dari policy translations AND the newly expanded Pashto/Dari UI strings in `ps.json`/`da.json` — these are machine-assisted drafts like the policy content was, same caveat applies now that there's a lot more of them
- [ ] Admin panel change-password screen (optional, not urgent)
- [ ] Force-password-change-on-first-login (optional, not urgent)
