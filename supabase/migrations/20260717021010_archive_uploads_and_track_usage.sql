alter table public.inventory_uploads
  add column if not exists archived_at timestamptz;

alter table public.vehicle_scans
  add column if not exists inventory_upload_id uuid
  references public.inventory_uploads(id) on delete set null;

with upload_order as (
  select
    id,
    lead(uploaded_at) over (
      partition by dealership_id
      order by uploaded_at asc
    ) as next_uploaded_at
  from public.inventory_uploads
)
update public.inventory_uploads upload
set archived_at = upload_order.next_uploaded_at
from upload_order
where upload.id = upload_order.id
  and upload.archived_at is null
  and upload_order.next_uploaded_at is not null;

update public.vehicle_scans scan
set inventory_upload_id = (
  select upload.id
  from public.inventory_uploads upload
  where upload.dealership_id = scan.dealership_id
    and upload.uploaded_at <= scan.scanned_at
  order by upload.uploaded_at desc
  limit 1
)
where scan.inventory_upload_id is null;

create unique index if not exists inventory_uploads_one_active_per_dealership_idx
  on public.inventory_uploads (dealership_id)
  where archived_at is null;

create index if not exists vehicle_scans_inventory_upload_scanned_idx
  on public.vehicle_scans (inventory_upload_id, scanned_at desc)
  where inventory_upload_id is not null;

create or replace function private.archive_previous_inventory_upload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.inventory_uploads
  set archived_at = clock_timestamp()
  where dealership_id = new.dealership_id
    and archived_at is null;
  return new;
end;
$$;

drop trigger if exists archive_previous_inventory_upload
  on public.inventory_uploads;
create trigger archive_previous_inventory_upload
before insert on public.inventory_uploads
for each row execute function private.archive_previous_inventory_upload();

create or replace function public.archive_inventory_upload(
  target_upload_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_upload public.inventory_uploads%rowtype;
begin
  if actor is null or not private.is_aal2() then
    raise exception 'A verified MFA session is required.';
  end if;

  select *
  into target_upload
  from public.inventory_uploads
  where id = target_upload_id
  for update;

  if not found then
    raise exception 'Inventory upload not found.';
  end if;

  if not private.has_dealership_permission(
    target_upload.dealership_id,
    'manage_uploads'::public.auditur_permission,
    actor
  ) then
    raise exception 'You do not have permission to manage inventory uploads.';
  end if;

  update public.inventory_uploads
  set archived_at = coalesce(archived_at, clock_timestamp())
  where id = target_upload.id;
end;
$$;

revoke all on function public.archive_inventory_upload(uuid)
  from public, anon;
grant execute on function public.archive_inventory_upload(uuid)
  to authenticated;

notify pgrst, 'reload schema';
