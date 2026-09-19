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

create index if not exists idx_obrareport_documents_institution
  on obrareport_generated_documents(institution_id, updated_at desc);
create index if not exists idx_obrareport_documents_work
  on obrareport_generated_documents(institution_id, work_id, updated_at desc);
create index if not exists idx_obrareport_documents_rdo
  on obrareport_generated_documents(institution_id, rdo_id, updated_at desc);
create unique index if not exists uq_obrareport_documents_idempotency
  on obrareport_generated_documents(institution_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_obrareport_documents_created
  on obrareport_generated_documents(institution_id, created_at desc);
