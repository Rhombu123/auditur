create type public.auditur_permission as enum (
  'view_dashboard',
  'view_audit',
  'view_vehicles',
  'scan_vehicles',
  'view_map',
  'manage_uploads',
  'export_audits',
  'manage_vehicles',
  'manage_map',
  'view_members',
  'manage_members',
  'manage_roles',
  'manage_dealership'
);

create table public.dealerships (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dealership_roles (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index dealership_roles_name_unique_idx
  on public.dealership_roles (dealership_id, lower(trim(name)));

create table public.dealership_role_permissions (
  role_id uuid not null references public.dealership_roles(id) on delete cascade,
  permission public.auditur_permission not null,
  primary key (role_id, permission)
);

create table public.dealership_members (
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_kind text not null default 'member'
    check (membership_kind in ('owner', 'member')),
  role_id uuid references public.dealership_roles(id) on delete set null,
  added_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (dealership_id, user_id)
);

alter table public.dealership_members
  add constraint dealership_members_user_profile_fk
  foreign key (user_id) references public.profiles(user_id) on delete cascade;

create index dealership_members_user_idx
  on public.dealership_members (user_id, joined_at desc);
create index dealership_members_role_idx
  on public.dealership_members (role_id) where role_id is not null;

create table public.user_dealership_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_dealership_id uuid references public.dealerships(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function private.is_dealership_member(
  target_dealership_id uuid,
  actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dealership_members
    where dealership_id = target_dealership_id
      and user_id = actor_user_id
  );
$$;

create or replace function private.is_dealership_owner(
  target_dealership_id uuid,
  actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dealership_members
    where dealership_id = target_dealership_id
      and user_id = actor_user_id
      and membership_kind = 'owner'
  );
$$;

create or replace function private.has_dealership_permission(
  target_dealership_id uuid,
  requested_permission public.auditur_permission,
  actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_dealership_owner(target_dealership_id, actor_user_id)
    or exists (
      select 1
      from public.dealership_members member
      join public.dealership_role_permissions role_permission
        on role_permission.role_id = member.role_id
      where member.dealership_id = target_dealership_id
        and member.user_id = actor_user_id
        and role_permission.permission = requested_permission
    );
$$;

create or replace function private.shares_dealership_with_user(
  other_user_id uuid,
  actor_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dealership_members mine
    join public.dealership_members theirs
      on theirs.dealership_id = mine.dealership_id
    where mine.user_id = actor_user_id
      and theirs.user_id = other_user_id
  );
$$;

create or replace function private.validate_member_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role_id is not null and not exists (
    select 1
    from public.dealership_roles
    where id = new.role_id
      and dealership_id = new.dealership_id
  ) then
    raise exception 'Role does not belong to this dealership.';
  end if;
  if new.membership_kind = 'owner' and new.role_id is not null then
    raise exception 'Owners cannot be assigned a custom role.';
  end if;
  return new;
end;
$$;

create trigger validate_dealership_member_role
before insert or update of dealership_id, membership_kind, role_id
on public.dealership_members
for each row execute function private.validate_member_role();

alter table public.dealerships enable row level security;
alter table public.dealership_roles enable row level security;
alter table public.dealership_role_permissions enable row level security;
alter table public.dealership_members enable row level security;
alter table public.user_dealership_preferences enable row level security;

revoke all on public.dealerships, public.dealership_roles,
  public.dealership_role_permissions, public.dealership_members,
  public.user_dealership_preferences from anon;
grant select on public.dealerships, public.dealership_roles,
  public.dealership_role_permissions, public.dealership_members to authenticated;
grant select, insert, update on public.user_dealership_preferences to authenticated;
grant all on public.dealerships, public.dealership_roles,
  public.dealership_role_permissions, public.dealership_members,
  public.user_dealership_preferences to service_role;

create policy dealerships_member_read
on public.dealerships for select to authenticated
using (private.is_dealership_member(id));

create policy dealership_roles_member_read
on public.dealership_roles for select to authenticated
using (private.is_dealership_member(dealership_id));

create policy dealership_role_permissions_member_read
on public.dealership_role_permissions for select to authenticated
using (
  exists (
    select 1
    from public.dealership_roles role
    where role.id = role_id
      and private.is_dealership_member(role.dealership_id)
  )
);

create policy dealership_members_team_read
on public.dealership_members for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_dealership_permission(dealership_id, 'view_members')
  or private.has_dealership_permission(dealership_id, 'manage_members')
  or private.has_dealership_permission(dealership_id, 'manage_roles')
);

create policy user_dealership_preferences_self_read
on public.user_dealership_preferences for select to authenticated
using (user_id = (select auth.uid()));

create policy user_dealership_preferences_self_insert
on public.user_dealership_preferences for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    active_dealership_id is null
    or private.is_dealership_member(active_dealership_id)
  )
);

create policy user_dealership_preferences_self_update
on public.user_dealership_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    active_dealership_id is null
    or private.is_dealership_member(active_dealership_id)
  )
);

