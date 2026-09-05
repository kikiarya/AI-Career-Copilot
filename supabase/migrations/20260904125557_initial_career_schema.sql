create extension if not exists pgcrypto;

create table if not exists public.career_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'awaiting_review', 'completed', 'failed', 'cancelled')),
  input jsonb not null,
  output jsonb,
  error text,
  idempotency_key text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists career_runs_queue_idx
  on public.career_runs (status, created_at);

create table if not exists public.career_run_events (
  run_id uuid not null references public.career_runs(id) on delete cascade,
  sequence integer not null,
  type text not null check (type in ('run.created', 'step.started', 'step.completed', 'step.failed', 'run.completed', 'run.failed')),
  step text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (run_id, sequence)
);

create index if not exists career_run_events_created_idx
  on public.career_run_events (run_id, created_at);

alter table public.career_runs enable row level security;
alter table public.career_run_events enable row level security;

-- The API and worker use the server-side Supabase key. Keep table access
-- explicit because the project disables automatic exposure of new tables.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.career_runs to service_role;
grant select, insert, update, delete on table public.career_run_events to service_role;

drop policy if exists career_runs_select_own on public.career_runs;
create policy career_runs_select_own on public.career_runs
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists career_run_events_select_own on public.career_run_events;
create policy career_run_events_select_own on public.career_run_events
  for select to authenticated
  using (exists (
    select 1 from public.career_runs r
    where r.id = career_run_events.run_id
      and r.user_id = (select auth.uid())
  ));

create or replace function public.claim_next_career_run()
returns setof public.career_runs
language plpgsql
security invoker
as $$
begin
  return query
  with next_run as (
    select id
    from public.career_runs
    where status = 'queued'
    order by created_at
    for update skip locked
    limit 1
  )
  update public.career_runs r
  set status = 'running', started_at = coalesce(r.started_at, now()), updated_at = now()
  from next_run
  where r.id = next_run.id
  returning r.*;
end;
$$;

grant execute on function public.claim_next_career_run() to service_role;
