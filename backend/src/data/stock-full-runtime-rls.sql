-- Stock Full runtime RLS policies.
-- Apply in the E2E Supabase project's SQL Editor after review.
-- These policies keep all product writes on the authenticated Stock Full routes;
-- they do not grant service-role access or insert test data.

create or replace function public.stock_full_current_institution_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.institution_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  order by p.created_at desc nulls last
  limit 1;
$$;

create or replace function public.stock_full_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  order by p.created_at desc nulls last
  limit 1;
$$;

revoke all on function public.stock_full_current_institution_id() from public;
revoke all on function public.stock_full_current_profile_id() from public;
grant execute on function public.stock_full_current_institution_id() to authenticated;
grant execute on function public.stock_full_current_profile_id() to authenticated;

alter table public.stock_full_items enable row level security;
alter table public.stock_full_entries enable row level security;
alter table public.stock_full_exits enable row level security;
alter table public.stock_full_audit_log enable row level security;

drop policy if exists stock_full_runtime_items_select on public.stock_full_items;
create policy stock_full_runtime_items_select
  on public.stock_full_items for select to authenticated
  using (institution_id = public.stock_full_current_institution_id());

drop policy if exists stock_full_runtime_items_insert on public.stock_full_items;
create policy stock_full_runtime_items_insert
  on public.stock_full_items for insert to authenticated
  with check (
    institution_id = public.stock_full_current_institution_id()
    and created_by = public.stock_full_current_profile_id()
  );

drop policy if exists stock_full_runtime_items_update on public.stock_full_items;
create policy stock_full_runtime_items_update
  on public.stock_full_items for update to authenticated
  using (institution_id = public.stock_full_current_institution_id())
  with check (institution_id = public.stock_full_current_institution_id());

drop policy if exists stock_full_runtime_items_delete on public.stock_full_items;
create policy stock_full_runtime_items_delete
  on public.stock_full_items for delete to authenticated
  using (institution_id = public.stock_full_current_institution_id());

drop policy if exists stock_full_runtime_entries_select on public.stock_full_entries;
create policy stock_full_runtime_entries_select
  on public.stock_full_entries for select to authenticated
  using (institution_id = public.stock_full_current_institution_id());

drop policy if exists stock_full_runtime_entries_insert on public.stock_full_entries;
create policy stock_full_runtime_entries_insert
  on public.stock_full_entries for insert to authenticated
  with check (
    institution_id = public.stock_full_current_institution_id()
    and created_by = public.stock_full_current_profile_id()
  );

drop policy if exists stock_full_runtime_exits_select on public.stock_full_exits;
create policy stock_full_runtime_exits_select
  on public.stock_full_exits for select to authenticated
  using (institution_id = public.stock_full_current_institution_id());

drop policy if exists stock_full_runtime_exits_insert on public.stock_full_exits;
create policy stock_full_runtime_exits_insert
  on public.stock_full_exits for insert to authenticated
  with check (
    institution_id = public.stock_full_current_institution_id()
    and created_by = public.stock_full_current_profile_id()
  );

drop policy if exists stock_full_runtime_audit_select on public.stock_full_audit_log;
create policy stock_full_runtime_audit_select
  on public.stock_full_audit_log for select to authenticated
  using (institution_id = public.stock_full_current_institution_id());

drop policy if exists stock_full_runtime_audit_insert on public.stock_full_audit_log;
create policy stock_full_runtime_audit_insert
  on public.stock_full_audit_log for insert to authenticated
  with check (
    institution_id = public.stock_full_current_institution_id()
    and created_by = public.stock_full_current_profile_id()
  );
