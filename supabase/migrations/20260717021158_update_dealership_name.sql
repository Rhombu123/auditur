create or replace function public.update_dealership_name(
  target_dealership_id uuid,
  dealership_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized_name text := trim(dealership_name);
begin
  if actor is null or not private.is_aal2() then
    raise exception 'A verified MFA session is required.';
  end if;
  if not private.is_dealership_owner_or_gm(target_dealership_id, actor) then
    raise exception 'Only a dealership owner or GM can change the dealership name.';
  end if;
  if length(normalized_name) not between 1 and 120 then
    raise exception 'Dealership name must be between 1 and 120 characters.';
  end if;

  update public.dealerships
  set name = normalized_name,
      updated_at = clock_timestamp()
  where id = target_dealership_id;

  if not found then
    raise exception 'Dealership not found.';
  end if;

  insert into public.security_audit_events (
    actor_user_id,
    dealership_id,
    action,
    outcome,
    metadata
  ) values (
    actor,
    target_dealership_id,
    'dealership_name_updated',
    'success',
    jsonb_build_object('name', normalized_name)
  );
end;
$$;

revoke all on function public.update_dealership_name(uuid, text)
  from public, anon;
grant execute on function public.update_dealership_name(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
