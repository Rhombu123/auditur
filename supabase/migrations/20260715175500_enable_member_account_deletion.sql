alter table public.inventory_uploads
  drop constraint if exists inventory_uploads_created_by_fkey,
  alter column created_by drop not null,
  add constraint inventory_uploads_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.dealership_roles
  drop constraint if exists dealership_roles_created_by_fkey,
  alter column created_by drop not null,
  add constraint dealership_roles_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

create or replace function private.protect_operational_provenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  service_anonymization boolean :=
    coalesce(auth.role(), '') = 'service_role';
begin
  if tg_table_name = 'inventory_uploads' and (
    new.dealership_id is distinct from old.dealership_id
    or (
      new.created_by is distinct from old.created_by
      and not (service_anonymization and new.created_by is null)
    )
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
    or (
      new.scanned_by is distinct from old.scanned_by
      and not (service_anonymization and new.scanned_by is null)
    )
    or new.scanned_at is distinct from old.scanned_at
  ) then
    raise exception 'Vehicle scan provenance is immutable.';
  elsif tg_table_name = 'lot_zones' and (
    new.dealership_id is distinct from old.dealership_id
    or (
      new.created_by is distinct from old.created_by
      and not (service_anonymization and new.created_by is null)
    )
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Lot zone provenance is immutable.';
  end if;
  return new;
end;
$$;
