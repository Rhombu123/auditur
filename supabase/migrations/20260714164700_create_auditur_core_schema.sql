create table public.inventory_uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text not null check (length(trim(file_name)) > 0),
  uploaded_at timestamptz not null default now(),
  item_count integer not null default 0 check (item_count >= 0),
  storage_path text
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.inventory_uploads(id) on delete cascade,
  vin_suffix text not null check (length(trim(vin_suffix)) between 6 and 17),
  model text not null default 'Unknown',
  color text not null default 'Unknown',
  days_on_lot integer check (days_on_lot is null or days_on_lot >= 0),
  miles integer check (miles is null or miles >= 0),
  year integer check (year is null or year between 1886 and 2200),
  lot_status text not null default 'active'
    check (lot_status in ('active', 'sold', 'auctioned')),
  removed_at timestamptz,
  unique (upload_id, vin_suffix)
);

create table public.vehicle_scans (
  id uuid primary key default gen_random_uuid(),
  vin text,
  vin_suffix text not null check (length(trim(vin_suffix)) between 6 and 17),
  raw_value text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision check (accuracy is null or accuracy >= 0),
  model text,
  color text,
  days_on_lot integer check (days_on_lot is null or days_on_lot >= 0),
  matched boolean not null default false,
  scanned_by uuid references auth.users(id) on delete set null,
  scanner_email text,
  scanned_at timestamptz not null default now(),
  lot_status text not null default 'active'
    check (lot_status in ('active', 'sold', 'auctioned'))
);

create table public.lot_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  coordinates jsonb not null,
  fill_color text not null,
  stroke_color text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index inventory_uploads_uploaded_at_idx
  on public.inventory_uploads (uploaded_at desc);
create index inventory_items_upload_status_vin_idx
  on public.inventory_items (upload_id, lot_status, vin_suffix);
create index vehicle_scans_vin_scanned_idx
  on public.vehicle_scans (vin_suffix, scanned_at desc);
create index vehicle_scans_scanned_at_idx
  on public.vehicle_scans (scanned_at desc);
create index lot_zones_created_at_idx
  on public.lot_zones (created_at);

alter table public.inventory_uploads enable row level security;
alter table public.inventory_items enable row level security;
alter table public.vehicle_scans enable row level security;
alter table public.lot_zones enable row level security;

revoke all on public.inventory_uploads from anon;
revoke all on public.inventory_items from anon;
revoke all on public.vehicle_scans from anon;
revoke all on public.lot_zones from anon;

grant select, delete on public.inventory_uploads to authenticated;
grant select, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.vehicle_scans to authenticated;
grant select, insert, update, delete on public.lot_zones to authenticated;
grant all on public.inventory_uploads, public.inventory_items,
  public.vehicle_scans, public.lot_zones to service_role;

create policy inventory_uploads_authenticated_read
on public.inventory_uploads for select to authenticated using (true);

create policy inventory_uploads_authenticated_delete
on public.inventory_uploads for delete to authenticated using (true);

create policy inventory_items_authenticated_read
on public.inventory_items for select to authenticated using (true);

create policy inventory_items_authenticated_update
on public.inventory_items for update to authenticated
using (true) with check (true);

create policy inventory_items_authenticated_delete
on public.inventory_items for delete to authenticated using (true);

create policy vehicle_scans_authenticated_read
on public.vehicle_scans for select to authenticated using (true);

create policy vehicle_scans_authenticated_insert
on public.vehicle_scans for insert to authenticated
with check (scanned_by = auth.uid());

create policy vehicle_scans_authenticated_update
on public.vehicle_scans for update to authenticated
using (true) with check (true);

create policy vehicle_scans_authenticated_delete
on public.vehicle_scans for delete to authenticated using (true);

create policy lot_zones_authenticated_read
on public.lot_zones for select to authenticated using (true);

create policy lot_zones_authenticated_insert
on public.lot_zones for insert to authenticated
with check (created_by = auth.uid());

create policy lot_zones_authenticated_update
on public.lot_zones for update to authenticated
using (true) with check (true);

create policy lot_zones_authenticated_delete
on public.lot_zones for delete to authenticated using (true);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'price-lists',
  'price-lists',
  false,
  20971520,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy price_lists_authenticated_read
on storage.objects for select to authenticated
using (bucket_id = 'price-lists');

create policy price_lists_authenticated_delete
on storage.objects for delete to authenticated
using (bucket_id = 'price-lists');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_uploads'
  ) then
    alter publication supabase_realtime add table public.inventory_uploads;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_items'
  ) then
    alter publication supabase_realtime add table public.inventory_items;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vehicle_scans'
  ) then
    alter publication supabase_realtime add table public.vehicle_scans;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lot_zones'
  ) then
    alter publication supabase_realtime add table public.lot_zones;
  end if;
end $$;

notify pgrst, 'reload schema';
