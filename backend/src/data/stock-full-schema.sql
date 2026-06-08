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

