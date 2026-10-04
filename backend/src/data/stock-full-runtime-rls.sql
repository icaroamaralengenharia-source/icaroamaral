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

create or replace function public.stock_full_work_allowed(p_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.obrareport_projects p
    where p.id = nullif(btrim(p_project_id), '')
      and p.institution_id = public.stock_full_current_institution_id()
  );
$$;

create or replace function public.stock_full_scope_allowed(p_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select nullif(btrim(p_project_id), '') is null
    or public.stock_full_work_allowed(p_project_id);
$$;

revoke all on function public.stock_full_current_institution_id() from public;
revoke all on function public.stock_full_current_profile_id() from public;
grant execute on function public.stock_full_current_institution_id() to authenticated;
grant execute on function public.stock_full_current_profile_id() to authenticated;
revoke all on function public.stock_full_work_allowed(text) from public;
grant execute on function public.stock_full_work_allowed(text) to authenticated;
revoke all on function public.stock_full_scope_allowed(text) from public;
grant execute on function public.stock_full_scope_allowed(text) to authenticated;

-- Expose only the current tenant's canonical works to Stock Full. The source
-- table remains protected; this RPC keeps the work selector and work lookup
-- tenant-scoped without relaxing its own RLS.
create or replace function public.stock_full_list_works()
returns table (
  id text,
  institution_id text,
  client_id text,
  name text,
  address text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.institution_id, p.client_id, p.name, p.address
  from public.obrareport_projects p
  where p.institution_id = public.stock_full_current_institution_id()
  order by p.name asc nulls last, p.id asc;
$$;

revoke all on function public.stock_full_list_works() from public;
grant execute on function public.stock_full_list_works() to authenticated;

-- Keep the legacy item/work consistency trigger compatible with tenant-level
-- inventory. General movements intentionally have a NULL project_id; when a
-- work is selected, the item must still belong to that same work.
create or replace function public.stock_full_validate_movement_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_project_id text;
  new_project_id text := nullif(btrim(new.project_id), '');
begin
  if new_project_id is null then
    return new;
  end if;

  select project_id into item_project_id
  from public.stock_full_items
  where id = new.item_id
    and institution_id = new.institution_id
    and is_active = true;

  if not found or item_project_id is distinct from new_project_id then
    raise exception 'stock_full_item_work_mismatch';
  end if;
  return new;
end;
$$;

alter table public.stock_full_items enable row level security;
alter table public.stock_full_entries enable row level security;
alter table public.stock_full_exits enable row level security;
alter table public.stock_full_audit_log enable row level security;

drop policy if exists stock_full_runtime_items_select on public.stock_full_items;
create policy stock_full_runtime_items_select
  on public.stock_full_items for select to authenticated
  using (
    institution_id = public.stock_full_current_institution_id()
    and public.stock_full_scope_allowed(project_id)
  );

drop policy if exists stock_full_runtime_items_insert on public.stock_full_items;
create policy stock_full_runtime_items_insert
  on public.stock_full_items for insert to authenticated
  with check (
    institution_id = public.stock_full_current_institution_id()
    and public.stock_full_scope_allowed(project_id)
    and created_by = public.stock_full_current_profile_id()
  );

drop policy if exists stock_full_runtime_items_update on public.stock_full_items;
create policy stock_full_runtime_items_update
  on public.stock_full_items for update to authenticated
  using (
    institution_id = public.stock_full_current_institution_id()
    and public.stock_full_scope_allowed(project_id)
  )
  with check (
    institution_id = public.stock_full_current_institution_id()
    and public.stock_full_scope_allowed(project_id)
  );

drop policy if exists stock_full_runtime_items_delete on public.stock_full_items;
create policy stock_full_runtime_items_delete
  on public.stock_full_items for delete to authenticated
  using (
    institution_id = public.stock_full_current_institution_id()
    and public.stock_full_scope_allowed(project_id)
  );

drop policy if exists stock_full_runtime_entries_select on public.stock_full_entries;
create policy stock_full_runtime_entries_select
  on public.stock_full_entries for select to authenticated
  using (
    institution_id = public.stock_full_current_institution_id()
    and public.stock_full_scope_allowed(project_id)
  );

drop policy if exists stock_full_runtime_entries_insert on public.stock_full_entries;
create policy stock_full_runtime_entries_insert
  on public.stock_full_entries for insert to authenticated
  with check (
    institution_id = public.stock_full_current_institution_id()
    and public.stock_full_scope_allowed(project_id)
    and created_by = public.stock_full_current_profile_id()
  );

drop policy if exists stock_full_runtime_exits_select on public.stock_full_exits;
create policy stock_full_runtime_exits_select
  on public.stock_full_exits for select to authenticated
  using (
    institution_id = public.stock_full_current_institution_id()
    and public.stock_full_scope_allowed(project_id)
  );

drop policy if exists stock_full_runtime_exits_insert on public.stock_full_exits;
create policy stock_full_runtime_exits_insert
  on public.stock_full_exits for insert to authenticated
  with check (
    institution_id = public.stock_full_current_institution_id()
    and public.stock_full_scope_allowed(project_id)
    and created_by = public.stock_full_current_profile_id()
  );

drop policy if exists stock_full_runtime_audit_select on public.stock_full_audit_log;
create policy stock_full_runtime_audit_select
  on public.stock_full_audit_log for select to authenticated
  using (
    institution_id = public.stock_full_current_institution_id()
    and public.stock_full_scope_allowed(project_id)
  );

drop policy if exists stock_full_runtime_audit_insert on public.stock_full_audit_log;
create policy stock_full_runtime_audit_insert
  on public.stock_full_audit_log for insert to authenticated
  with check (
    institution_id = public.stock_full_current_institution_id()
    and public.stock_full_scope_allowed(project_id)
    and created_by = public.stock_full_current_profile_id()
  );
