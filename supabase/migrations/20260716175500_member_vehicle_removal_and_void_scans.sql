alter table public.vehicle_scans
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete restrict,
  add column if not exists void_reason text;

alter table public.vehicle_scans
  drop constraint if exists vehicle_scans_void_reason_check;
alter table public.vehicle_scans
  drop constraint if exists vehicle_scans_voided_by_fkey;
alter table public.vehicle_scans
  add constraint vehicle_scans_voided_by_fkey
  foreign key (voided_by) references auth.users(id) on delete set null;
alter table public.vehicle_scans
  add constraint vehicle_scans_void_reason_check
  check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (
      voided_at is not null
      and length(trim(void_reason)) between 1 and 200
    )
  );

create or replace function private.protect_vehicle_scan_void_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.voided_at is distinct from old.voided_at
    or new.voided_by is distinct from old.voided_by
    or new.void_reason is distinct from old.void_reason
  )
  and coalesce(current_setting('auditur.allow_scan_void', true), '') <> 'on'
  and not (
    old.voided_at is not null
    and old.voided_by is not null
    and new.voided_by is null
    and new.voided_at is not distinct from old.voided_at
    and new.void_reason is not distinct from old.void_reason
  ) then
    raise exception 'Use the mistaken-scan action to void a scan.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_vehicle_scan_void_fields
  on public.vehicle_scans;
create trigger protect_vehicle_scan_void_fields
before update on public.vehicle_scans
for each row execute function private.protect_vehicle_scan_void_fields();

create or replace function private.protect_inventory_vehicle_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.lot_status is distinct from old.lot_status
    or new.removed_at is distinct from old.removed_at
  ) and not private.is_dealership_member(old.dealership_id) then
    raise exception 'You must belong to this dealership to change vehicle availability.';
  end if;
  return new;
end;
$$;

