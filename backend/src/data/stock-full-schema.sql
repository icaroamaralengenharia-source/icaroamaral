create table if not exists public.stock_full_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  name text not null,
  unit text,
  category text,
  min_quantity numeric default 0,
  current_quantity numeric default 0,
  location text,
  notes text,
  is_active boolean default true,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.stock_full_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  item_id uuid not null,
  quantity numeric not null,
  unit_cost numeric,
  supplier text,
  invoice_number text,
  notes text,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.stock_full_exits (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  item_id uuid not null,
  quantity numeric not null,
  destination text,
  responsible text,
  notes text,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.stock_full_audit_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  description text,
  created_by uuid,
  created_at timestamptz default now()
);

create index if not exists stock_full_items_institution_id_idx on public.stock_full_items (institution_id);
create index if not exists stock_full_entries_institution_id_idx on public.stock_full_entries (institution_id);
create index if not exists stock_full_entries_item_id_idx on public.stock_full_entries (item_id);
create index if not exists stock_full_entries_created_at_idx on public.stock_full_entries (created_at);
create index if not exists stock_full_exits_institution_id_idx on public.stock_full_exits (institution_id);
create index if not exists stock_full_exits_item_id_idx on public.stock_full_exits (item_id);
create index if not exists stock_full_exits_created_at_idx on public.stock_full_exits (created_at);
create index if not exists stock_full_audit_log_institution_id_idx on public.stock_full_audit_log (institution_id);
create index if not exists stock_full_audit_log_created_at_idx on public.stock_full_audit_log (created_at);
