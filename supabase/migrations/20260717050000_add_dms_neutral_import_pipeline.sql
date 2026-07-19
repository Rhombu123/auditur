alter table public.inventory_items
  add column if not exists vin text,
  add column if not exists stock_number text,
  add column if not exists make text,
  add column if not exists source_status text;

alter table public.inventory_items
  drop constraint if exists inventory_items_vin_check,
  add constraint inventory_items_vin_check
    check (vin is null or vin ~ '^[A-Z0-9]{17}$');

alter table public.inventory_uploads
  add column if not exists file_format text not null default 'pdf',
  add column if not exists source_system text not null default 'unknown',
  add column if not exists import_method text not null default 'manual',
  add column if not exists parser_metadata jsonb not null default '{}'::jsonb,
  add column if not exists import_warnings jsonb not null default '[]'::jsonb;

alter table public.inventory_uploads
  drop constraint if exists inventory_uploads_file_format_check,
  add constraint inventory_uploads_file_format_check
    check (file_format in ('pdf', 'csv')),
  drop constraint if exists inventory_uploads_import_method_check,
  add constraint inventory_uploads_import_method_check
    check (import_method in ('manual')),
  drop constraint if exists inventory_uploads_parser_metadata_check,
  add constraint inventory_uploads_parser_metadata_check
    check (jsonb_typeof(parser_metadata) = 'object'),
  drop constraint if exists inventory_uploads_import_warnings_check,
  add constraint inventory_uploads_import_warnings_check
    check (jsonb_typeof(import_warnings) = 'array');

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel'
]
where id = 'price-lists';

drop trigger if exists archive_previous_inventory_upload
  on public.inventory_uploads;
drop function if exists private.archive_previous_inventory_upload();

create or replace function public.activate_inventory_import(
  target_upload_id uuid,
  target_dealership_id uuid,
  target_created_by uuid,
  target_file_name text,
  target_storage_path text,
  target_file_format text,
  target_source_system text,
  target_import_method text,
  target_parser_metadata jsonb,
  target_import_warnings jsonb,
  target_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  inserted_count integer;
begin
  if not is_service_role then
    if actor is null or actor is distinct from target_created_by then
      raise exception 'Authenticated upload owner does not match the request.';
    end if;
    if not private.is_aal2() then
      raise exception 'A verified MFA session is required.';
    end if;
    if not private.has_dealership_permission(
      target_dealership_id,
      'manage_uploads'::public.auditur_permission,
      actor
    ) then
      raise exception 'You do not have permission to manage inventory uploads.';
    end if;
  end if;

  if target_upload_id is null
    or target_dealership_id is null
    or target_created_by is null
    or length(trim(target_file_name)) = 0
  then
    raise exception 'Import provenance is incomplete.';
  end if;
  if target_file_format not in ('pdf', 'csv') then
    raise exception 'Unsupported import file format.';
  end if;
  if target_import_method <> 'manual' then
    raise exception 'Unsupported import method.';
  end if;
  if target_storage_path is not null
    and target_storage_path not like (
      target_dealership_id::text || '/' || target_upload_id::text || '/%'
    )
  then
    raise exception 'Stored file path does not match the import.';
  end if;
  if jsonb_typeof(target_parser_metadata) <> 'object'
    or jsonb_typeof(target_import_warnings) <> 'array'
  then
    raise exception 'Invalid import metadata.';
  end if;
  if jsonb_typeof(target_items) <> 'array'
    or jsonb_array_length(target_items) = 0
  then
    raise exception 'An import must contain at least one vehicle.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_dealership_id::text, 0)
  );

  update public.inventory_uploads
  set archived_at = clock_timestamp()
  where dealership_id = target_dealership_id
    and archived_at is null;

  insert into public.inventory_uploads (
    id,
    dealership_id,
    created_by,
    file_name,
    item_count,
    storage_path,
    file_format,
    source_system,
    import_method,
    parser_metadata,
    import_warnings
  )
  values (
    target_upload_id,
    target_dealership_id,
    target_created_by,
    trim(target_file_name),
    jsonb_array_length(target_items),
    target_storage_path,
    target_file_format,
    coalesce(nullif(trim(target_source_system), ''), 'unknown'),
    target_import_method,
    target_parser_metadata,
    target_import_warnings
  );

  insert into public.inventory_items (
    upload_id,
    dealership_id,
    vin,
    vin_suffix,
    stock_number,
    make,
    model,
    color,
    source_status,
    days_on_lot,
    miles,
    year
  )
  select
    target_upload_id,
    target_dealership_id,
    nullif(upper(trim(item.vin)), ''),
    upper(trim(item.vin_suffix)),
    nullif(trim(item.stock_number), ''),
    nullif(trim(item.make), ''),
    coalesce(nullif(trim(item.model), ''), 'Unknown'),
    coalesce(nullif(trim(item.color), ''), 'Unknown'),
    nullif(trim(item.source_status), ''),
    item.days_on_lot,
    item.miles,
    item.year
  from jsonb_to_recordset(target_items) as item(
    vin text,
    vin_suffix text,
    stock_number text,
    make text,
    model text,
    color text,
    source_status text,
    days_on_lot integer,
    miles integer,
    year integer
  );

  get diagnostics inserted_count = row_count;
  if inserted_count <> jsonb_array_length(target_items) then
    raise exception 'Not all import rows were stored.';
  end if;

  return target_upload_id;
end;
$$;

revoke all on public.inventory_uploads, public.inventory_items
  from authenticated;
grant select on public.inventory_uploads, public.inventory_items
  to authenticated;
grant update on public.inventory_items to authenticated;

drop policy if exists inventory_uploads_permission_insert
  on public.inventory_uploads;
drop policy if exists inventory_uploads_permission_delete
  on public.inventory_uploads;
drop policy if exists inventory_items_permission_insert
  on public.inventory_items;

revoke all on function public.activate_inventory_import(
  uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.activate_inventory_import(
  uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb
) to authenticated, service_role;

notify pgrst, 'reload schema';
