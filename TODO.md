# Saudagar — Build TODO

Status as of this document: schema written, HesabPay Edge Functions written
(field names confirmed against HesabPay's Get Started docs; webhook payload
shape and signature method still unconfirmed), repo skeleton scaffolded.
Nothing deployed yet.

---

## 0. Naming / housekeeping
- [ ] Confirm final app name usage across Play Store listing, package ID, domain
- [ ] Register package ID (e.g. `com.saudagar.trading` or similar) — must be globally unique regardless of app name conflicts elsewhere

---

## 1. Supabase project setup
- [ ] Create the Supabase project
- [ ] Run `supabase/migrations/001_initial_schema.sql`
- [ ] Run `supabase/migrations/002_payment_sessions.sql`
- [ ] Confirm Row Level Security is enabled on all tables that need it (already written into the migrations — verify in the dashboard after running)
- [ ] Seed at least one row in `markets` (your launch city) and a handful of `commodities` (start with 2–3, e.g. wheat + one fertilizer, per the phased price-feed decision)
- [ ] Set up the Supabase CLI locally (`supabase login`, `supabase link`) so future schema changes go through migrations, not ad-hoc dashboard SQL

---

## 2. HesabPay integration — close the remaining gaps
- [ ] Deploy `create-payment-session` and `hesabpay-webhook` Edge Functions (`supabase functions deploy ...`)
- [ ] Set `HESABPAY_API_KEY` as a Supabase secret
- [ ] Register the webhook endpoint URL on HesabPay's dashboard (the screen you already found), select both **Payment Success** and **Payment Failure** events
- [ ] Capture and store the signing secret HesabPay shows (if any) as `HESABPAY_WEBHOOK_SECRET`
- [ ] Fetch the actual **Webhooks** documentation page (sidebar link, not yet pulled) for the authoritative payload schema + signature method — replace the guessed logic in `hesabpay-webhook/index.ts`
- [ ] Run one real test transaction; log the raw webhook payload and headers; update the field-matching logic in `hesabpay-webhook/index.ts` accordingly
- [ ] Ask HesabPay support whether a sandbox/test mode exists, so you're not debugging with real AFN
- [ ] Confirm whether `create-session`'s `email` field is required in practice even though docs mark it optional (test with and without)

---

## 3. Auth & onboarding
- [ ] Decide phone-auth mechanism (Supabase phone auth + SMS provider, or a custom flow given you're doing manual verification anyway — since verification is manual, you may not need OTP-based auth at all yet, just phone-number + admin-created login)
- [ ] Build the actual login screen (currently stubbed out as always-logged-out in `App.tsx`)
- [ ] Wire `RequestAccessScreen.tsx` fully — currently writes to `account_requests` but has no market picker (defaults will be wrong until this exists)
- [ ] Decide and build the notification path for "a new request came in" (manual check of the admin panel vs. some ping to you — given you're avoiding WhatsApp Cloud API spend, this is probably just you checking the admin panel periodically at this scale)

---

## 4. Admin panel (separate app, not yet scaffolded)
- [ ] Scaffold a second lightweight app (`admin-panel/` folder exists, empty)
- [ ] Build the account-request queue screen (approve/decline, gated by `admin_users.can_approve_accounts`)
- [ ] Build the price-upload screen (market + commodity picker, gated by `admin_users.allowed_markets`)
- [ ] Approval action must: create the `auth.users` entry, create the matching `profiles` row, flip `account_requests.status` to `approved`
- [ ] Decide how your hired price-uploader logs in — likely simplest as a manually-created `admin_users` row with `allowed_markets` scoped to their assigned city only

---

## 5. Core app screens (in priority order — ledger first, since it's the paid core)
- [ ] **Ledger**: real data hook reading from IndexedDB first, reconciling with Supabase; balance summary; given/received cards; recent entries list; "+ New Entry" wired to `enqueueWrite`; per-entry synced/pending indicator (per `getSyncStatus`)
- [ ] **Counterparty management**: add/edit a contact by name + phone number (feeds `counterparties` table)
- [ ] **Inventory**: item list with quantity + cost basis; purchase/sale transaction entry wired to `enqueueWrite`; today's price shown against each item (the "price against their own stock" differentiator)
- [ ] **Prices**: read-only list grouped by market, filterable/switchable even though only one market is live at launch
- [ ] **Subscription status display**: current tier + expiry pulled from `subscriptions`, and the read-only-mode banner (`subscription.expired` string already in i18n) shown once lapsed
- [ ] **i18n wiring**: `BottomNav.tsx` and all screens currently show raw i18n *keys*, not translated text — build the `t()` lookup helper reading the active language from `LanguageContext` and swap every hardcoded label
- [ ] **Language/format settings screen**: language switch (en/ps/da) + digit-style toggle (Western default / Eastern Arabic-Indic) + thousand-separator toggle (on by default)
- [ ] **WhatsApp export button**: "send today's entries" via `wa.me` link, discussed earlier as a lightweight backup/reassurance feature — cheap to build, worth including early

---

## 6. Offline sync — finish the skeleton
- [ ] Fill in the actual `payload` shapes passed to `enqueueWrite` from the ledger and inventory screens (the queue mechanics in `offlineQueue.ts` are complete; only the call sites are stubbed)
- [ ] Test the reconnect flow explicitly: go offline, log several entries, go back online, confirm they sync and the pending indicators flip to synced
- [ ] Test the retried-write idempotency: force a sync failure, retry, confirm no duplicate rows appear (relies on the `unique(profile_id, client_id)` constraint already in the schema)
- [ ] Decide whether the 30-second periodic retry interval in `initSyncListeners()` is right for your users' typical connectivity, or needs tuning

---

## 7. PWA polish
- [ ] Generate real app icons (192px, 512px) — `vite.config.ts` currently points at placeholder paths under `/public/icons/`
- [ ] Test "Add to Home Screen" flow on actual Android devices your target users have (not just desktop Chrome)
- [ ] Confirm the service worker's offline app-shell caching doesn't fight with the offline data queue (they're separate layers — verify no confusing double-offline-handling bugs)

---

## 8. Pricing & policy content
- [ ] Write the full refund/cancellation policy text (needs the "no partial refunds, access continues until period end" line agreed on earlier)
- [ ] Write and get natively translated (not machine-translated) the dispute/record-keeping clause drafted earlier, for all 3 languages
- [ ] Decide where these live in the app (a Terms/Policy screen, linked from settings)

---

## 9. Data safety
- [ ] Upgrade Supabase from Free to Pro plan once you have paying users, for daily backups (not before — no need to pay for backups on an empty database)
- [ ] Confirm RLS is actually blocking writes correctly once subscriptions exist to test against — write a real expired-subscription test case, not just a code review

---

## 10. Pre-launch
- [ ] Hire/confirm the price-uploader; walk them through the admin panel price-upload screen
- [ ] Manually onboard the first handful of shops yourself (per the request-access + personal-approval flow) rather than opening broadly
- [ ] Decide the actual free-trial mechanics: is it enforced as a `subscriptions` row with a `trial` tier and 30-day expiry, or a flag on `profiles`? (Not yet modeled in the schema — needs a small addition before launch)
- [ ] Sanity-check the whole subscribe → HesabPay checkout → webhook → active subscription flow end-to-end with a real (small) transaction before opening to real users

---

## Known open items carried over from earlier discussion (not yet decided)
- [ ] Exact renewal-reminder trigger logic for the in-app banner (how many days before expiry does it start showing?)
- [ ] Whether `email` should be collected at signup at all, given HesabPay's create-session accepts it as optional — decide if there's another reason to collect it (e.g. receipts)
