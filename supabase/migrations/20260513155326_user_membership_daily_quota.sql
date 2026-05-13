-- Membership row + daily interpret usage (Asia/Shanghai calendar day).
-- RLS on, no policies: only service_role via server/supabase-client.ts.

create table if not exists public.user_membership (
  user_id uuid not null primary key references auth.users (id) on delete cascade,
  activated_at timestamptz not null,
  expires_at timestamptz not null,
  tier text not null,
  updated_at timestamptz not null default now()
);

comment on table public.user_membership is 'Paid tier and expiry; effective free when missing or expires_at <= now().';

create table if not exists public.interpret_usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day_bucket timestamptz not null,
  request_count int not null default 0,
  primary key (user_id, day_bucket)
);

comment on table public.interpret_usage_daily is 'Interpret stream consumption per user per Asia/Shanghai calendar day (day_bucket = local midnight instant).';

alter table public.user_membership enable row level security;
alter table public.interpret_usage_daily enable row level security;

-- Atomically increment if below daily limit; limit from membership tier (standard=100 else 3).
create or replace function public.consume_interpret_quota(p_user_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_day_bucket timestamptz;
  v_resets_at timestamptz;
  v_expires timestamptz;
  v_tier text;
  v_limit int;
  v_new_count int;
  v_used int;
begin
  v_day_bucket :=
    (date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai');
  v_resets_at := v_day_bucket + interval '1 day';

  select um.expires_at, um.tier
    into v_expires, v_tier
  from public.user_membership um
  where um.user_id = p_user_id;

  if found and v_expires > now() and v_tier = 'standard' then
    v_limit := 100;
  else
    v_limit := 3;
  end if;

  insert into public.interpret_usage_daily (user_id, day_bucket, request_count)
  values (p_user_id, v_day_bucket, 0)
  on conflict (user_id, day_bucket) do nothing;

  update public.interpret_usage_daily u
     set request_count = u.request_count + 1
   where u.user_id = p_user_id
     and u.day_bucket = v_day_bucket
     and u.request_count < v_limit
  returning u.request_count into v_new_count;

  if v_new_count is not null then
    return jsonb_build_object(
      'ok', true,
      'limit', v_limit,
      'used', v_new_count,
      'resets_at', to_jsonb(v_resets_at)
    );
  end if;

  select u.request_count
    into v_used
  from public.interpret_usage_daily u
  where u.user_id = p_user_id
    and u.day_bucket = v_day_bucket;

  return jsonb_build_object(
    'ok', false,
    'limit', v_limit,
    'used', coalesce(v_used, 0),
    'resets_at', to_jsonb(v_resets_at)
  );
end;
$$;

comment on function public.consume_interpret_quota(uuid) is 'Increment interpret_usage_daily if under tier daily cap; returns ok and counters.';

-- Snapshot for GET /api/auth/me (no consume).
create or replace function public.get_interpret_entitlements_snapshot(p_user_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_day_bucket timestamptz;
  v_resets_at timestamptz;
  v_limit int;
  v_used int;
  v_expires timestamptz;
  v_tier text;
  v_activated timestamptz;
  v_is_active boolean := false;
  v_effective_tier text := 'free';
begin
  v_day_bucket :=
    (date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai');
  v_resets_at := v_day_bucket + interval '1 day';

  select um.expires_at, um.tier, um.activated_at
    into v_expires, v_tier, v_activated
  from public.user_membership um
  where um.user_id = p_user_id;

  if found and v_expires > now() then
    v_is_active := true;
    v_effective_tier := v_tier;
    if v_tier = 'standard' then
      v_limit := 100;
    else
      v_limit := 3;
    end if;
  else
    v_limit := 3;
    v_effective_tier := 'free';
  end if;

  select coalesce(u.request_count, 0)
    into v_used
  from public.interpret_usage_daily u
  where u.user_id = p_user_id
    and u.day_bucket = v_day_bucket;

  if not found then
    v_used := 0;
  end if;

  return jsonb_build_object(
    'interpret', jsonb_build_object(
      'period', 'day',
      'timezone', 'Asia/Shanghai',
      'calendar', 'Asia/Shanghai',
      'limit', v_limit,
      'used', v_used,
      'resetsAt', v_resets_at
    ),
    'membership', jsonb_build_object(
      'isActive', v_is_active,
      'tierCode', v_effective_tier,
      'activatedAt', case when v_is_active then to_jsonb(v_activated) else 'null'::jsonb end,
      'expiresAt', case when v_is_active then to_jsonb(v_expires) else 'null'::jsonb end
    )
  );
end;
$$;

comment on function public.get_interpret_entitlements_snapshot(uuid) is 'Read-only entitlements for /api/auth/me.';

grant execute on function public.consume_interpret_quota(uuid) to service_role;
grant execute on function public.get_interpret_entitlements_snapshot(uuid) to service_role;
