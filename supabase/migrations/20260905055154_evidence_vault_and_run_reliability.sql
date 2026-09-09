create table if not exists public.candidate_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null default 'other' check (type in ('project', 'experience', 'skill', 'education', 'achievement', 'other')),
  title text not null,
  content text not null,
  skills text[] not null default '{}',
  source_type text not null check (source_type in ('manual', 'resume_paste', 'resume_upload')),
  source_url text,
  verification_status text not null default 'draft' check (verification_status in ('draft', 'user_confirmed', 'rejected', 'stale')),
  proof_links text[] not null default '{}',
  metrics text[] not null default '{}',
  content_hash text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidate_evidence_user_updated_idx
  on public.candidate_evidence (user_id, updated_at desc);

create unique index if not exists candidate_evidence_user_hash_idx
  on public.candidate_evidence (user_id, content_hash)
  where content_hash is not null;

alter table public.career_runs
  add column if not exists evidence_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists lease_until timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists attempt_count integer not null default 0;

alter table public.career_run_events
  drop constraint if exists career_run_events_type_check;

alter table public.career_run_events
  add constraint career_run_events_type_check check (type in (
    'run.created', 'run.retried', 'run.recovered', 'run.cancelled',
    'step.started', 'step.completed', 'step.failed',
    'run.completed', 'run.failed'
  ));

alter table public.candidate_evidence enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.candidate_evidence to service_role;
grant select, insert, update, delete on table public.candidate_evidence to authenticated;

drop policy if exists candidate_evidence_select_own on public.candidate_evidence;
create policy candidate_evidence_select_own on public.candidate_evidence
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists candidate_evidence_insert_own on public.candidate_evidence;
create policy candidate_evidence_insert_own on public.candidate_evidence
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists candidate_evidence_update_own on public.candidate_evidence;
create policy candidate_evidence_update_own on public.candidate_evidence
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists candidate_evidence_delete_own on public.candidate_evidence;
create policy candidate_evidence_delete_own on public.candidate_evidence
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.append_career_run_event(
  p_run_id uuid,
  p_type text,
  p_step text default null,
  p_payload jsonb default '{}'::jsonb
)
returns setof public.career_run_events
language plpgsql
security invoker
as $$
declare
  next_sequence integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text, 0));
  select coalesce(max(sequence), -1) + 1
    into next_sequence
    from public.career_run_events
   where run_id = p_run_id;

  return query
  insert into public.career_run_events (run_id, sequence, type, step, payload)
  values (p_run_id, next_sequence, p_type, p_step, coalesce(p_payload, '{}'::jsonb))
  returning *;
end;
$$;

grant execute on function public.append_career_run_event(uuid, text, text, jsonb) to service_role;

create or replace function public.claim_next_career_run(p_lease_seconds integer default 300)
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
     set status = 'running',
         started_at = coalesce(r.started_at, now()),
         lease_until = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
         heartbeat_at = now(),
         attempt_count = r.attempt_count + 1,
         updated_at = now()
    from next_run
   where r.id = next_run.id
  returning r.*;
end;
$$;

grant execute on function public.claim_next_career_run(integer) to service_role;

create or replace function public.heartbeat_career_run(p_run_id uuid, p_lease_seconds integer default 300)
returns boolean
language sql
security invoker
as $$
  update public.career_runs
     set lease_until = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
         heartbeat_at = now(),
         updated_at = now()
   where id = p_run_id and status = 'running'
  returning true;
$$;

grant execute on function public.heartbeat_career_run(uuid, integer) to service_role;

create or replace function public.requeue_stale_career_runs(p_max_attempts integer default 3)
returns setof public.career_runs
language sql
security invoker
as $$
  update public.career_runs
     set status = case when attempt_count >= greatest(p_max_attempts, 1) then 'failed' else 'queued' end,
         error = case when attempt_count >= greatest(p_max_attempts, 1) then 'worker_lease_expired' else null end,
         lease_until = null,
         heartbeat_at = null,
         updated_at = now()
   where status = 'running' and lease_until < now()
  returning *;
$$;

grant execute on function public.requeue_stale_career_runs(integer) to service_role;
