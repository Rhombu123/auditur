create table public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index mfa_recovery_codes_user_unused_idx
  on public.mfa_recovery_codes (user_id, created_at desc)
  where used_at is null;

create table public.security_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  dealership_id uuid references public.dealerships(id) on delete set null,
  action text not null check (length(action) between 3 and 80),
  outcome text not null check (outcome in ('success', 'denied', 'failed')),
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index security_audit_actor_created_idx
  on public.security_audit_events (actor_user_id, created_at desc);
create index security_audit_dealership_created_idx
  on public.security_audit_events (dealership_id, created_at desc);

alter table public.mfa_recovery_codes enable row level security;
alter table public.security_audit_events enable row level security;

revoke all on public.mfa_recovery_codes, public.security_audit_events
  from public, anon, authenticated;
grant all on public.mfa_recovery_codes, public.security_audit_events
  to service_role;

create or replace function private.protect_security_audit_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Security audit events are immutable.';
end;
$$;

create trigger protect_security_audit_events
before update or delete on public.security_audit_events
for each row execute function private.protect_security_audit_events();
