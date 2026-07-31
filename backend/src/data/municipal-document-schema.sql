-- Acervo Documental Municipal - schema aditivo. Nao executar automaticamente.
-- Separado do Acervo ELO por obra.

create extension if not exists pgcrypto;

create table if not exists public.municipal_documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  unit_id uuid references public.units(id),
  title text not null,
  description text,
  document_type text not null default 'outro' check (document_type in ('inventario','inspecao','conferencia','prestacao_contas','nota','termo','relatorio','outro')),
  status text not null default 'active' check (status in ('active','archived')),
  current_version integer not null default 0 check (current_version >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.municipal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.municipal_documents(id),
  institution_id uuid not null references public.institutions(id),
  unit_id uuid references public.units(id),
  version_number integer not null check (version_number > 0),
  original_filename text,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  file_reference text not null,
  file_hash text,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create index if not exists municipal_documents_institution_idx on public.municipal_documents(institution_id);
create index if not exists municipal_documents_unit_idx on public.municipal_documents(unit_id);
create index if not exists municipal_documents_type_idx on public.municipal_documents(document_type);
create index if not exists municipal_documents_status_idx on public.municipal_documents(status);
create index if not exists municipal_documents_created_at_idx on public.municipal_documents(created_at desc);
create index if not exists municipal_document_versions_document_idx on public.municipal_document_versions(document_id);
create index if not exists municipal_document_versions_institution_idx on public.municipal_document_versions(institution_id);
create index if not exists municipal_document_versions_unit_idx on public.municipal_document_versions(unit_id);
create index if not exists municipal_document_versions_created_at_idx on public.municipal_document_versions(created_at desc);

alter table public.municipal_documents enable row level security;
alter table public.municipal_document_versions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'municipal_documents' and policyname = 'municipal_documents_tenant_select') then
    create policy municipal_documents_tenant_select
      on public.municipal_documents
      for select
      using (
        public.current_municipal_is_platform_admin()
        or institution_id = public.current_municipal_institution_id()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'municipal_document_versions' and policyname = 'municipal_document_versions_tenant_select') then
    create policy municipal_document_versions_tenant_select
      on public.municipal_document_versions
      for select
      using (
        public.current_municipal_is_platform_admin()
        or institution_id = public.current_municipal_institution_id()
      );
  end if;
end $$;
