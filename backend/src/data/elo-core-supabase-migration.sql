create extension if not exists pgcrypto;

create table if not exists public.elo_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  anonymous_id text,
  institution_id uuid,
  company_id uuid,
  project_id uuid,
  title text not null default 'Nova conversa',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.elo_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.elo_conversations(id) on delete cascade,
  owner_user_id uuid not null,
  anonymous_id text,
  institution_id uuid,
  company_id uuid,
  project_id uuid,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.elo_memories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  anonymous_id text,
  institution_id uuid,
  company_id uuid,
  project_id uuid,
  conversation_id uuid references public.elo_conversations(id) on delete set null,
  category text not null default 'preference',
  memory_key text not null default 'geral',
  memory_value text not null,
  confidence numeric not null default 0.8 check (confidence >= 0 and confidence <= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists elo_conversations_owner_user_id_idx
  on public.elo_conversations(owner_user_id);

create index if not exists elo_conversations_institution_id_idx
  on public.elo_conversations(institution_id);

create index if not exists elo_conversations_project_id_idx
  on public.elo_conversations(project_id);

create index if not exists elo_conversations_anonymous_id_idx
  on public.elo_conversations(anonymous_id)
  where anonymous_id is not null;

create index if not exists elo_messages_conversation_id_idx
  on public.elo_messages(conversation_id);

create index if not exists elo_messages_owner_user_id_idx
  on public.elo_messages(owner_user_id);

create index if not exists elo_memories_owner_user_id_idx
  on public.elo_memories(owner_user_id);

create index if not exists elo_memories_conversation_id_idx
  on public.elo_memories(conversation_id);

create index if not exists elo_memories_owner_category_key_idx
  on public.elo_memories(owner_user_id, category, memory_key)
  where is_active = true;

create index if not exists elo_memories_anonymous_id_idx
  on public.elo_memories(anonymous_id)
  where anonymous_id is not null;

alter table public.elo_conversations enable row level security;
alter table public.elo_conversations force row level security;

alter table public.elo_messages enable row level security;
alter table public.elo_messages force row level security;

alter table public.elo_memories enable row level security;
alter table public.elo_memories force row level security;

drop policy if exists elo_conversations_owner_select on public.elo_conversations;
create policy elo_conversations_owner_select on public.elo_conversations
  for select using (owner_user_id = auth.uid());

drop policy if exists elo_conversations_owner_insert on public.elo_conversations;
create policy elo_conversations_owner_insert on public.elo_conversations
  for insert with check (owner_user_id = auth.uid());

drop policy if exists elo_conversations_owner_update on public.elo_conversations;
create policy elo_conversations_owner_update on public.elo_conversations
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists elo_conversations_owner_delete on public.elo_conversations;
create policy elo_conversations_owner_delete on public.elo_conversations
  for delete using (owner_user_id = auth.uid());

drop policy if exists elo_messages_owner_select on public.elo_messages;
create policy elo_messages_owner_select on public.elo_messages
  for select using (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.elo_conversations c
      where c.id = conversation_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists elo_messages_owner_insert on public.elo_messages;
create policy elo_messages_owner_insert on public.elo_messages
  for insert with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.elo_conversations c
      where c.id = conversation_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists elo_messages_owner_update on public.elo_messages;
create policy elo_messages_owner_update on public.elo_messages
  for update using (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.elo_conversations c
      where c.id = conversation_id
        and c.owner_user_id = auth.uid()
    )
  ) with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.elo_conversations c
      where c.id = conversation_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists elo_messages_owner_delete on public.elo_messages;
create policy elo_messages_owner_delete on public.elo_messages
  for delete using (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.elo_conversations c
      where c.id = conversation_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists elo_memories_owner_select on public.elo_memories;
create policy elo_memories_owner_select on public.elo_memories
  for select using (owner_user_id = auth.uid());

drop policy if exists elo_memories_owner_insert on public.elo_memories;
create policy elo_memories_owner_insert on public.elo_memories
  for insert with check (
    owner_user_id = auth.uid()
    and (
      conversation_id is null
      or exists (
        select 1
        from public.elo_conversations c
        where c.id = conversation_id
          and c.owner_user_id = auth.uid()
      )
    )
  );

drop policy if exists elo_memories_owner_update on public.elo_memories;
create policy elo_memories_owner_update on public.elo_memories
  for update using (owner_user_id = auth.uid()) with check (
    owner_user_id = auth.uid()
    and (
      conversation_id is null
      or exists (
        select 1
        from public.elo_conversations c
        where c.id = conversation_id
          and c.owner_user_id = auth.uid()
      )
    )
  );

drop policy if exists elo_memories_owner_delete on public.elo_memories;
create policy elo_memories_owner_delete on public.elo_memories
  for delete using (owner_user_id = auth.uid());
