alter table public.inventory_items
  drop constraint if exists inventory_items_lot_status_check;
alter table public.inventory_items
  add constraint inventory_items_lot_status_check
  check (lot_status in ('active', 'sold', 'auctioned', 'removed'));

drop policy if exists vehicle_scans_permission_delete on public.vehicle_scans;
revoke delete on public.vehicle_scans from authenticated;

create or replace function private.prevent_vehicle_scan_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Vehicle scan logs are permanent and cannot be deleted.';
end;
$$;

drop trigger if exists prevent_vehicle_scan_delete on public.vehicle_scans;
create trigger prevent_vehicle_scan_delete
before delete on public.vehicle_scans
for each row execute function private.prevent_vehicle_scan_delete();

drop policy if exists inventory_items_permission_delete on public.inventory_items;
revoke delete on public.inventory_items from authenticated;

create or replace function private.is_dealership_owner_or_gm(
  target_dealership_id uuid,
  actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_dealership_owner(target_dealership_id, actor_user_id)
    or private.has_dealership_permission(
      target_dealership_id,
      'manage_dealership'::public.auditur_permission,
      actor_user_id
    );
$$;

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
  ) and not private.is_dealership_owner_or_gm(old.dealership_id) then
    raise exception 'Only a dealership owner or GM can change vehicle availability.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_inventory_vehicle_lifecycle
  on public.inventory_items;
create trigger protect_inventory_vehicle_lifecycle
before update on public.inventory_items
for each row execute function private.protect_inventory_vehicle_lifecycle();

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
  if not private.is_dealership_owner_or_gm(target_item.dealership_id, actor) then
    raise exception 'Only a dealership owner or GM can remove a vehicle.';
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
  if not private.is_dealership_owner_or_gm(target_item.dealership_id, actor) then
    raise exception 'Only a dealership owner or GM can restore a vehicle.';
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

revoke all on function public.remove_inventory_vehicle(uuid) from public, anon;
revoke all on function public.restore_inventory_vehicle(uuid) from public, anon;
grant execute on function public.remove_inventory_vehicle(uuid) to authenticated;
grant execute on function public.restore_inventory_vehicle(uuid) to authenticated;

notify pgrst, 'reload schema';
