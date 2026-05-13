-- Single-row probe table for dual-runtime health checks via @supabase/supabase-js (service_role).
-- RLS enabled with no policies: anon/authenticated cannot read; service_role bypasses RLS.

create table if not exists public.connectivity_check (
  id text primary key
);

comment on table public.connectivity_check is 'App connectivity probe; no user PII.';

insert into public.connectivity_check (id) values ('singleton')
  on conflict (id) do nothing;

alter table public.connectivity_check enable row level security;
