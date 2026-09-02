-- ============================================================
-- SAUDAGAR — Database Schema (Supabase / Postgres)
-- ============================================================
-- Notes on design decisions baked into this schema:
-- - auth.users (Supabase built-in) is the identity table, keyed by phone.
--   profiles extends it with app-specific fields.
-- - Language/number-format preference is LOCAL ONLY (device storage),
--   not stored here, per the decision to keep it simple.
-- - Every write-relevant table carries updated_at for last-write-wins
--   conflict resolution, and a client_id for offline dedup.
-- - RLS policies enforce the "read-only after expiry" paywall at the
--   database level, not just in the app UI.
-- - Tables are ordered below strictly by foreign-key dependency:
--   each table only references tables already created above it.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. MARKETS & COMMODITIES (referenced by profiles/prices, so first)
-- ------------------------------------------------------------
create table public.markets (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ps text not null,   -- Pashto
  name_da text not null,   -- Dari
  city text not null,
  country text not null default 'Afghanistan',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.commodities (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ps text not null,
  name_da text not null,
  unit text not null,          -- e.g. 'kg', 'man' (maund), '40kg bag'
  category text not null        -- 'grain', 'cotton', 'fertilizer'
    check (category in ('grain', 'cotton', 'fertilizer', 'other')),
  is_active boolean not null default true
);

-- ------------------------------------------------------------
-- 2. ADMIN USERS & PERMISSIONS (referenced by account_requests/prices)
-- ------------------------------------------------------------
create table public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone_number text not null unique,
  role text not null default 'staff' check (role in ('super_admin', 'staff')),
  can_approve_accounts boolean not null default false,
  allowed_markets uuid[] not null default '{}',  -- array of markets.id; empty = none assigned
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. PROFILES (shop owners / end users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_number text not null unique,
  owner_name text not null,
  shop_name text not null,
  market_id uuid references public.markets(id),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'declined', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.status is
  'pending = awaiting admin approval after "request access". active = approved and usable. declined/suspended = blocked.';

-- ------------------------------------------------------------
-- 4. ACCOUNT REQUESTS (the "request access" onboarding flow)
-- ------------------------------------------------------------
create table public.account_requests (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  owner_name text not null,
  shop_name text not null,
  market_id uuid references public.markets(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  reviewed_by uuid references public.admin_users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- On approval: an admin action creates the auth.users + profiles row
-- and flips this to 'approved'. Kept separate from profiles so a
-- declined/duplicate request never pollutes the main user table.

-- ------------------------------------------------------------
-- 5. PRICES (uploaded by staff, scoped by allowed_markets)
-- ------------------------------------------------------------
create table public.prices (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id),
  commodity_id uuid not null references public.commodities(id),
  price numeric(12,2) not null,
  currency text not null default 'AFN',
  price_date date not null default current_date,
  change_from_previous numeric(12,2),   -- TODO: populate via trigger comparing to previous price_date row; not yet implemented, nullable for now
  uploaded_by uuid not null references public.admin_users(id),
  created_at timestamptz not null default now(),
  unique (market_id, commodity_id, price_date)
);

-- ------------------------------------------------------------
-- 6. COUNTERPARTIES (ledger contacts, phone-number-based identity)
-- ------------------------------------------------------------
create table public.counterparties (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone_number text not null,
  -- If this phone number belongs to another Saudagar user, link it.
  -- Enables Phase 3 (two-sided ledger reconciliation) without a schema change.
  linked_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (owner_profile_id, phone_number)
);

-- ------------------------------------------------------------
-- 7. LEDGER ENTRIES
-- ------------------------------------------------------------
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,          -- generated on-device at creation time, for offline dedup
  profile_id uuid not null references public.profiles(id) on delete cascade,
  counterparty_id uuid not null references public.counterparties(id) on delete cascade,
  entry_type text not null check (entry_type in ('credit', 'debit')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'AFN',
  note text,
  entry_date timestamptz not null default now(),
  synced_at timestamptz,            -- null while pending sync; set on successful server write
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, client_id)    -- idempotent retries from the offline queue
);

-- ------------------------------------------------------------
-- 8. INVENTORY
-- ------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  commodity_id uuid not null references public.commodities(id),
  quantity numeric(12,2) not null default 0,
  avg_cost_per_unit numeric(12,2) not null default 0,   -- weighted average, recalculated per transaction
  total_cost numeric(12,2) generated always as (quantity * avg_cost_per_unit) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, commodity_id)
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  transaction_type text not null
    check (transaction_type in ('purchase', 'sale', 'adjustment')),
  quantity numeric(12,2) not null,
  unit_cost numeric(12,2),          -- null for sales/adjustments that don't affect cost basis
  note text,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  unique (inventory_item_id, client_id)
);

