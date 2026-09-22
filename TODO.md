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

---

## 18. Sale price + forgot password (this round)

### Inventory sale price
- [x] Sale transactions now require a price (per unit) — previously only purchases had any price field
- [x] Reused the existing `unit_cost` column for sale price rather than adding a new one — the cost-basis trigger only reads it for purchases, so this doesn't affect `avg_cost_per_unit`, it's just a revenue record
- [x] Transaction history now shows a computed total (price × quantity) for both purchases and sales
- [ ] **Not built yet, worth considering later**: profit-per-sale (sale price vs. cost basis at time of sale) — would need snapshotting the item's avg cost onto the transaction row at sale time, since the item's average keeps changing afterward. Flagging as a real gap, not implementing now since it wasn't asked for.

### Forgot password
- [x] Since login uses a synthetic email with no real inbox, a standard email-reset link can't work — implemented the same pattern as account creation: shop owner contacts the admin, admin resets from the panel
- [x] `011_admin_read_profiles.sql` — admins with `can_approve_accounts` can now read the full profiles list (needed to look someone up), no write access added
- [x] `admin-reset-password` Edge Function — generates a new password, updates it via Supabase's admin API, returns it for the admin to relay via WhatsApp
- [x] New `UsersScreen.tsx` (admin panel, new "Users" tab) — searchable list of active shop accounts with a Reset Password button per row
- [x] `LoginScreen.tsx` now shows a hint: "Forgot your password? Contact your shop's Saudagar admin to reset it."
- [ ] **Run migration `011_admin_read_profiles.sql`**
- [ ] **Deploy `admin-reset-password`**
- [ ] Test: search for your own test account in the new Users tab, reset its password, confirm login works with the new one

---

## What's next after this round

1. Run migration 011, deploy admin-reset-password, redeploy nothing else (no other functions changed)
2. Test sale-price entry and the password reset flow end-to-end
3. **Real-device offline testing** — still the largest untested area: go offline, add ledger/inventory entries (including the new quick-entry and sale-price flows), reconnect, confirm sync
4. **WhatsApp "send today's entries" export** — still on the list, not yet built
5. **In-app policy content screen** — markdown files exist, not routed into the app
6. Once the above feels solid: onboard your price-uploader for real, complete one full real HesabPay payment end-to-end (session creation is confirmed working, but the webhook → active subscription half has never been tested with a real completed payment), then start onboarding real shop owners

---

## 19. This round's additions

### Date grouping (Ledger + Inventory)
- [x] New `src/lib/dateFormat.ts` using the `jalaali-js` library (not hand-written — Gregorian↔Jalali conversion has real leap-year edge cases not worth risking in a records app)
- [x] "Today" / "Yesterday" / date headers now separate entries in: the main Ledger's All Entries table, the per-contact ledger detail, and Inventory's All Transactions table

### Extended contact fields
- [x] `012_counterparty_fields.sql` — added `address` and `whatsapp_number` columns; existing `phone_number` is now treated as "mobile number" in the UI (no rename, to avoid breaking existing data/wa.me code that reads it)
- [x] Add-contact form now captures all 4 fields (name required, mobile required, WhatsApp + address optional)
- [x] WhatsApp number shown alongside name in the contact list
- [x] Full profile card (name, mobile, WhatsApp, address) shown at the top of each contact's detail page

### Shamsi/Gregorian date toggle
- [x] New `dateSystem` preference in `LanguageContext` (default: Gregorian), toggle added to Settings
- [x] Every date display in Ledger and Inventory now respects this setting

