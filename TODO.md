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


---

## 14. CORS + error-handling fixes (this round)
- [x] **CORS headers added** to `admin-approve-account`, `admin-decline-account`, and `create-payment-session` — these are called directly from the browser (admin panel / main app, both hosted on Vercel, different origins than the Supabase functions URL), and none of them had `Access-Control-Allow-Origin` set. This is almost certainly why clicking Approve left both buttons stuck gray: the browser's fetch() call failed before your function code ever ran, and `AccountRequestsScreen` didn't have a `finally` block to reset the busy state when that happened.
- [x] **`AccountRequestsScreen.tsx` rewritten** — approve/decline now wrapped in try/catch/finally, so a failed request always resets the button state and shows a visible error message instead of getting stuck silently.
- [x] **`RequestAccessScreen.tsx` fixed** (previous round) — now checks the insert's error before showing "pending approval."
- [ ] **Redeploy required**: `admin-approve-account`, `admin-decline-account`, `create-payment-session` — all three need `supabase functions deploy <name>` again for the CORS fix to take effect
- [ ] Retry the approve flow after redeploying — the temp password will appear directly in the admin panel's UI on success (this is also the answer to "how do I get a password" — it's generated automatically on approval, never chosen by the user)

---

## 15. user_creation_failed fix (this round)
- [x] Admin panel now surfaces `result.detail` alongside `result.error`, so future failures show the actual underlying Supabase message instead of just an opaque error code
- [x] **Removed `phone` from the `auth.admin.createUser()` call** in `admin-approve-account` — likely root cause of "user_creation_failed": Supabase validates that field strictly (expects E.164 format, e.g. `+93707339100`), and the request phone (`0707339100`) wasn't in that format. Login doesn't use Supabase's phone-auth anyway (synthetic email + password only), so the field wasn't needed — `profiles.phone_number` remains the real source of truth for the phone number.
- [x] **Fixed a knock-on issue in `ChangePasswordScreen.tsx`** — it was reading the phone number from `auth.users.phone` to re-verify the current password, which would have silently broken once that field stopped being set. Now reads from `profiles.phone_number` instead.
- [ ] **Redeploy required**: `admin-approve-account` again for this fix
- [ ] Retry approving the same pending request once redeployed

---

## 16. This round's fixes and new features

### Vercel hard-refresh 404
- [x] Added `vercel.json` with an SPA rewrite rule — without it, refreshing any route other than `/` (e.g. `/inventory`) returns a 404 because Vercel looks for a physical file there. Only needed for the main app (admin panel has no client-side routing yet).

### HesabPay `hesabpay_create_failed`
- [x] Found the likely cause: redirect URLs used a custom `saudagar://` scheme, meaningless for a PWA with no such scheme registered. Changed to real `https://saudagar-tan.vercel.app/subscription?...` URLs via a new `APP_URL` Edge Function secret (defaults to that domain if unset).
- [x] `SubscriptionScreen` now shows the full error detail on failure instead of discarding it, and shows a notice banner when redirected back from HesabPay checkout (success or failure) — note the redirect itself is informational only; the webhook is still the actual source of truth for activation.
- [ ] **Redeploy required**: `create-payment-session`
- [ ] **Set the `APP_URL` secret** if your domain differs: `supabase secrets set APP_URL=https://saudagar-tan.vercel.app`
- [ ] Retry subscribing — if it still fails, the error message will now show HesabPay's actual rejection reason instead of just the generic code

### Ledger restructured to per-customer accounts
- [x] `LedgerHome.tsx` is now a contact list — each customer shows their own running balance, sorted by most recent activity, with a "+ Add Contact" flow
- [x] New `CounterpartyLedgerDetail.tsx` — tapping a contact opens their individual ledger (balance, given/received breakdown, entries, new-entry form), replacing the old combined single-page feed
- [x] New route `/ledger/:counterpartyId` added to `App.tsx`

