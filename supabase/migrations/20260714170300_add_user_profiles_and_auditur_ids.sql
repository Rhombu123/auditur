create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  auditur_id text not null unique check (auditur_id ~ '^[1-9][0-9]{8}$'),
  full_name text not null check (length(trim(full_name)) > 0),
  account_type text not null check (account_type in ('owner_gm', 'employee')),
  dealership_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_auditur_id_idx on public.profiles (auditur_id);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy profiles_authenticated_read
on public.profiles for select to authenticated using (true);

create policy profiles_update_self
on public.profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function private.allocate_auditur_id()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  loop
    candidate := floor(100000000 + random() * 900000000)::bigint::text;
    exit when not exists (
      select 1 from public.profiles where auditur_id = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function private.prepare_auditur_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_id text;
  role_name text;
begin
  assigned_id := private.allocate_auditur_id();
  role_name := case
    when new.raw_user_meta_data ->> 'account_type' in ('owner_gm', 'employee')
      then new.raw_user_meta_data ->> 'account_type'
    else 'employee'
  end;
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'auditur_id', assigned_id,
      'account_type', role_name
    );
  return new;
end;
$$;

create or replace function private.create_auditur_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    user_id,
    auditur_id,
    full_name,
    account_type,
    dealership_name
  ) values (
    new.id,
    new.raw_user_meta_data ->> 'auditur_id',
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1),
      'Member'
    ),
    new.raw_user_meta_data ->> 'account_type',
    nullif(trim(new.raw_user_meta_data ->> 'dealership_name'), '')
  );
  return new;
end;
$$;

create trigger prepare_auditur_user_before_insert
before insert on auth.users
for each row execute function private.prepare_auditur_user();

create trigger create_auditur_profile_after_insert
after insert on auth.users
for each row execute function private.create_auditur_profile();

do $$
declare
  existing_user auth.users%rowtype;
  assigned_id text;
  role_name text;
begin
  for existing_user in
    select *
    from auth.users
    where not exists (
      select 1 from public.profiles where user_id = auth.users.id
    )
  loop
    assigned_id := private.allocate_auditur_id();
    role_name := case
      when existing_user.raw_user_meta_data ->> 'account_type'
        in ('owner_gm', 'employee')
        then existing_user.raw_user_meta_data ->> 'account_type'
      else 'owner_gm'
    end;

    update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'auditur_id', assigned_id,
        'account_type', role_name
      )
    where id = existing_user.id;

    insert into public.profiles (
      user_id,
      auditur_id,
      full_name,
      account_type,
      dealership_name
    ) values (
      existing_user.id,
      assigned_id,
      coalesce(
        nullif(trim(existing_user.raw_user_meta_data ->> 'full_name'), ''),
        split_part(existing_user.email, '@', 1),
        'Member'
      ),
      role_name,
      nullif(trim(existing_user.raw_user_meta_data ->> 'dealership_name'), '')
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