### Currency converter
- [x] New `CurrencyConverterScreen.tsx`, linked from Settings — converts between AFN and a few other currencies (USD, PKR, INR) using rates YOU set and edit yourself, stored locally on the device
- [ ] **This is explicitly not a live-rate feed** — no exchange rate API is wired up. Update the rates manually as needed, or flag if you want a live-rate integration built later (that's a separate, larger decision involving picking a reliable data source).

### Inventory sale-side costs
- [x] Transport cost and porter fee are now optional fields on **sale** transactions too, not just purchases
- [x] Confirmed and documented: these do NOT affect `avg_cost_per_unit` (the main inventory page's cost figure) — only purchase-side costs feed into acquisition cost basis. Sale-side costs are recorded for your own reference only.

### Refresh issue
- [x] Fixed the confirmed architectural gap: `useSubscriptionStatus` now refetches on window focus, on tab visibility change, and every 30 seconds while mounted — not just once on page load. This directly fixes "subscribed via HesabPay but had to refresh to see it activate," since that status change happens asynchronously via the webhook with no way for the app to be pushed a notification.
- [ ] **If other specific screens still show stale data after a write**, that needs a precise repro (which screen, which action) to diagnose — the ledger and inventory screens already update their own state optimistically on every write made through their own UI, so if something there is still stale, it's a different, more specific bug worth describing exactly rather than "refresh issues" generally.

- [ ] **Run migration `012_counterparty_fields.sql`**
- [ ] **`npm install`** needed before building — `jalaali-js` was added as a new dependency
- [ ] No Edge Functions changed this round — only migrations + app/admin-panel code

---

## 20. This round — 7 items

### 1. Edit capability (Ledger + Inventory)
- [x] Contact profile editing (name, mobile, WhatsApp, address) from the contact detail page
- [x] Ledger entry editing (type, amount, note) — inline edit on each entry row
- [x] Inventory transaction editing (type, quantity, cost, transport, porter fee) — inline edit on each transaction row
- [x] `013_inventory_transaction_edit.sql` — replaced the insert-only trigger with one that recomputes the item's quantity/avg cost from FULL transaction history on insert/update/delete, so edits stay correct (the old trigger only fired on insert — editing a transaction would have silently desynced the item's cached totals)
- [x] Edits are direct Supabase calls, not offline-queued — a deliberate simplification; correcting an existing record is less time-critical than recording a new one, and this avoids needing update-merge logic in the offline queue

### 2. "Adjustment" — explained + bug fixed
- [x] Explained above: a manual quantity correction not tied to buying or selling (recount, spoilage, loss)
- [x] **Fixed a real bug**: adjustments previously always forced a positive quantity — there was no way to record a decrease. Now accepts a signed value directly, with a hint shown under the field when Adjustment is selected.

### 3. Sync-only-after-refresh — root cause fixed
- [x] `offlineQueue.ts`: `enqueueWrite` now awaits the sync attempt instead of firing it in the background unobserved — this was the actual bug. Every screen that writes now re-checks sync status immediately after and shows the real result, not a hardcoded "pending" that only ever updated on a full reload.

### 4. "Time ago" everywhere
- [x] New `timeAgo()` in `dateFormat.ts`, shown alongside (not instead of) the full date/time in: ledger entries (both list and detail), inventory transactions, and prices

### 5. Prices page — recent activity feed
- [x] Now shows the 10 most recent price uploads across all commodities for the selected market (with date grouping + time-ago), instead of collapsing to one "today's price" row per commodity

### 6. Super admin full authority + admin management
- [x] `014_super_admin_authority.sql` — every RLS policy that checked `allowed_markets` or `can_approve_accounts` now also accepts `role = 'super_admin'` as an automatic bypass, so a super admin never needs manual permission assignment as new markets/commodities get added
- [x] Added `is_active` flag — lets a super admin deactivate another admin reversibly, without deleting their row
- [x] New `admin-create-admin` and `admin-update-admin` Edge Functions — super-admin-only, used to create new staff admins and adjust their permissions/active status
- [x] New "Admins" tab in the admin panel (super_admin only) — create new admins, toggle their `can_approve_accounts`, check/uncheck their allowed markets, deactivate/reactivate
- [x] Admin panel's tab visibility and `PriceUploadScreen`'s market list both now bypass for `role === 'super_admin'` at the UI level too, not just RLS

### 7. Currency converter redesign
- [x] INR removed entirely
- [x] Rate editing redesigned to 3 explicit fields: "1 USD = ? AFN", "1000 AFN = ? PKR", "1000 PKR = ? AFN" — with a radio button choosing which AFN↔PKR direction is authoritative, avoiding two possibly-inconsistent rates being used silently
- [x] The ⇄ button between the currency dropdowns now actually swaps them on click

---

## To run before testing this round
- [ ] **Migrations**: `013_inventory_transaction_edit.sql`, `014_super_admin_authority.sql`
- [ ] **Deploy 4 Edge Functions**: `admin-approve-account`, `admin-decline-account`, `admin-approve-manual-payment`, `admin-reject-manual-payment`, `admin-reset-password` (permission-check updates), plus deploy the 2 NEW ones: `admin-create-admin`, `admin-update-admin`
- [ ] After migration 014 runs, your existing super_admin row should automatically gain full access everywhere — no manual allowed_markets update needed, that's the whole point of this change
- [ ] Test: create a second (staff) admin via the new Admins tab, confirm their permissions actually gate what they can do
- [ ] Test: edit a ledger entry and an inventory transaction, confirm the inventory item's quantity/avg cost updates correctly after an edit specifically (not just after a fresh insert)
- [ ] Test: add an entry/transaction, confirm the sync indicator shows "Synced" without needing a refresh

---

## 21. Super admin login issue — resolved

- [x] Diagnosed as a transient PostgREST schema-cache lag following migration 014's schema change (`is_active` column) — NOT an RLS or data problem. The `admin_users` row, its `is_active` flag, and both policies were all confirmed correct via direct SQL.
- [x] `015_fix_admin_users_recursion.sql` replaced the self-referential "super admin reads all admins" policy with a `SECURITY DEFINER` function (`is_active_super_admin()`), removing a latent risk even though it likely wasn't the actual cause of this specific issue
- [x] Login resolved on its own shortly after — worth remembering for next time: **after any migration that changes table structure, a brief delay or a manual `NOTIFY pgrst, 'reload schema';` may be needed before the app reflects it**, even though the database itself is already correct

---

## 22. Currency-per-entry follow-up round — offline login, receipts-as-image, RTL currency labels, phone normalization

### 1. PWA stuck on "Loading…" forever when opened offline
- [x] Root cause: `useAuth.ts` called `supabase.auth.getSession()` with no timeout. Offline + an expired stored token meant supabase-js's internal token-refresh fetch just hung — nothing to time it out, so `loading` never flipped to `false`.
- [x] Fixed by racing `getSession()` against a 4s timeout (skipped entirely when `navigator.onLine === false`), falling back to whatever session is still in localStorage so the offline-first app shell (and its IndexedDB write queue) can load and work. Reconciles with a real session once an `online` event fires.

### 2. Pashto loading text
- [x] `auth.loading` in `ps.json` changed to "پرانيستل کېږي…"

### 3 & 4. Receipts generated as an image (not PDF), fully localized
- [x] Removed `jspdf` and the English/Latin-digit-only PDF builders (`buildTransactionReceiptPdf`, `buildLedgerReceiptPdf`) — jsPDF's built-in fonts can't render Pashto/Dari glyphs at all, which is why the old PDF was always forced to English regardless of app language.
- [x] Added `html-to-image` (lazy-loaded, own ~13KB chunk, same reasoning as the old jsPDF lazy-load) and `lib/receiptImage.ts` — rasterizes the receipt's actual on-screen DOM to a PNG, so whatever script is displayed is exactly what's saved/shared.
- [x] `ReceiptModal.tsx` now owns image generation directly (`filename`/`whatsappText`/`whatsappPhone` props replace the old `onDownload`/`whatsappHref`): Download saves a PNG; the WhatsApp button tries the Web Share API with the actual image file attached first, falling back to the old wa.me text-only link on browsers that can't share files.
- [x] Account statement (`CounterpartyLedgerDetail.tsx`) now also includes the itemized per-entry lines (date/note/amount, oldest-first, one block per currency) in the captured image/on-screen view, matching (and improving on, since it's now properly localized) what the old PDF itemization had.

### 5. RTL currency labels
- [x] New `currencyLabel(currency, isRTL, style)` in `LanguageContext.tsx` — افغانی/کلدار for prose contexts (headings, filters, totals), ؋/₨ for tight inline spots (per-entry tags), "AFN"/"PKR" unchanged in English. Wired through `LedgerHome`, `CounterpartyLedgerDetail`, `InventoryHome` (including the `CurrencySelector` sub-component), `PricesHome`.

### 6. Currency filter added to Inventory and Prices
- [x] Both now have the same AFN/PKR/Both `SegmentedControl` the ledger detail view already had, filtering the transaction list / recent-price-activity list respectively.
- [x] Found in the process: `prices.currency` already existed in the DB (`001_initial_schema.sql`, defaults to `'AFN'`) but the client never selected or used it — the price screen was silently assuming everything was AFN. Now selects and displays it for real.

### 7. Phone numbers normalized to +93XXXXXXXXX everywhere
- [x] New `lib/phone.ts` (`normalizeAfghanPhone`) — handles `+93`, `0093`, a local leading `0`, or a bare 9-digit number, always saved as `+93XXXXXXXXX`.
- [x] Applied at every phone/WhatsApp entry point: login (via `phoneToSyntheticEmail`), `RequestAccessScreen`, ledger contact add (`LedgerHome`) and edit (`CounterpartyLedgerDetail`), inventory transaction party fields (`InventoryHome`), shop WhatsApp number (`ShopProfileScreen`).
- [x] **Real pre-existing bug this fixes**: `phoneToSyntheticEmail` only stripped non-digits, so `+93793111222` vs `0793111222` vs `793111222` produced three *different* synthetic login emails for the same number — someone could register with one format and be unable to log in typing another. Normalizing before that digit-strip (both client-side and mirrored in `admin-approve-account`) makes the digits stable regardless of how the number was typed.

---

## To run before deploying this round
- [ ] No new migrations — this round is app-code + one Edge Function change only.
- [ ] **Redeploy 1 Edge Function**: `admin-approve-account` (phone normalization mirror + now stores `profiles.phone_number` normalized).
- [ ] `npm install` in both `/` and `/admin-panel` (package.json changed: `jspdf` removed, `html-to-image` added).
- [ ] Test offline: force airplane mode with an existing session already saved, reopen the PWA — should reach the app shell instead of hanging on the loading screen.
- [ ] Test a receipt Download and a WhatsApp share on both a desktop browser (should fall back to the wa.me text link) and a phone (should offer the actual image via the share sheet where supported).
- [ ] Test logging in with a phone number typed differently than it was during registration (with/without `+93`, with/without leading `0`) — should now succeed either way.

---

## 23. Bug-fix round — totals, averaging, transaction-type defaults, offline data loading

### 1 & 7. Transport/porter fees not included in the transaction total
- [x] Found in the per-transaction list row: the "Total" line was `quantity × unit_cost`, dropping `transport_cost`/`porter_fee` entirely (the receipt's total already included them from the previous round — this was the other total, shown inline in the transaction list itself). Now `quantity × unit_cost + transport_cost + porter_fee`.

### 2, 3 & 4. Wrong average cost for manually-added commodities / first-entry type / no default selection
- [x] Root cause: the avg-cost trigger (`013_inventory_transaction_edit.sql`) only folds cost into `avg_cost_per_unit` on a `'purchase'` row — a `sale`/`adjustment` only changes quantity. If a brand-new commodity's *first-ever* transaction isn't a purchase (easy to do, since the type dropdown defaulted to "purchase" but was freely changeable), those units get averaged in at zero cost and permanently skew the average for every purchase after it.
- [x] Fixed at the UI level (as asked): a commodity with no transaction history at all now only offers "Purchase" — the other two options aren't rendered. Any commodity that already has history now opens its Add Transaction form with the type left **unselected** (a disabled placeholder option), so a type must always be chosen deliberately rather than trusting a default. Submitting without choosing one now shows a validation message instead of silently defaulting.
- [x] Also resets every add-transaction field (not just the type) when switching which item's form is open, so a stale value from a previous item's form can no longer leak into a different item's entry by accident.
- [x] Not done: no retroactive fix for existing commodities whose average is already skewed from a bad first entry — that needs a decision on how to treat the historical data (zero it out? backfill a synthetic purchase?) rather than a code change.

### 5. Given/Received in Pashto & Dari
- [x] `ledger.given` → "بردګي", `ledger.received` → "رسيد" in both `ps.json` and `da.json`.

### 6. Offline: past the loading screen, but nothing loads (placeholder UI only)
- [x] Two stacked causes, both fixed:
  - Every screen's initial data load called `supabase.auth.getUser()` just to get the profile id — `getUser()` always forces a network round-trip to revalidate the token server-side (unlike `getSession()`), so offline it never resolved and `profileId` stayed `null` forever, meaning every query gated on it never even ran. New `lib/authSession.ts` (`getOfflineSafeSession()` / `getCurrentUserId()`, sharing the same timeout+cached-session-fallback logic `useAuth.ts` already used) replaces `getUser()` everywhere it was only used for reads: `LedgerHome`, `CounterpartyLedgerDetail`, `InventoryHome`, `shopProfile.ts`, `SubscriptionScreen`. Left untouched in the genuine write/re-auth flows (`ChangePasswordScreen`, `ShopProfileScreen`'s save, the Settle Account re-auth) — those should keep requiring a live connection.
  - Even with profileId resolved, the actual list queries (`counterparties`, `ledger_entries`, `inventory_items`, `inventory_transactions`, `commodities`, `profiles`) still fail outright offline, and the existing error handling just set the list to `[]` — indistinguishable from "you have no data yet." New `cachedQuery()` in `offlineQueue.ts` (bumped the IndexedDB schema to add a `readCache` store) wraps every one of those load queries: a successful fetch is remembered locally, keyed by table + profile/commodity id; a failed one now serves the last-remembered result instead of an empty list.
- [x] Not done: this covers every screen's primary list-load queries but not literally every read in the app (e.g. a couple of on-demand lookups inside action handlers) — those still require a live connection when first exercised offline, same as before.

---

## To run before deploying this round
- [ ] No migrations or Edge Function changes this round — app code only.
- [ ] Test: create a brand-new commodity, confirm its Add Transaction form only offers "Purchase" until a first transaction exists, then confirm a normal item's form opens with no type pre-selected.
- [ ] Test: a purchase with both transport cost and porter fee set — confirm the transaction list's "Total" line includes both.
- [ ] Test offline: with a session already saved, force airplane mode, reopen a Ledger contact / Inventory / Prices screen that was previously loaded online at least once — should show the last-synced data instead of empty lists.

---

## 24. Offline data loading — the real fix (screens hung on placeholders even with a populated cache)

Round 23 fixed the `getUser()` blocker and added a read-through cache, but screens were still stuck on their loading skeletons offline instead of falling back to cache — screenshots showed empty "کاته" (contacts) and recent-entries sections indefinitely on a device that had real synced data.

- [x] Root cause: `cachedQuery()` itself had no timeout on the live query it wraps — Supabase's query client (postgrest-js) uses plain `fetch()` with no built-in timeout, the same underlying issue as the `getSession()`-hangs-offline bug from round 22, just for table reads instead of auth. So `cachedQuery` would `await run()` and simply never get past it offline, meaning its cache-fallback code never ran at all — not a bug in the cache, a bug in never reaching it.
- [x] Fixed: `cachedQuery()` now skips the network attempt entirely when `navigator.onLine` is false, and otherwise races the query against a 4s timeout — either way, if a live answer doesn't arrive quickly, it falls straight to the cached result (or empty, if nothing's cached yet).
- [x] Found two more unwrapped reads with the same exposure while auditing this: `PricesHome.tsx` (`markets` + the recent-prices query — this file was missed entirely in round 22's pass) and `LedgerHome.tsx`'s `loadInventoryValue()`. Both now go through `cachedQuery()`.
- [x] Also cleaned up a stale `vite.config.ts` comment/exclusion left over from the jsPDF-era workbox config (round 22 removed jsPDF in favor of html-to-image; the `globIgnores` for jspdf/html2canvas/purify chunks no longer matched anything, just dead config with a misleading comment).
- [ ] Not done: `useSubscriptionStatus.ts`'s query was also wrapped for consistency, but note `hasAccess` isn't actually wired up to block any write action anywhere yet (checked — it only feeds the renewal banner today), so this was a defensive fix, not something that was visibly broken.

---

## To run before deploying this round
- [ ] App code only, no migrations/Edge Functions.
- [ ] Test offline on a device that has previously loaded Ledger/Inventory/Prices at least once online: those screens should now show the last-synced data within ~4 seconds instead of hanging on loading placeholders indefinitely.

---

## 25. Offline writes to Inventory looked like they didn't save

Reported with screenshots: reading now works offline (round 24 fixed that), but adding a new inventory transaction offline didn't seem to do anything — the item's quantity/avg cost/total on screen stayed exactly the same after saving.

- [x] Root cause: after queuing a transaction, `handleAddTransaction` called `loadItems()` to refresh the item's aggregate figures. But those figures (`quantity`, `avg_cost_per_unit`, `total_cost`) are only correct once Postgres's `recompute_inventory_item()` trigger runs server-side on the synced row — which hasn't happened yet for a transaction that's still sitting in the local offline queue. Offline, `loadItems()` just re-served the cached pre-transaction values (via `cachedQuery`'s fallback), so the item visually looked completely unchanged even though the transaction itself really had been queued and would sync once back online.
- [x] Fixed: `handleAddTransaction` now optimistically applies the trigger's exact math client-side (new `applyOptimisticTransaction`, mirroring `recompute_inventory_item()` from migration 013 line for line) to update the item's quantity/avg cost/total immediately, instead of reloading. This is a one-step approximation, not a replacement for the trigger — so:
- [x] Added a `saudagar:synced` event, dispatched from `flushQueue()` whenever a queued write actually reaches the server. `InventoryHome`, `LedgerHome`, and `CounterpartyLedgerDetail` all listen for it and reload for real at that point, replacing the optimistic estimate with the server's authoritative numbers. (Ledger's own optimistic updates were already correct — balances are simple sums, no server trigger involved — but it listens too, mainly so `loadInventoryValue()`, which *does* depend on the same trigger, self-corrects.)
- [x] Also hardened the "first entry must be a purchase" check (round 23) — it was cross-referencing the separately-loaded `allTransactions` list, which could plausibly be empty/uncached independently of the item list itself and (incorrectly) lock an item with real history down to purchase-only. Now checks the item's own `quantity`/`avg_cost_per_unit` directly, which is always available whenever the item card itself is showing.
- [x] Along the way, found and fixed ~12 error messages across Ledger/Inventory/Subscription/RequestAccess that were hardcoded in English regardless of the app's language setting (e.g. the "Couldn't load entries." seen untranslated in the screenshots) — all now go through `tr()` with proper Pashto/Dari copy.

---

## To run before deploying this round
- [ ] App code only.
- [ ] Test: add a purchase to an existing item while offline — quantity/avg cost/total should update immediately on screen. Go back online and wait ~30s (or trigger a reload) — the same figures should very briefly recompute from the server and match exactly (no visible jump if the estimate was right, which it should be for a single offline transaction).
- [ ] Test: a brand-new commodity with zero history should still only offer "Purchase" as the transaction type, even when that check is exercised offline.

---

## 26. Offline writes hung on flaky/fake-connected networks (root cause of round 25's own workaround) + a missed i18n key + Settle Account clarified

### 1. Save button unresponsive offline, duplicate entries, nothing shows until an online write happens
- [x] **Root cause, finally found:** round 25 (and earlier) had `enqueueWrite()` `await flushQueue()` — awaiting the actual network sync attempt — so the UI's synced/pending indicator could update without a page reload. But `flushQueue()`'s `supabase.from(...).upsert(...)` call had no timeout (same missing-timeout pattern as every other hang in this app, just never caught here before), and it was awaited *before* every caller's optimistic UI update. On a genuinely-offline device this was masked by the `navigator.onLine` check short-circuiting `flushQueue()` — but on a *flaky or falsely-"connected"* one (Wi-Fi with no real internet, weak signal — `navigator.onLine` stays `true`), the upsert just hung, blocking the Save button indefinitely. Each repeated tap queued its own write (silently, since the IndexedDB part always worked) but never rendered, so entries only became visible once a real connection let the pile-up finally flush — exactly the reported behavior, and identical in both Ledger and Inventory since both go through the same `enqueueWrite`.
- [x] Fixed: `enqueueWrite()` no longer awaits the sync attempt — it resolves as soon as the local IndexedDB write lands, and kicks off `flushQueue()` in the background. The "update without a reload" goal from round 25 is now handled entirely by the `saudagar:synced` event instead of blocking the caller.
- [x] Also gave `flushQueue()`'s per-item upsert its own timeout (8s) so one stuck item can't hold up the rest of the queue or the periodic/online-triggered retry either.
- [x] Belt-and-suspenders: added an explicit `submitting` guard + disabled state on all three Save buttons (ledger quick-entry, ledger contact-detail entry, inventory transaction) so a double-tap can never queue a duplicate regardless of network speed.

### 2. "+ Add Entry" given/received toggle still showing the old wording
- [x] Found the actual cause: the toggle uses separate `ledger.givenRadio`/`ledger.receivedRadio` keys, distinct from the `ledger.given`/`ledger.received` fixed in round 23 — missed because they're a different key pair, not the same string reused. Both now say بردګي/رسيد in Pashto and Dari, matching the summary card.

### 3. Settle Account — how does it scope by currency?
- [x] Clarified, not changed (no bug, just documenting the actual behavior since it wasn't obvious from the UI): Settle Account deletes **every** ledger entry for that contact, in **both** AFN and PKR, regardless of which currency filter (AFN/PKR/Both) is currently selected on screen — the filter is purely a display toggle and was never wired into the delete query. Flagging this because it could surprise someone who has the "AFN" filter selected and assumes Settle Account only touches what's currently showing. Worth a product decision on whether that's actually wanted, or whether it should respect the active filter — happy to make it filter-aware if that's the intent.

---

## To run before deploying this round
- [ ] App code only.
- [ ] Test offline (and, if reproducible, on Wi-Fi with no real internet — the flaky case, not just airplane mode): add several ledger entries and inventory transactions quickly. Confirm each appears immediately, Save never hangs, and no duplicates appear even after tapping fast.
- [ ] Test the given/received wording in the "+ Add Entry" toggle specifically (not just the summary card) in Pashto and Dari.

---

## 27. Settle Account scoping, itemized WhatsApp statement, About/Terms/Privacy

### 1. Settle Account now respects the AFN/PKR/Both filter
- [x] Previously always deleted every entry for the contact in both currencies regardless of which filter was active. Now: "Both" behaves as before; "AFN" or "PKR" only deletes that currency's entries, leaving the other currency's balance untouched. The button and modal title now show the scope explicitly ("Settle Account (AFN)") when a single currency is selected, and the button only appears when there's something to settle in the currently filtered view.

### 2 & 3. Weekly/monthly/annual reports, and data backup/audit trail for edit disputes
- Not implemented this round — see the reply for a proposed design on both; both are substantial enough (new screens/tables) to want a go-ahead before building.

### 4. WhatsApp account statement is now itemized, not just a totals line
- [x] Rebuilt `whatsappText` for the account statement to match the requested format: a header line, then one line per entry in chronological order (`date — given/received: ±amount؋ (balance: running_total؋)`), then a current-balance footer and a confirmation line. Uses the app's already-established بردګي/رسيد wording (rather than the "پور"/"تادیه شوی" wording in the example) for consistency with the rest of the app, and the AFN/PKR symbol (؋/₨) inline per amount. Multi-currency contacts get one block per currency. New i18n keys: `receipt.summaryFor`, `receipt.remainingInline`, `receipt.currentBalance`, `receipt.pleaseConfirm`.

### 5. About Us / Terms of Use / Privacy Policy
- [x] Added as three new pages under a "Legal" section in Settings (`/legal/about`, `/legal/terms`, `/legal/privacy`), fully localized in English/Pashto/Dari. First-draft content, not legal-reviewed — Terms folds in the existing subscription/pricing terms from `content/policies/terms.*.md` (those files are otherwise unused/unwired into the app) plus general account/data/dispute language; Privacy covers what's collected, where it's stored (Supabase + on-device for offline), who can see it, and how to request changes. Flagged in code comments as needing real review before it carries legal weight — same caveat the existing `.md` drafts already had for their Dari/Pashto translations.
- [ ] Not done: these pages are only reachable after logging in (Settings → Legal). The app doesn't currently route anything pre-login — `LoginScreen`/`RequestAccessScreen` are shown by a plain state check, not by react-router — so surfacing Terms/Privacy on the login screen itself would need a small routing change; flagged as a possible follow-up, not built this round.

---

## To run before deploying this round
- [ ] App code only.
- [ ] Test Settle Account with the AFN filter active on a contact that has both AFN and PKR entries — confirm only AFN entries are removed and PKR balance is unaffected.
- [ ] Test the WhatsApp share on an account statement — confirm the shared text lists every entry with a running balance, not just the total.

---

## 28. Secretary logins (real permission enforcement) + Reports (ledger + inventory)

### Secretary accounts
- [x] New migration `020_shop_secretaries.sql`: `shop_secretaries` table linking a secretary's own auth login to the owner's `profiles.id`, plus `current_shop_profile_id()` — a SQL helper resolving "whose shop data should this login see" for both an owner and an active secretary.
- [x] Every table's **read/insert** RLS policies (`ledger_entries`, `inventory_items`, `inventory_transactions`, `counterparties`, `commodities`, `profiles`, `subscriptions`, `manual_payment_requests`, payment-proofs storage) now allow owner-or-secretary. Every **update/delete** policy is untouched — they already keyed off `auth.uid() = profile_id`, which only the owner's own auth id ever satisfies, so edit/delete stays owner-only with zero risk of a mistake in the rewrite. **This is the actual enforcement mechanism** — Postgres rejects a secretary's edit/delete attempt regardless of what the app's UI does or doesn't show.
- [x] Two new Edge Functions (need the service role key, so can't be plain client inserts): `secretary-create` (owner creates a login, gets a one-time temp password back to relay) and `secretary-reset-password` (owner resets one). Both verify the caller actually owns that secretary/is an owner first. Revoking is a plain `shop_secretaries.status` update — no need to separately disable the auth login, since `current_shop_profile_id()` stops resolving for a revoked secretary and every policy denies them from there.
- [x] New `getShopContext()` in `lib/authSession.ts` — resolves `{ shopProfileId, role, secretaryName }`, offline-safe like everything else. Replaces the old `getCurrentUserId()`-as-`profileId` pattern everywhere that pattern assumed "my auth id IS the shop's data scope," which stops being true for a secretary: `LedgerHome`, `CounterpartyLedgerDetail`, `InventoryHome`, `shopProfile.ts`, `SubscriptionScreen`, `SettingsScreen`, `App.tsx` (subscription status / renewal banner), and the `create-payment-session` Edge Function (which had the identical bug — it stamped a payment session with the caller's own id rather than the shop's, which would have silently broken subscription payment for any secretary who tried to pay the bill).
- [x] UI gating added on top of the RLS enforcement (belt-and-suspenders — the button shouldn't be visible if it would just fail): edit contact, edit ledger entry, Settle Account, edit inventory transaction, and the Shop Profile save button are all hidden/disabled for a secretary login. Settings shows a small "you're signed in as {name}, a secretary" notice and hides the "Secretaries" management entry point.
- [x] New `ManageSecretariesScreen.tsx` (Settings → Secretaries, owner-only): add a secretary (name + phone → temp password shown once), see active/revoked status, reset a secretary's password, revoke/reactivate.
- [x] Fixed along the way: `ChangePasswordScreen.tsx` assumed every login has a `profiles` row to read a phone number from for re-auth — a secretary doesn't, so this would have permanently locked a secretary out of ever changing their own password. Now falls back to their `shop_secretaries` row.
- [ ] Not done / follow-ups worth knowing about:
  - No permission granularity beyond binary owner/secretary (e.g. "can edit but not delete," "can edit only same-day entries") — this was scoped as real, simple prevention per the stated ask, not a full permission matrix. Straightforward to add later as more boolean columns on `shop_secretaries` plus matching RLS conditions if wanted.
  - This migration has been carefully cross-checked against the existing schema (every dropped policy name verified to match exactly) but **has not been run against a live database** — recommend applying it to a staging/dev Supabase project first, same as any migration.
  - A secretary's own name isn't shown anywhere in the audit trail sense (i.e. this round doesn't add "edited by X" history) — that's the separate audit-trail idea from the previous round's conversation, not built this round; real prevention was prioritized over visibility-after-the-fact per your choice.

### Reports (ledger + inventory)
- [x] New `/reports` screen, added as a 5th bottom-nav tab. Week/Month/Year toggle (calendar-aligned — Monday-start week, 1st-of-month, Jan 1 — not a rolling window). Ledger section: given/received/net per currency (AFN/PKR shown separately, whichever have activity), most-active contacts. Inventory section: purchase value/sale value/net (AFN-equivalent, matching the existing avg-cost basis), most-active commodities by quantity.
- [x] Computed entirely client-side from the same cached ledger/inventory data every other screen already uses (via `cachedQuery`), so it works offline too and doesn't need any new backend aggregation.
- [ ] Not done: no export (PDF/image/WhatsApp share) of a report — flagged as a natural next step if wanted, following the same pattern as the receipt image work from earlier rounds.

---

## To run before deploying this round
- [ ] **Run migration `020_shop_secretaries.sql`** against the database (staging first, recommended) — this round doesn't work at all without it (every screen using `getShopContext()` needs `shop_secretaries` and `current_shop_profile_id()` to exist).
- [ ] **Deploy 2 new Edge Functions**: `secretary-create`, `secretary-reset-password`.
- [ ] **Redeploy 1 changed Edge Function**: `create-payment-session` (shop-profile-id resolution fix).
- [ ] Test: create a secretary from Settings → Secretaries, log in as them (phone + temp password, same login screen), confirm they can add ledger entries and inventory transactions, and confirm edit/delete/Settle Account/Shop Profile save are all hidden for them AND rejected server-side if attempted directly.
- [ ] Test: revoke a secretary, confirm their next login/request returns empty/denied everywhere.
- [ ] Test: a secretary can change their own password from Settings.
- [ ] Test the Reports screen's three periods against a shop with real ledger + inventory history, in both languages.
