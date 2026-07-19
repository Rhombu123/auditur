alter table public.inventory_uploads
  add column dealership_id uuid references public.dealerships(id) on delete cascade,
  add column created_by uuid references auth.users(id) on delete restrict;
alter table public.inventory_items
  add column dealership_id uuid references public.dealerships(id) on delete cascade;
alter table public.vehicle_scans
  add column dealership_id uuid references public.dealerships(id) on delete cascade;
alter table public.lot_zones
  add column dealership_id uuid references public.dealerships(id) on delete cascade;

do $$
declare
  initial_owner uuid;
  initial_dealership uuid;
  initial_name text;
  member_role uuid;
  manager_role uuid;
begin
  select profile.user_id,
    coalesce(nullif(trim(profile.dealership_name), ''), 'Auditur Dealership')
  into initial_owner, initial_name
  from public.profiles profile
  order by (profile.account_type = 'owner_gm') desc, profile.created_at asc
  limit 1;

  if initial_owner is null then
    if exists (select 1 from public.inventory_uploads)
      or exists (select 1 from public.inventory_items)
      or exists (select 1 from public.vehicle_scans)
      or exists (select 1 from public.lot_zones)
    then
      raise exception 'Legacy lot data exists but no profile can own its dealership.';
    end if;
    return;
  end if;

  insert into public.dealerships (name, created_by)
  values (initial_name, initial_owner)
  returning id into initial_dealership;

  insert into public.dealership_roles (dealership_id, name, created_by)
  values (initial_dealership, 'Team member', initial_owner)
  returning id into member_role;

  insert into public.dealership_role_permissions (role_id, permission)
  values
    (member_role, 'view_dashboard'),
    (member_role, 'view_audit'),
    (member_role, 'view_vehicles'),
    (member_role, 'scan_vehicles'),
    (member_role, 'view_map'),
    (member_role, 'view_members');

  insert into public.dealership_roles (dealership_id, name, created_by)
  values (initial_dealership, 'Manager', initial_owner)
  returning id into manager_role;

  insert into public.dealership_role_permissions (role_id, permission)
  select manager_role, permission
  from unnest(enum_range(null::public.auditur_permission)) permission
  where permission <> 'manage_dealership'::public.auditur_permission;

  insert into public.dealership_members (
    dealership_id, user_id, membership_kind, role_id, added_by
  ) values (
    initial_dealership, initial_owner, 'owner', null, initial_owner
  );

  insert into public.user_dealership_preferences (
    user_id, active_dealership_id
  ) values (
    initial_owner, initial_dealership
  )
  on conflict (user_id) do update
    set active_dealership_id = excluded.active_dealership_id,
        updated_at = now();

  update public.inventory_uploads
  set dealership_id = initial_dealership,
      created_by = initial_owner
  where dealership_id is null;

  update public.inventory_items item
  set dealership_id = upload.dealership_id
  from public.inventory_uploads upload
  where upload.id = item.upload_id
    and item.dealership_id is null;

  update public.vehicle_scans
  set dealership_id = initial_dealership
  where dealership_id is null;

  update public.lot_zones
  set dealership_id = initial_dealership
  where dealership_id is null;
end $$;

do $$
begin
  if exists (select 1 from public.inventory_uploads where dealership_id is null)
    or exists (select 1 from public.inventory_items where dealership_id is null)
    or exists (select 1 from public.vehicle_scans where dealership_id is null)
    or exists (select 1 from public.lot_zones where dealership_id is null)
  then
    raise exception 'Dealership backfill incomplete; refusing to enforce isolation.';
  end if;
end $$;

alter table public.inventory_uploads
  alter column dealership_id set not null,
  alter column created_by set not null;
alter table public.inventory_items alter column dealership_id set not null;
alter table public.vehicle_scans alter column dealership_id set not null;
alter table public.lot_zones alter column dealership_id set not null;

alter table public.inventory_uploads
  add constraint inventory_uploads_id_dealership_unique
  unique (id, dealership_id);