### Inventory silently showing nothing
- [x] Found the likely cause: several Supabase queries in `InventoryHome.tsx` destructured only `data` and discarded `error` entirely — so a failed read (RLS, bad join, anything) rendered as an empty list with zero indication anything was wrong, even if the underlying insert had actually succeeded.
- [x] Added proper error checking + visible error messages to every read/write in `InventoryHome.tsx`
- [ ] **Test again after redeploying** — if it still shows nothing, you'll now see an actual error message on screen; share that text rather than "shows nothing," since that's what will actually pin down the remaining cause if the error-swallowing wasn't the whole story

### Manual subscription payments (new feature)
- [x] `008_manual_payments.sql` — new `manual_payment_requests` table + a private `payment-proofs` Storage bucket with RLS (users upload/read only their own folder, admins with `can_approve_accounts` can read all)
- [x] `admin-approve-manual-payment` / `admin-reject-manual-payment` Edge Functions — approval creates a real `subscriptions` row (same pattern as the trial), rejection just marks the claim rejected
- [x] `SubscriptionScreen.tsx` — added a "Pay another way (cash / mobile top-up)" section: pick a tier, add a note, optionally attach a screenshot, submit for review
- [x] `ManualPaymentsScreen.tsx` (admin panel, new tab) — shows each pending claim with shop info, note, and a signed-URL preview of the proof image if attached, with Approve/Reject buttons
- [ ] **Run migration `008_manual_payments.sql`**
- [ ] **Deploy both new Edge Functions**: `admin-approve-manual-payment`, `admin-reject-manual-payment`
- [ ] Test the full loop: submit a manual claim as a shop owner, review + approve it as admin, confirm a `subscriptions` row appears

---

## What's next after this round
1. Redeploy the 4 touched/new Edge Functions and push the app + admin panel changes
2. Re-test all four bug fixes (hard refresh, HesabPay, ledger, inventory) and the new manual-payment flow end-to-end
3. Real-device offline testing (still open from earlier — now more meaningful since the ledger structure actually matches the real product shape)
4. WhatsApp "send today's entries" export button (still open)
5. In-app policy content screen (still open)
6. Once the above is solid: onboard your price-uploader on the live admin panel, do one real HesabPay test transaction, then start onboarding real shop owners

---

## 17. Ledger + Inventory feature additions (this round)

### Ledger
- [x] Quick Entry restored on the main Ledger page — select an existing contact from a dropdown, add an entry directly, without navigating into their detail page. Their balance in the contact list updates immediately.
- [x] New paginated "All Entries" table on the main Ledger page — combined across every contact, most recent first, 10/page, tapping a row jumps to that contact's detail page
- [x] Pagination also added to the per-contact detail view's entry list (10/page) — previously unbounded

### Inventory
- [x] New paginated "All Transactions" table — combined across every commodity, most recent first, 10/page, shows type/quantity/unit cost/extra costs per row
- [x] Purchase transactions now have optional **transport cost** and **porter/worker fee** fields
- [x] `010_inventory_transaction_costs.sql` — added `transport_cost`/`porter_fee` columns and updated the weighted-average-cost trigger to fold BOTH into `avg_cost_per_unit` on a purchase, not just the per-unit price. This means "how much it costs me" now reflects true landed cost (goods + getting them to the shop), which is what actually matters for margin decisions.
- [x] `InventoryHome.tsx` now re-fetches items after every transaction rather than guessing the new average client-side — the trigger is the authoritative source of truth for that math, so the UI just reflects it rather than duplicating it

### Shared
- [x] New reusable `Pagination.tsx` component (client-side, slices an already-fetched array) — used in all three tables above. Worth revisiting with server-side `range()` pagination later if any single shop's history grows large enough that fetching everything up front becomes slow, but fine at current scale.

- [ ] **Run migration `010_inventory_transaction_costs.sql`**
- [ ] Redeploy is NOT needed for this round — no Edge Functions changed, only the app/admin-panel code and one migration
- [ ] Test: add a purchase with transport cost + porter fee, confirm the item's avg cost reflects all three components combined, not just the unit price
