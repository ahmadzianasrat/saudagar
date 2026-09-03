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
- [ ] Deploy this as its own hosted app (Vercel/Netlify/etc.) or run locally for now — not yet decided where this lives long-term
- [ ] No login screen built for the admin panel itself yet — currently assumes an already-authenticated Supabase session; needs its own simple login form (can reuse the main app's phone+password pattern, or just use email/password directly for admins since they're not the same trust-sensitive population as end users)
- [ ] Manually create your own `admin_users` row (role='super_admin', can_approve_accounts=true, allowed_markets=[your launch market id]) — nothing in the UI creates the first admin, that has to be done directly in the Supabase dashboard once

## 5. Core app screens — IMPLEMENTED, needs real-device testing
- [x] `LedgerHome.tsx` — real balance summary, given/received cards, entry list with per-entry synced/pending indicator, new-entry form (including inline new-contact creation) wired to `enqueueWrite`
- [x] `InventoryHome.tsx` — item list with quantity/cost, today's market price shown against each item's stock value, purchase/sale/adjustment transaction form wired to `enqueueWrite`
- [x] `PricesHome.tsx` — market-grouped price list, market picker (currently only shows the picker UI once more than one market exists)
- [x] `SubscriptionScreen.tsx` — unchanged from before, already calls `create-payment-session`
- [x] `RenewalBanner.tsx` — shows 5 days before expiry (`RENEWAL_WARNING_DAYS = 5` in `useSubscriptionStatus.ts`), and a separate read-only notice once actually expired
- [ ] **i18n string lookup still not wired** — `BottomNav.tsx` and all new screens use hardcoded English text, not the `en.json`/`ps.json`/`da.json` files. Needs a `t(key, language)` helper built and threaded through every screen — this is the single biggest piece of "looks done but isn't" work remaining
- [ ] Language/format settings screen (language switch + digit style + thousand separator toggle) — `LanguageContext` supports all of this already, no UI screen exists to control it yet
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

## Newly surfaced items from this round (not yet decided)
- [ ] Where/how the admin panel gets deployed and who else besides you gets a login to it
- [ ] Whether admin-issued temp passwords should be forced to change on first login (not currently enforced)
- [ ] The i18n lookup gap (section 5) is the most consequential thing left — worth prioritizing before any of the language/UI decisions feel "real" in the running app