create or replace function public.remove_inventory_vehicle(
  target_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_item public.inventory_items%rowtype;
begin
  if actor is null or not private.is_aal2() then
    raise exception 'A verified MFA session is required.';
  end if;

  select *
  into target_item
  from public.inventory_items
  where id = target_item_id
  for update;

  if target_item.id is null then
    raise exception 'Inventory vehicle not found.';
  end if;
  if not private.is_dealership_member(target_item.dealership_id, actor) then
    raise exception 'You do not belong to this dealership.';
  end if;
  if target_item.lot_status = 'removed' then
    return;
  end if;
  if target_item.lot_status <> 'active' then
    raise exception 'Only an active vehicle can be removed.';
  end if;

  update public.inventory_items
  set lot_status = 'removed',
      removed_at = now()
  where id = target_item.id;

  insert into public.security_audit_events (
    actor_user_id,
    dealership_id,
    action,
    outcome,
    metadata
  ) values (
    actor,
    target_item.dealership_id,
    'inventory_vehicle_removed',
    'success',
    jsonb_build_object(
      'inventory_item_id', target_item.id,
      'vin_suffix', target_item.vin_suffix
    )
  );
end;
$$;

create or replace function public.restore_inventory_vehicle(
  target_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_item public.inventory_items%rowtype;
begin
  if actor is null or not private.is_aal2() then
    raise exception 'A verified MFA session is required.';
  end if;

  select *
  into target_item
  from public.inventory_items
  where id = target_item_id
  for update;

  if target_item.id is null then
    raise exception 'Inventory vehicle not found.';
  end if;
  if not private.is_dealership_member(target_item.dealership_id, actor) then
    raise exception 'You do not belong to this dealership.';
  end if;
  if target_item.lot_status = 'active' then
    return;
  end if;
  if target_item.lot_status <> 'removed' then
    raise exception 'Only a removed vehicle can be restored.';
  end if;

  update public.inventory_items
  set lot_status = 'active',
      removed_at = null
  where id = target_item.id;

  insert into public.security_audit_events (
    actor_user_id,
    dealership_id,
    action,
    outcome,
    metadata
  ) values (
    actor,
    target_item.dealership_id,
    'inventory_vehicle_restored',
    'success',
    jsonb_build_object(
      'inventory_item_id', target_item.id,
      'vin_suffix', target_item.vin_suffix
    )
  );
end;
$$;

create or replace function public.void_vehicle_scan(
  target_scan_id uuid,
  reason text default 'Mistaken scan'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_scan public.vehicle_scans%rowtype;
  normalized_reason text := left(trim(coalesce(reason, '')), 200);
begin
  if actor is null or not private.is_aal2() then
    raise exception 'A verified MFA session is required.';
  end if;
  if normalized_reason = '' then
    raise exception 'A reason is required.';
  end if;

  select *
  into target_scan
  from public.vehicle_scans
  where id = target_scan_id
  for update;

  if target_scan.id is null then
    raise exception 'Scan not found.';
  end if;
  if not private.is_dealership_member(target_scan.dealership_id, actor) then
    raise exception 'You do not belong to this dealership.';
  end if;
  if target_scan.voided_at is not null then
    return;
  end if;

  perform set_config('auditur.allow_scan_void', 'on', true);
  update public.vehicle_scans
  set voided_at = now(),
      voided_by = actor,
      void_reason = normalized_reason
  where id = target_scan.id;

  insert into public.security_audit_events (
    actor_user_id,
    dealership_id,
    action,
    outcome,
    metadata
  ) values (
    actor,
    target_scan.dealership_id,
    'vehicle_scan_voided',
    'success',
    jsonb_build_object(
      'vehicle_scan_id', target_scan.id,
      'vin_suffix', target_scan.vin_suffix,
      'reason', normalized_reason
    )
  );
end;
$$;

create or replace function public.void_scanned_vehicle(
  target_scan_id uuid,
  reason text default 'Vehicle deleted'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_scan public.vehicle_scans%rowtype;
  normalized_reason text := left(trim(coalesce(reason, '')), 200);
  affected_count integer;
begin
  if actor is null or not private.is_aal2() then
    raise exception 'A verified MFA session is required.';
  end if;
  if normalized_reason = '' then
    raise exception 'A reason is required.';
  end if;

  select *
  into target_scan
  from public.vehicle_scans
  where id = target_scan_id
  for update;

  if target_scan.id is null then
    raise exception 'Vehicle not found.';
  end if;
  if not private.is_dealership_member(target_scan.dealership_id, actor) then
    raise exception 'You do not belong to this dealership.';
  end if;

  perform set_config('auditur.allow_scan_void', 'on', true);
  update public.vehicle_scans
  set voided_at = now(),
      voided_by = actor,
      void_reason = normalized_reason
  where dealership_id = target_scan.dealership_id
    and vin_suffix = target_scan.vin_suffix
    and voided_at is null;
  get diagnostics affected_count = row_count;

  if affected_count = 0 then
    return;
  end if;

  insert into public.security_audit_events (
    actor_user_id,
    dealership_id,
    action,
    outcome,
    metadata
  ) values (
    actor,
    target_scan.dealership_id,
    'scanned_vehicle_deleted',
    'success',
    jsonb_build_object(
      'vehicle_scan_id', target_scan.id,
      'vin_suffix', target_scan.vin_suffix,
      'voided_scan_count', affected_count,
      'reason', normalized_reason
    )
  );
end;
$$;

drop policy if exists vehicle_scans_permission_read on public.vehicle_scans;
create policy vehicle_scans_permission_read
on public.vehicle_scans for select to authenticated
using (
  voided_at is null
  and (
    private.has_dealership_permission(dealership_id, 'view_dashboard')
    or private.has_dealership_permission(dealership_id, 'view_audit')
    or private.has_dealership_permission(dealership_id, 'view_vehicles')
    or private.has_dealership_permission(dealership_id, 'view_map')
    or private.has_dealership_permission(dealership_id, 'scan_vehicles')
  )
);

revoke all on function public.void_vehicle_scan(uuid, text) from public, anon;
grant execute on function public.void_vehicle_scan(uuid, text) to authenticated;
revoke all on function public.void_scanned_vehicle(uuid, text) from public, anon;
grant execute on function public.void_scanned_vehicle(uuid, text) to authenticated;

notify pgrst, 'reload schema';
