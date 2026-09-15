-- Step 05: canonical durable registry for generated ObraReport artifacts.
-- This migration is additive: it preserves all legacy document rows and
-- keeps Google Drive as the artifact store.

alter table if exists obrareport_generated_documents
  add column if not exists work_id text references obrareport_projects(id),
  add column if not exists rdo_id text references obrareport_rdos(id),
  add column if not exists title text,
  add column if not exists provider text,
  add column if not exists external_file_id text,
  add column if not exists artifact_url text,
  add column if not exists idempotency_key text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update obrareport_generated_documents
set created_at = coalesce(created_at, generated_at, now()),
    updated_at = coalesce(updated_at, generated_at, now()),
    artifact_url = coalesce(artifact_url, file_url),
    external_file_id = coalesce(external_file_id, file_id),
    provider = coalesce(provider, case when file_id is not null then 'legacy' else null end),
    title = coalesce(title, document_type)
where created_at is null
   or updated_at is null
   or artifact_url is null
   or external_file_id is null
   or provider is null
   or title is null;

alter table if exists obrareport_generated_documents
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table if exists obrareport_generated_documents
  drop constraint if exists obrareport_generated_documents_source_type_check;

alter table if exists obrareport_generated_documents
  add constraint obrareport_generated_documents_source_type_check
  check (source_type in ('technical_report', 'rdo', 'analysis', 'image_analysis', 'manual'));

create index if not exists idx_obrareport_documents_institution
  on obrareport_generated_documents(institution_id, updated_at desc);
create index if not exists idx_obrareport_documents_work
  on obrareport_generated_documents(institution_id, work_id, updated_at desc);
create index if not exists idx_obrareport_documents_rdo
  on obrareport_generated_documents(institution_id, rdo_id, updated_at desc);
create unique index if not exists uq_obrareport_documents_idempotency
  on obrareport_generated_documents(institution_id, idempotency_key)
  where idempotency_key is not null;
