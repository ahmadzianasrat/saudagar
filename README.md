# Saudagar

Ledger, inventory, and multi-market price tracking for grain, cotton, and
fertilizer traders — built PWA-first (React + Vite + Supabase), designed
to migrate to React Native later without a schema rewrite.

## Structure

- `src/lib/supabaseClient.ts` — Supabase client singleton
- `src/lib/offlineQueue.ts` — offline-first write queue (IndexedDB → sync to Supabase)
- `src/contexts/LanguageContext.tsx` — 3-language + digit-style/separator preferences (local only)
- `src/i18n/*.json` — translation strings (en, ps, da)
- `src/features/*` — one folder per screen area (ledger, inventory, prices, subscription, profile)
- `supabase/migrations/*.sql` — run in order against your Supabase project
- `supabase/functions/*` — Edge Functions (HesabPay payment session + webhook)
- `admin-panel/` — separate lightweight app for account approval + price uploads (not yet scaffolded)

## Setup

1. `cp .env.example .env` and fill in your Supabase project URL/anon key
2. Run the SQL files in `supabase/migrations/` against your Supabase project, in order
3. `supabase secrets set HESABPAY_API_KEY=...` (and `HESABPAY_WEBHOOK_SECRET` once you have it)
4. `supabase functions deploy create-payment-session`
5. `supabase functions deploy hesabpay-webhook`
6. Register the webhook URL on HesabPay's developer dashboard
7. `npm install && npm run dev`

See `TODO.md` for the full step-by-step build plan.