create or replace function public.get_my_dealership_access()
returns table (
  dealership_id uuid,
  dealership_name text,
  membership_kind text,
  role_id uuid,
  role_name text,
  permissions text[],
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    dealership.id,
    dealership.name,
    member.membership_kind,
    role.id,
    role.name,
    case
      when member.membership_kind = 'owner' then enum_range(null::public.auditur_permission)::text[]
      else coalesce(
        array_agg(role_permission.permission::text)
          filter (where role_permission.permission is not null),
        array[]::text[]
      )
    end,
    preference.active_dealership_id = dealership.id
  from public.dealership_members member
  join public.dealerships dealership on dealership.id = member.dealership_id
  left join public.dealership_roles role on role.id = member.role_id
  left join public.dealership_role_permissions role_permission
    on role_permission.role_id = role.id
  left join public.user_dealership_preferences preference
    on preference.user_id = member.user_id
  where member.user_id = auth.uid()
  group by dealership.id, dealership.name, member.membership_kind,
    role.id, role.name, preference.active_dealership_id, member.joined_at
  order by (preference.active_dealership_id = dealership.id) desc,
    member.joined_at asc;
$$;

create or replace function public.create_dealership(dealership_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  created_id uuid;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if not exists (
    select 1 from public.profiles
    where user_id = actor and account_type = 'owner_gm'
  ) then
    raise exception 'Only an owner or GM account can create a dealership.';
  end if;
  if length(trim(dealership_name)) not between 1 and 120 then
    raise exception 'Dealership name is required.';
  end if;

  insert into public.dealerships (name, created_by)
  values (trim(dealership_name), actor)
  returning id into created_id;

  insert into public.dealership_members (
    dealership_id, user_id, membership_kind, added_by
  ) values (created_id, actor, 'owner', actor);

  insert into public.user_dealership_preferences (
    user_id, active_dealership_id, updated_at
  ) values (actor, created_id, now())
  on conflict (user_id) do update
    set active_dealership_id = excluded.active_dealership_id,
        updated_at = now();

  return created_id;
end;
$$;

create or replace function public.set_active_dealership(target_dealership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_dealership_member(target_dealership_id) then
    raise exception 'You do not belong to that dealership.';
  end if;
  insert into public.user_dealership_preferences (
    user_id, active_dealership_id, updated_at
  ) values (auth.uid(), target_dealership_id, now())
  on conflict (user_id) do update
    set active_dealership_id = excluded.active_dealership_id,
        updated_at = now();
end;
$$;

create or replace function public.add_dealership_member_by_auditur_id(
  target_dealership_id uuid,
  target_auditur_id text,
  target_role_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_user_id uuid;
begin
  if not private.has_dealership_permission(target_dealership_id, 'manage_members') then
    raise exception 'You do not have permission to add members.';
  end if;
  if target_auditur_id !~ '^[1-9][0-9]{8}$' then
    raise exception 'Enter a valid 9-digit Auditur ID.';
  end if;
  select user_id into target_user_id
  from public.profiles
  where auditur_id = target_auditur_id
    and account_type = 'employee';
  if target_user_id is null then
    raise exception 'No employee account was found for that Auditur ID.';
  end if;
  if target_role_id is not null and not exists (
    select 1 from public.dealership_roles
    where id = target_role_id and dealership_id = target_dealership_id
  ) then
    raise exception 'Role does not belong to this dealership.';
  end if;
  if target_role_id is not null
    and (
      not private.has_dealership_permission(target_dealership_id, 'manage_roles')
      or (
        not private.is_dealership_owner(target_dealership_id)
        and exists (
          select 1
          from public.dealership_role_permissions role_permission
          where role_permission.role_id = target_role_id
            and not private.has_dealership_permission(
              target_dealership_id, role_permission.permission
            )
        )
      )
    )
  then
    raise exception 'You cannot assign that role.';
  end if;

  insert into public.dealership_members (
    dealership_id, user_id, membership_kind, role_id, added_by
  ) values (
    target_dealership_id, target_user_id, 'member', target_role_id, actor
  );
  return target_user_id;
exception
  when unique_violation then
    raise exception 'That employee is already on this dealership team.';
end;
$$;

create or replace function public.assign_dealership_member_role(
  target_dealership_id uuid,
  target_user_id uuid,
  target_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_dealership_permission(target_dealership_id, 'manage_members')
    or not private.has_dealership_permission(target_dealership_id, 'manage_roles')
  then
    raise exception 'You do not have permission to assign roles.';
  end if;
  if target_role_id is not null and not exists (
    select 1 from public.dealership_roles
    where id = target_role_id and dealership_id = target_dealership_id
  ) then
    raise exception 'Role does not belong to this dealership.';
  end if;
  if target_role_id is not null
    and not private.is_dealership_owner(target_dealership_id)
    and exists (
      select 1
      from public.dealership_role_permissions role_permission
      where role_permission.role_id = target_role_id
        and not private.has_dealership_permission(
          target_dealership_id, role_permission.permission
        )
    )
  then
    raise exception 'You cannot assign that role.';
  end if;
  update public.dealership_members
  set role_id = target_role_id
  where dealership_id = target_dealership_id
    and user_id = target_user_id
    and membership_kind = 'member';
  if not found then raise exception 'Team member not found.'; end if;
end;
$$;

create or replace function public.remove_dealership_member(
  target_dealership_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_dealership_permission(target_dealership_id, 'manage_members') then
    raise exception 'You do not have permission to remove members.';
  end if;
  delete from public.dealership_members
  where dealership_id = target_dealership_id
    and user_id = target_user_id
    and membership_kind = 'member';
  if not found then raise exception 'Team member not found or owner cannot be removed.'; end if;
end;
$$;

create or replace function private.can_grant_dealership_permissions(
  target_dealership_id uuid,
  requested_permissions public.auditur_permission[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_dealership_owner(target_dealership_id)
    or (
      private.has_dealership_permission(target_dealership_id, 'manage_roles')
      and not exists (
        select 1
        from unnest(requested_permissions) permission
        where not private.has_dealership_permission(
          target_dealership_id, permission
        )
      )
    );
$$;

create or replace function public.create_dealership_role(
  target_dealership_id uuid,
  role_name text,
  requested_permissions text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
  permission_values public.auditur_permission[];
begin
  permission_values := coalesce(requested_permissions, array[]::text[])
    ::public.auditur_permission[];
  if not private.can_grant_dealership_permissions(
    target_dealership_id, permission_values
  ) then
    raise exception 'You cannot grant one or more selected permissions.';
  end if;
  insert into public.dealership_roles (
    dealership_id, name, created_by
  ) values (
    target_dealership_id, trim(role_name), auth.uid()
  ) returning id into created_id;
  insert into public.dealership_role_permissions (role_id, permission)
  select created_id, permission from unnest(permission_values) permission;
  return created_id;
end;
$$;

create or replace function public.update_dealership_role(
  target_dealership_id uuid,
  target_role_id uuid,
  role_name text,
  requested_permissions text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  permission_values public.auditur_permission[];
begin
  permission_values := coalesce(requested_permissions, array[]::text[])
    ::public.auditur_permission[];
  if not private.can_grant_dealership_permissions(
    target_dealership_id, permission_values
  ) then
    raise exception 'You cannot grant one or more selected permissions.';
  end if;
  update public.dealership_roles
  set name = trim(role_name), updated_at = now()
  where id = target_role_id and dealership_id = target_dealership_id;
  if not found then raise exception 'Role not found.'; end if;
  delete from public.dealership_role_permissions where role_id = target_role_id;
  insert into public.dealership_role_permissions (role_id, permission)
  select target_role_id, permission from unnest(permission_values) permission;
end;
$$;

create or replace function public.delete_dealership_role(
  target_dealership_id uuid,
  target_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_dealership_permission(target_dealership_id, 'manage_roles') then
    raise exception 'You do not have permission to delete roles.';
  end if;
  if not private.is_dealership_owner(target_dealership_id)
    and exists (
      select 1
      from public.dealership_role_permissions role_permission
      where role_permission.role_id = target_role_id
        and not private.has_dealership_permission(
          target_dealership_id, role_permission.permission
        )
    )
  then
    raise exception 'You cannot delete a role with permissions you do not have.';
  end if;
  delete from public.dealership_roles
  where id = target_role_id and dealership_id = target_dealership_id;
  if not found then raise exception 'Role not found.'; end if;
end;
$$;

revoke all on function public.get_my_dealership_access() from public, anon;
revoke all on function public.create_dealership(text) from public, anon;
revoke all on function public.set_active_dealership(uuid) from public, anon;
revoke all on function public.add_dealership_member_by_auditur_id(uuid, text, uuid)
  from public, anon;
revoke all on function public.assign_dealership_member_role(uuid, uuid, uuid)
  from public, anon;
revoke all on function public.remove_dealership_member(uuid, uuid)
  from public, anon;
revoke all on function public.create_dealership_role(uuid, text, text[])
  from public, anon;
revoke all on function public.update_dealership_role(uuid, uuid, text, text[])
  from public, anon;
revoke all on function public.delete_dealership_role(uuid, uuid)
  from public, anon;

grant execute on function public.get_my_dealership_access() to authenticated;
grant execute on function public.create_dealership(text) to authenticated;
grant execute on function public.set_active_dealership(uuid) to authenticated;
grant execute on function public.add_dealership_member_by_auditur_id(uuid, text, uuid)
  to authenticated;
grant execute on function public.assign_dealership_member_role(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.remove_dealership_member(uuid, uuid)
  to authenticated;
grant execute on function public.create_dealership_role(uuid, text, text[])
  to authenticated;
grant execute on function public.update_dealership_role(uuid, uuid, text, text[])
  to authenticated;
grant execute on function public.delete_dealership_role(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';