-- ------------------------------------------------------------
-- 9. SUBSCRIPTIONS
-- ------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tier text not null check (tier in ('monthly', 'six_month')),
  amount numeric(10,2) not null,     -- 250 or 1250 AFN at time of purchase (kept even if pricing changes later)
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  payment_reference text,            -- HesabPay transaction ref
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Convenience view: is a given profile currently within a paid window?
create view public.active_subscription as
  select profile_id, max(expires_at) as current_expiry
  from public.subscriptions
  where status = 'active'
  group by profile_id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.counterparties enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.prices enable row level security;

-- --- Profiles: users see/edit only their own row ---
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id);

-- --- Helper: is this profile's subscription currently active? ---
create or replace function public.has_active_subscription(p_profile_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.subscriptions
    where profile_id = p_profile_id
      and status = 'active'
      and expires_at > now()
  );
$$ language sql stable security definer;

-- --- Ledger entries: read always allowed for own data; ---
-- --- writes (insert/update) blocked once subscription lapses ---
create policy "read own ledger" on public.ledger_entries
  for select using (auth.uid() = profile_id);

create policy "write own ledger only if subscribed" on public.ledger_entries
  for insert with check (
    auth.uid() = profile_id and public.has_active_subscription(profile_id)
  );

create policy "update own ledger only if subscribed" on public.ledger_entries
  for update using (
    auth.uid() = profile_id and public.has_active_subscription(profile_id)
  );

-- --- Same read-always / write-if-subscribed pattern for inventory ---
create policy "read own inventory" on public.inventory_items
  for select using (auth.uid() = profile_id);

create policy "write own inventory only if subscribed" on public.inventory_items
  for insert with check (
    auth.uid() = profile_id and public.has_active_subscription(profile_id)
  );

create policy "update own inventory only if subscribed" on public.inventory_items
  for update using (
    auth.uid() = profile_id and public.has_active_subscription(profile_id)
  );

-- --- Counterparties: tied to ledger, same ownership rule, no subscription gate ---
-- (adding a contact shouldn't itself be blocked; only the entries are gated)
create policy "own counterparties" on public.counterparties
  for all using (auth.uid() = owner_profile_id);

-- --- Subscriptions: read-only for the owner, writes happen via backend/service role only ---
create policy "read own subscriptions" on public.subscriptions
  for select using (auth.uid() = profile_id);

-- --- Prices: public read for all authenticated users, writes scoped to admin's allowed_markets ---
create policy "all users read prices" on public.prices
  for select using (auth.role() = 'authenticated');

create policy "staff write prices within allowed markets" on public.prices
  for insert with check (
    exists (
      select 1 from public.admin_users au
      where au.id = auth.uid()
        and prices.market_id = any(au.allowed_markets)
    )
  );

-- ============================================================
-- INDEXES (added upfront given ledger/price tables will be the
-- most frequently queried as usage grows)
-- ============================================================
create index idx_ledger_profile_date on public.ledger_entries (profile_id, entry_date desc);
create index idx_ledger_counterparty on public.ledger_entries (counterparty_id);
create index idx_prices_market_commodity_date on public.prices (market_id, commodity_id, price_date desc);
create index idx_inventory_profile on public.inventory_items (profile_id);
create index idx_subscriptions_profile_status on public.subscriptions (profile_id, status);