alter table public.inventory_items
  add constraint inventory_items_upload_dealership_fk
  foreign key (upload_id, dealership_id)
  references public.inventory_uploads(id, dealership_id)
  on delete cascade;

drop index if exists inventory_uploads_uploaded_at_idx;
drop index if exists inventory_items_upload_status_vin_idx;
drop index if exists vehicle_scans_vin_scanned_idx;
drop index if exists vehicle_scans_scanned_at_idx;
drop index if exists lot_zones_created_at_idx;

create index inventory_uploads_dealership_uploaded_idx
  on public.inventory_uploads (dealership_id, uploaded_at desc);
create index inventory_items_dealership_upload_status_vin_idx
  on public.inventory_items (dealership_id, upload_id, lot_status, vin_suffix);
create index vehicle_scans_dealership_vin_scanned_idx
  on public.vehicle_scans (dealership_id, vin_suffix, scanned_at desc);
create index vehicle_scans_dealership_scanned_idx
  on public.vehicle_scans (dealership_id, scanned_at desc);
create index lot_zones_dealership_created_idx
  on public.lot_zones (dealership_id, created_at);

drop policy if exists inventory_uploads_authenticated_read on public.inventory_uploads;
drop policy if exists inventory_uploads_authenticated_delete on public.inventory_uploads;
drop policy if exists inventory_items_authenticated_read on public.inventory_items;
drop policy if exists inventory_items_authenticated_update on public.inventory_items;
drop policy if exists inventory_items_authenticated_delete on public.inventory_items;
drop policy if exists vehicle_scans_authenticated_read on public.vehicle_scans;
drop policy if exists vehicle_scans_authenticated_insert on public.vehicle_scans;
drop policy if exists vehicle_scans_authenticated_update on public.vehicle_scans;
drop policy if exists vehicle_scans_authenticated_delete on public.vehicle_scans;
drop policy if exists lot_zones_authenticated_read on public.lot_zones;
drop policy if exists lot_zones_authenticated_insert on public.lot_zones;
drop policy if exists lot_zones_authenticated_update on public.lot_zones;
drop policy if exists lot_zones_authenticated_delete on public.lot_zones;

grant select, insert, delete on public.inventory_uploads to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;

create policy inventory_uploads_permission_read
on public.inventory_uploads for select to authenticated
using (
  private.has_dealership_permission(dealership_id, 'view_dashboard')
  or private.has_dealership_permission(dealership_id, 'view_audit')
  or private.has_dealership_permission(dealership_id, 'view_vehicles')
  or private.has_dealership_permission(dealership_id, 'manage_uploads')
  or private.has_dealership_permission(dealership_id, 'export_audits')
);

create policy inventory_uploads_permission_insert
on public.inventory_uploads for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_dealership_permission(dealership_id, 'manage_uploads')
);

create policy inventory_uploads_permission_delete
on public.inventory_uploads for delete to authenticated
using (private.has_dealership_permission(dealership_id, 'manage_uploads'));

create policy inventory_items_permission_read
on public.inventory_items for select to authenticated
using (
  private.has_dealership_permission(dealership_id, 'view_dashboard')
  or private.has_dealership_permission(dealership_id, 'view_audit')
  or private.has_dealership_permission(dealership_id, 'view_vehicles')
  or private.has_dealership_permission(dealership_id, 'manage_uploads')
  or private.has_dealership_permission(dealership_id, 'export_audits')
);

create policy inventory_items_permission_insert
on public.inventory_items for insert to authenticated
with check (
  private.has_dealership_permission(dealership_id, 'manage_uploads')
);

create policy inventory_items_permission_update
on public.inventory_items for update to authenticated
using (private.has_dealership_permission(dealership_id, 'manage_vehicles'))
with check (private.has_dealership_permission(dealership_id, 'manage_vehicles'));

create policy inventory_items_permission_delete
on public.inventory_items for delete to authenticated
using (
  private.has_dealership_permission(dealership_id, 'manage_uploads')
  or private.has_dealership_permission(dealership_id, 'manage_vehicles')
);

