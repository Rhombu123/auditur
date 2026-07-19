create or replace function public.delete_inventory_upload(
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
    raise exception 'You do not have permission to delete inventory uploads.';
  end if;

  delete from public.inventory_items
  where upload_id = target_upload.id
    and dealership_id = target_upload.dealership_id;

  delete from public.inventory_uploads
  where id = target_upload.id
    and dealership_id = target_upload.dealership_id;
end;
$$;

revoke all on function public.delete_inventory_upload(uuid) from public, anon;
grant execute on function public.delete_inventory_upload(uuid) to authenticated;

notify pgrst, 'reload schema';
