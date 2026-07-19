create or replace function private.is_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function private.is_dealership_member(
  target_dealership_id uuid,
  actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_aal2() and exists (
    select 1 from public.dealership_members
    where dealership_id = target_dealership_id and user_id = actor_user_id
  );
$$;

create or replace function private.is_dealership_owner(
  target_dealership_id uuid,
  actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_aal2() and exists (
    select 1 from public.dealership_members
    where dealership_id = target_dealership_id
      and user_id = actor_user_id
      and membership_kind = 'owner'
  );
$$;

create or replace function private.has_dealership_permission(
  target_dealership_id uuid,
  requested_permission public.auditur_permission,
  actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_aal2() and (
    private.is_dealership_owner(target_dealership_id, actor_user_id)
    or exists (
      select 1
      from public.dealership_members member
      join public.dealership_role_permissions role_permission
        on role_permission.role_id = member.role_id
      where member.dealership_id = target_dealership_id
        and member.user_id = actor_user_id
        and role_permission.permission = requested_permission
    )
  );
$$;

create or replace function private.shares_dealership_with_user(
  other_user_id uuid,
  actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_aal2() and exists (
    select 1
    from public.dealership_members mine
    join public.dealership_members theirs
      on theirs.dealership_id = mine.dealership_id
    where mine.user_id = actor_user_id
      and theirs.user_id = other_user_id
  );
$$;

create or replace function private.prepare_auditur_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_id text;
begin
  assigned_id := private.allocate_auditur_id();
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'auditur_id', assigned_id,
      'account_type', 'employee'
    );
  return new;
end;
$$;

create or replace function private.protect_profile_authority_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id
    or new.auditur_id <> old.auditur_id
    or new.created_at <> old.created_at
  then
    raise exception 'Profile authority fields cannot be changed.';
  end if;
  if new.account_type <> old.account_type and not (
    auth.uid() = new.user_id
    and old.account_type = 'employee'
    and new.account_type = 'owner_gm'
    and exists (
      select 1 from public.dealership_members
      where user_id = new.user_id and membership_kind = 'owner'
    )
  ) then
    raise exception 'Profile authority fields cannot be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.get_my_dealership_access()
returns table (
  dealership_id uuid,
  dealership_name text,
  membership_kind text,
  role_id uuid,
  role_name text,
  permissions text[],
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    dealership.id,
    dealership.name,
    member.membership_kind,
    role.id,
    role.name,
    case
      when member.membership_kind = 'owner'
        then enum_range(null::public.auditur_permission)::text[]
      else coalesce(
        array_agg(role_permission.permission::text)
          filter (where role_permission.permission is not null),
        array[]::text[]
      )
    end,
    preference.active_dealership_id = dealership.id
  from public.dealership_members member
  join public.dealerships dealership on dealership.id = member.dealership_id
  left join public.dealership_roles role on role.id = member.role_id
  left join public.dealership_role_permissions role_permission
    on role_permission.role_id = role.id
  left join public.user_dealership_preferences preference
    on preference.user_id = member.user_id
  where member.user_id = auth.uid() and private.is_aal2()
  group by dealership.id, dealership.name, member.membership_kind,
    role.id, role.name, preference.active_dealership_id, member.joined_at
  order by (preference.active_dealership_id = dealership.id) desc,
    member.joined_at asc;
$$;

create or replace function public.create_dealership(dealership_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  created_id uuid;
begin
  if actor is null or not private.is_aal2() then
    raise exception 'A verified MFA session is required.';
  end if;
  if exists (
    select 1 from public.dealership_members where user_id = actor
  ) then
    raise exception 'Your account already belongs to a dealership.';
  end if;
  if length(trim(dealership_name)) not between 1 and 120 then
    raise exception 'Dealership name is required.';
  end if;

  insert into public.dealerships (name, created_by)
  values (trim(dealership_name), actor)
  returning id into created_id;
  insert into public.dealership_members (
    dealership_id, user_id, membership_kind, added_by
  ) values (created_id, actor, 'owner', actor);
  insert into public.user_dealership_preferences (
    user_id, active_dealership_id, updated_at
  ) values (actor, created_id, now());
  update public.profiles
    set account_type = 'owner_gm', updated_at = now()
    where user_id = actor;
  return created_id;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'dealerships',
    'dealership_roles',
    'dealership_role_permissions',
    'dealership_members',
    'user_dealership_preferences',
    'inventory_uploads',
    'inventory_items',
    'vehicle_scans',
    'lot_zones'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'require_aal2_' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (private.is_aal2()) with check (private.is_aal2())',
      'require_aal2_' || table_name,
      table_name
    );
  end loop;
end $$;

drop policy if exists require_aal2_price_lists on storage.objects;
create policy require_aal2_price_lists
on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'price-lists' or private.is_aal2())
with check (bucket_id <> 'price-lists' or private.is_aal2());

create or replace function private.protect_operational_provenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'inventory_uploads' and (
    new.dealership_id is distinct from old.dealership_id
    or new.created_by is distinct from old.created_by
    or new.uploaded_at is distinct from old.uploaded_at
    or new.storage_path is distinct from old.storage_path
  ) then
    raise exception 'Inventory upload provenance is immutable.';
  elsif tg_table_name = 'inventory_items' and (
    new.dealership_id is distinct from old.dealership_id
    or new.upload_id is distinct from old.upload_id
  ) then
    raise exception 'Inventory item provenance is immutable.';
  elsif tg_table_name = 'vehicle_scans' and (
    new.dealership_id is distinct from old.dealership_id
    or new.scanned_by is distinct from old.scanned_by
    or new.scanned_at is distinct from old.scanned_at
  ) then
    raise exception 'Vehicle scan provenance is immutable.';
  elsif tg_table_name = 'lot_zones' and (
    new.dealership_id is distinct from old.dealership_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Lot zone provenance is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_inventory_upload_provenance on public.inventory_uploads;
create trigger protect_inventory_upload_provenance
before update on public.inventory_uploads
for each row execute function private.protect_operational_provenance();
drop trigger if exists protect_inventory_item_provenance on public.inventory_items;
create trigger protect_inventory_item_provenance
before update on public.inventory_items
for each row execute function private.protect_operational_provenance();
drop trigger if exists protect_vehicle_scan_provenance on public.vehicle_scans;
create trigger protect_vehicle_scan_provenance
before update on public.vehicle_scans
for each row execute function private.protect_operational_provenance();
drop trigger if exists protect_lot_zone_provenance on public.lot_zones;
create trigger protect_lot_zone_provenance
before update on public.lot_zones
for each row execute function private.protect_operational_provenance();

create or replace function private.audit_sensitive_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.security_audit_events (
    actor_user_id,
    target_user_id,
    dealership_id,
    action,
    outcome
  ) values (
    auth.uid(),
    nullif(row_data ->> 'user_id', '')::uuid,
    nullif(row_data ->> 'dealership_id', '')::uuid,
    tg_table_name || '_' || lower(tg_op),
    'success'
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_dealership_members on public.dealership_members;
create trigger audit_dealership_members
after insert or update or delete on public.dealership_members
for each row execute function private.audit_sensitive_mutation();
drop trigger if exists audit_dealership_roles on public.dealership_roles;
create trigger audit_dealership_roles
after insert or update or delete on public.dealership_roles
for each row execute function private.audit_sensitive_mutation();
drop trigger if exists audit_inventory_uploads on public.inventory_uploads;
create trigger audit_inventory_uploads
after insert or delete on public.inventory_uploads
for each row execute function private.audit_sensitive_mutation();