create policy vehicle_scans_permission_read
on public.vehicle_scans for select to authenticated
using (
  private.has_dealership_permission(dealership_id, 'view_dashboard')
  or private.has_dealership_permission(dealership_id, 'view_audit')
  or private.has_dealership_permission(dealership_id, 'view_vehicles')
  or private.has_dealership_permission(dealership_id, 'view_map')
  or private.has_dealership_permission(dealership_id, 'scan_vehicles')
);

create policy vehicle_scans_permission_insert
on public.vehicle_scans for insert to authenticated
with check (
  scanned_by = (select auth.uid())
  and private.has_dealership_permission(dealership_id, 'scan_vehicles')
);

create policy vehicle_scans_permission_update
on public.vehicle_scans for update to authenticated
using (private.has_dealership_permission(dealership_id, 'manage_vehicles'))
with check (private.has_dealership_permission(dealership_id, 'manage_vehicles'));

create policy vehicle_scans_permission_delete
on public.vehicle_scans for delete to authenticated
using (private.has_dealership_permission(dealership_id, 'manage_vehicles'));

create policy lot_zones_permission_read
on public.lot_zones for select to authenticated
using (
  private.has_dealership_permission(dealership_id, 'view_dashboard')
  or private.has_dealership_permission(dealership_id, 'view_audit')
  or private.has_dealership_permission(dealership_id, 'view_map')
  or private.has_dealership_permission(dealership_id, 'export_audits')
);

create policy lot_zones_permission_insert
on public.lot_zones for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_dealership_permission(dealership_id, 'manage_map')
);

create policy lot_zones_permission_update
on public.lot_zones for update to authenticated
using (private.has_dealership_permission(dealership_id, 'manage_map'))
with check (private.has_dealership_permission(dealership_id, 'manage_map'));

create policy lot_zones_permission_delete
on public.lot_zones for delete to authenticated
using (private.has_dealership_permission(dealership_id, 'manage_map'));

drop policy if exists price_lists_authenticated_read on storage.objects;
drop policy if exists price_lists_authenticated_delete on storage.objects;

create policy price_lists_dealership_read
on storage.objects for select to authenticated
using (
  bucket_id = 'price-lists'
  and exists (
    select 1
    from public.dealership_members member
    where member.user_id = (select auth.uid())
      and (
        member.dealership_id::text = split_part(name, '/', 1)
        or exists (
          select 1
          from public.inventory_uploads upload
          where upload.dealership_id = member.dealership_id
            and upload.storage_path = name
        )
      )
      and (
        private.has_dealership_permission(member.dealership_id, 'manage_uploads')
        or private.has_dealership_permission(member.dealership_id, 'export_audits')
      )
  )
);

create policy price_lists_dealership_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'price-lists'
  and exists (
    select 1
    from public.dealership_members member
    where member.user_id = (select auth.uid())
      and member.dealership_id::text = split_part(name, '/', 1)
      and private.has_dealership_permission(member.dealership_id, 'manage_uploads')
  )
);

create policy price_lists_dealership_update
on storage.objects for update to authenticated
using (
  bucket_id = 'price-lists'
  and exists (
    select 1
    from public.dealership_members member
    where member.user_id = (select auth.uid())
      and member.dealership_id::text = split_part(name, '/', 1)
      and private.has_dealership_permission(member.dealership_id, 'manage_uploads')
  )
)
with check (
  bucket_id = 'price-lists'
  and exists (
    select 1
    from public.dealership_members member
    where member.user_id = (select auth.uid())
      and member.dealership_id::text = split_part(name, '/', 1)
      and private.has_dealership_permission(member.dealership_id, 'manage_uploads')
  )
);

create policy price_lists_dealership_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'price-lists'
  and exists (
    select 1
    from public.dealership_members member
    where member.user_id = (select auth.uid())
      and (
        member.dealership_id::text = split_part(name, '/', 1)
        or exists (
          select 1
          from public.inventory_uploads upload
          where upload.dealership_id = member.dealership_id
            and upload.storage_path = name
        )
      )
      and private.has_dealership_permission(member.dealership_id, 'manage_uploads')
  )
);

notify pgrst, 'reload schema';
