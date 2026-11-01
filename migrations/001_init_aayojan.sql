-- Aayojan v1.0 Production Database Schema (Postgres 16 + pgvector)
-- Enforces optimistic concurrency, immutable version history, and Row-Level Security (RLS).

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  type text not null check (type in ('wedding', 'birthday', 'community')),
  current_version int not null default 1 check (current_version >= 1),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists event_versions (
  event_id uuid not null references events(id) on delete cascade,
  version int not null check (version >= 1),
  state jsonb not null,
  ops jsonb not null default '[]'::jsonb,
  diff jsonb not null,
  cause text not null,
  health int not null check (health between 0 and 100),
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (event_id, version)
);

create index if not exists idx_event_versions_lookup
  on event_versions (event_id, version desc);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  kind text not null,
  status text not null check (status in ('queued', 'running', 'done', 'failed')),
  stage text,
  result jsonb,
  error jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_jobs_idempotency_key
  on jobs (idempotency_key);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category text not null,
  amount int not null check (amount >= 0),
  note text,
  paid_on date not null,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category text not null,
  vendor_name text not null,
  amount int not null check (amount > 0),
  capacity int check (capacity is null or capacity > 0),
  inclusions text,
  received_on date not null default current_date
);

create table if not exists share_links (
  token_hash text primary key,
  event_id uuid not null references events(id) on delete cascade,
  role text not null check (role in ('family', 'vendor', 'volunteer')),
  scope jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  event_id uuid,
  actor uuid,
  action text not null,
  meta jsonb,
  at timestamptz not null default now()
);

create table if not exists templates (
  id serial primary key,
  event_type text not null,
  region text not null,
  kind text not null,
  title text not null,
  body text not null,
  source text not null,
  embedding vector(1024)
);

create index if not exists idx_templates_embedding_hnsw
  on templates using hnsw (embedding vector_cosine_ops);

-- Row-Level Security (RLS)
alter table events enable row level security;
alter table event_versions enable row level security;
alter table expenses enable row level security;
alter table quotes enable row level security;
alter table share_links enable row level security;
