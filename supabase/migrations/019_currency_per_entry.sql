-- ============================================================
-- Revises the Phase 3 currency design based on real feedback: a
-- single customer often owes money in BOTH AFN and PKR (not one
-- contact per currency, as migration 018 assumed). Currency now
-- lives entirely on the ledger entry, chosen explicitly by the user
-- each time — never inherited or defaulted, so a mis-click can't
-- silently record 5,000 of the wrong currency.
--
-- This means:
--   - counterparties no longer carry a currency at all
--   - the trigger that force-inherited an entry's currency from its
--     counterparty is removed — currency is now the app's explicit
--     choice, not a derived value
--   - ledger_entries.currency loses its DEFAULT 'AFN' — every insert
--     MUST specify a currency explicitly, or it fails loudly (NOT
--     NULL, no default) rather than silently guessing AFN
-- ============================================================

drop trigger if exists lock_ledger_entry_currency on public.ledger_entries;
drop function if exists public.lock_ledger_entry_currency();

alter table public.counterparties
  drop column if exists currency;

alter table public.ledger_entries
  alter column currency drop default;
