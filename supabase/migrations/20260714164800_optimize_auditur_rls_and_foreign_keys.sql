create index vehicle_scans_scanned_by_idx
  on public.vehicle_scans (scanned_by);

create index lot_zones_created_by_idx
  on public.lot_zones (created_by);

alter policy vehicle_scans_authenticated_insert
on public.vehicle_scans
with check (scanned_by = (select auth.uid()));

alter policy lot_zones_authenticated_insert
on public.lot_zones
with check (created_by = (select auth.uid()));
