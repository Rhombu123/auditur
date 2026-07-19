create or replace function private.protect_profile_authority_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id
    or new.auditur_id <> old.auditur_id
    or new.account_type <> old.account_type
    or new.created_at <> old.created_at
  then
    raise exception 'Profile authority fields cannot be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_profile_authority_fields
before update on public.profiles
for each row execute function private.protect_profile_authority_fields();

drop policy if exists profiles_authenticated_read on public.profiles;
create policy profiles_team_read
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or private.shares_dealership_with_user(user_id)
);

notify pgrst, 'reload schema';
