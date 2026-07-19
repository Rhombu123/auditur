create or replace function private.is_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.transfer_dealership_ownership(
  target_dealership_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not private.is_aal2() then
    raise exception 'A verified MFA session is required.';
  end if;
  if target_user_id = actor then
    raise exception 'Choose another team member.';
  end if;
  if not exists (
    select 1 from public.dealership_members
    where dealership_id = target_dealership_id
      and user_id = actor
      and membership_kind = 'owner'
  ) then
    raise exception 'Only the current dealership owner can transfer ownership.';
  end if;
  if not exists (
    select 1 from public.dealership_members
    where dealership_id = target_dealership_id
      and user_id = target_user_id
      and membership_kind = 'member'
  ) then
    raise exception 'Choose an existing non-owner team member.';
  end if;

  update public.dealership_members
  set membership_kind = 'owner', role_id = null
  where dealership_id = target_dealership_id and user_id = target_user_id;

  update public.dealership_members
  set membership_kind = 'member', role_id = null
  where dealership_id = target_dealership_id and user_id = actor;

  update public.dealerships
  set created_by = target_user_id, updated_at = now()
  where id = target_dealership_id;

  insert into public.security_audit_events (
    actor_user_id,
    target_user_id,
    dealership_id,
    action,
    outcome
  ) values (
    actor,
    target_user_id,
    target_dealership_id,
    'dealership_ownership_transferred',
    'success'
  );
end;
$$;

revoke all on function public.transfer_dealership_ownership(uuid, uuid)
  from public, anon;
grant execute on function public.transfer_dealership_ownership(uuid, uuid)
  to authenticated;
