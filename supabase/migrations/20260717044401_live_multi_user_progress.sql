alter table public.dealerships
  add column if not exists live_multi_user_progress_enabled boolean
  not null default true;

comment on column public.dealerships.live_multi_user_progress_enabled is
  'When enabled, dealership members receive live audit progress updates from other scanners.';

create or replace function public.update_live_multi_user_progress(
  target_dealership_id uuid,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Authentication required.';
  end if;

  if not private.is_aal2() then
    raise exception 'MFA verification is required.';
  end if;

  if not private.is_dealership_owner_or_gm(target_dealership_id, actor) then
    raise exception 'Only a dealership owner or GM can change live progress.';
  end if;

  update public.dealerships
  set live_multi_user_progress_enabled = enabled
  where id = target_dealership_id;

  if not found then
    raise exception 'Dealership not found.';
  end if;

  insert into public.security_audit_events (
    actor_user_id,
    action,
    dealership_id,
    outcome,
    metadata
  )
  values (
    actor,
    'live_multi_user_progress_updated',
    target_dealership_id,
    'success',
    jsonb_build_object('enabled', enabled)
  );
end;
$$;

notify pgrst, 'reload schema';

revoke all on function public.update_live_multi_user_progress(uuid, boolean)
  from public, anon;
grant execute on function public.update_live_multi_user_progress(uuid, boolean)
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dealerships'
  ) then
    alter publication supabase_realtime add table public.dealerships;
  end if;
end;
$$;
