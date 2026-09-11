# Saudagar — Project Overview

## What this is

Saudagar is a mobile-first web app (PWA) for grain, cotton, and fertilizer
traders in Afghanistan — starting with a single launch market/city, built
by a nurse-turned-developer (Ahmad Zia) also running a fabrics business
(Raihan Fabrics) on similar architecture.

It combines three things that existing regional apps (Khatabook, OkCredit,
Zarai Mandi, etc.) each do separately, but none do together:

1. **A credit ledger** (khata-book) — per-customer running balances,
   identified by name + mobile + WhatsApp + address, not just a name.
2. **Inventory tracking** with true landed cost (purchase price + transport
   + porter/worker fees folded into average cost per unit), shown against
   live market prices so a trader can see margin at a glance.
3. **A market price feed**, uploaded by hired staff through a separate
   admin panel, covering multiple markets/commodities from day one even
   though only one market is live at launch.

The pitch: a shop owner can see "I have 500kg of wheat, it cost me X to
acquire, and it's worth Y at today's market price" in one screen — no
competing app does the ledger + inventory + live-price combination.

## Target users & business model

- Small-to-mid grain/cotton/fertilizer traders, one city at launch
  (Lashkar Gah), Pashto-default with Dari and English also supported.
- **Pricing**: 250 AFN/month, or 1,250 AFN/6 months (~17% savings), with a
  30-day free trial granted automatically on account approval.
- **Two payment paths**: HesabPay (Afghan payment gateway, real online
  checkout) OR a manual-payment claim (cash-in-hand or mobile top-up, with
  an optional screenshot as proof) reviewed and approved by an admin.
- **Onboarding is manual, not self-serve**: a shop owner requests access
  in-app, an admin (the founder, or staff they create) reviews and
  approves via the admin panel, which auto-generates a login password
  relayed manually over WhatsApp — deliberately avoiding SMS/OTP costs
  and infrastructure at this stage.

## Full feature list

**Consumer app** (PWA, React + Vite + TypeScript, deployed on Vercel):
- Ledger: per-customer contact list with individual balances, quick-entry
  from the main page OR from a contact's own page, editable entries,
  paginated (10/page) combined activity table, date-grouped ("Today" /
  "Yesterday" / older) with relative "time ago" display
- Inventory: per-commodity stock with quantity + true average cost vs.
  live market price, purchase/sale/adjustment transactions (adjustments
  support signed +/- corrections for recounts/spoilage), optional
  transport cost + porter fee on both purchases AND sales (sale-side
  costs are recorded but do NOT affect the item's average acquisition
  cost — that only reflects purchase-side landed cost), editable
  transactions, paginated + date-grouped history table
- Prices: recent-activity feed (last 10 uploads across all commodities
  for the selected market), multi-market-ready
- Subscription: HesabPay checkout OR manual-payment claim submission,
  live status display, renewal-reminder banner (5 days before expiry),
  read-only mode after expiry (view-only, no new entries, enforced at
  the database level via RLS — not just hidden in the UI)
- Settings: language (Pashto/Dari/English), digit style (Western or
  Eastern Arabic-Indic numerals), thousand-separator toggle, date system
  (Gregorian or Shamsi/Solar Hijri), change password
- Currency converter: AFN ↔ USD ↔ PKR with user-editable rates (no live
  rate feed — deliberately out of scope for now)
- Offline-first: every write goes to IndexedDB first, then attempts an
  immediate sync with a visible per-entry synced/pending indicator;
  retries on reconnect and periodically while the app is open

**Admin panel** (separate Vite app, separate Vercel deployment):
- Account Requests — approve/decline pending signups, auto-generates and
  displays the new shop owner's login password with a one-tap WhatsApp
  send link
- Manual Payments — review payment claims (with proof screenshot if
  attached via signed Storage URL), approve (creates a real subscription)
  or reject
- Upload Prices — market + commodity price entry, scoped to an admin's
  assigned markets (or ALL markets automatically for a super admin)
- Users — search shop accounts, reset a forgotten password (generates a
  new one, relay via WhatsApp — there's no email-based reset since login
  uses a synthetic, unreachable email address)
- Admins (super_admin only) — create new staff admins, toggle their
  approval permission and market assignments, deactivate/reactivate them
- A super admin automatically has full authority everywhere (every
  market, every approval permission) without needing manual assignment
  as new markets get added — enforced at the RLS level, not just the UI

## Tech stack

- **Frontend**: React + Vite + TypeScript, plain inline styles (no CSS
  framework), React Router
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **Payments**: HesabPay (session-based checkout + webhook confirmation)
- **Hosting**: Vercel — two separate projects from the same GitHub repo
  (root directory `.` for the main app, `admin-panel` for the admin tool)
- **Offline storage**: IndexedDB via the `idb` library
- **Date conversion**: `jalaali-js` for Gregorian↔Shamsi conversion
  (hand-rolling this was deliberately avoided — genuine leap-year
  edge-case risk)

## Key architectural decisions worth knowing

- **Auth has no real email or SMS involved.** Shop owners log in with
  phone number + admin-issued password; under the hood this maps to a
  synthetic email (`<digits>@saudagar.local`). Admins use ordinary
  email/password. Password resets are always admin-mediated, relayed via
  WhatsApp — there is no self-serve "forgot password" email flow, and
  can't be, since the email isn't real.
- **The subscription paywall is enforced by Postgres RLS**, not just
  hidden UI — even a modified client can't write past an expired
  subscription. Read access stays open regardless (view-only, not
  locked out) per an explicit design decision.
- **Inventory's average cost recalculates from full transaction history**
  on every insert/update/delete (a Postgres trigger), not incrementally —
  this was specifically needed so that editing a past transaction doesn't
  desync the item's totals.
- **A recurring bug pattern throughout this build**: several tables had
  Row Level Security enabled (often via Supabase's dashboard advisor
  nagging about it) with no policy ever added, which silently blocks
  ALL access rather than erroring clearly. If something mysteriously
  stops working with no visible error, checking for this is the first
  thing to try.

## What's confirmed working vs. still unverified

**Confirmed end-to-end**: account request → admin approval → login;
HesabPay session creation (redirects to a real checkout page); manual
payment claim → admin approval → active subscription; ledger and
inventory CRUD including edits; offline sync (fixed this session, not
yet device-tested).

**Not yet tested**: a full HesabPay payment completed through to the
webhook confirming and activating a subscription (only session creation
has been verified) — this is the single most important remaining test
before relying on the HesabPay path with real users. Real-device offline
behavior (airplane-mode test) also hasn't been done yet.

## Where to go for granular status

`TODO.md` in the repo root has the full, chronological build log —
every fix, every migration, every open item, in the order they came up.
This document is the stable "what is it" reference; `TODO.md` is the
living task list.
