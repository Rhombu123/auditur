create or replace function private.sync_auditur_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set
    full_name = coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      full_name
    ),
    dealership_name = nullif(
      trim(new.raw_user_meta_data ->> 'dealership_name'),
      ''
    ),
    updated_at = now()
  where user_id = new.id;
  return new;
end;
$$;

create trigger sync_auditur_profile_after_metadata_update
after update of raw_user_meta_data on auth.users
for each row
when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
execute function private.sync_auditur_profile();
