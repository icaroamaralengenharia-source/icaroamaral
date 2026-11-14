-- Local proposal only; not applied to any database.
-- Existing rows remain NULL. No backfill, uniqueness, quantity or ledger change.
alter table public.stock_full_items
  add column if not exists sku text default null;
