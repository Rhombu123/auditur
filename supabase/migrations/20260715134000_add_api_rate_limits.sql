create table public.api_rate_limits (
  route text not null,
  rate_key_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null,
  primary key (route, rate_key_hash)
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public, anon, authenticated;
grant all on public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  target_route text,
  target_key_hash text,
  target_window_seconds integer,
  target_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_count integer;
begin
  if target_window_seconds not between 1 and 86400
    or target_max_requests not between 1 and 10000
    or length(target_route) not between 1 and 80
    or length(target_key_hash) <> 64
  then
    raise exception 'Invalid rate-limit parameters.';
  end if;

  insert into public.api_rate_limits (
    route, rate_key_hash, window_started_at, request_count, expires_at
  ) values (
    target_route,
    target_key_hash,
    now(),
    1,
    now() + make_interval(secs => target_window_seconds)
  )
  on conflict (route, rate_key_hash) do update set
    window_started_at = case
      when public.api_rate_limits.expires_at <= now() then now()
      else public.api_rate_limits.window_started_at
    end,
    request_count = case
      when public.api_rate_limits.expires_at <= now() then 1
      else public.api_rate_limits.request_count + 1
    end,
    expires_at = case
      when public.api_rate_limits.expires_at <= now()
        then now() + make_interval(secs => target_window_seconds)
      else public.api_rate_limits.expires_at
    end
  returning request_count into next_count;

  return next_count <= target_max_requests;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;
