-- Global server-side config: config_key + jsonb config_value (see docs/supabase-tables.md).
-- Replaces hardcoded 3/100 in interpret quota RPCs with interpret.daily_quota row (same defaults).

create table if not exists public.app_config_kv (
  config_key text not null primary key,
  config_value jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_config_kv is
  'Server-side tunables (key + JSON). Keys use dotted namespaces (e.g. interpret.daily_quota). RLS on without policies; Express/Vercel service_role only.';

comment on column public.app_config_kv.config_key is
  'Stable unique key; lowercase dotted namespace (domain.semantic).';

comment on column public.app_config_kv.config_value is
  'JSON payload; schema per config_key (documented in docs/supabase-tables.md).';

comment on column public.app_config_kv.updated_at is
  'Last write time; set by application or manual update.';

alter table public.app_config_kv enable row level security;

insert into public.app_config_kv (config_key, config_value)
values (
  'interpret.daily_quota',
  '{"free_daily_limit": 3, "standard_daily_limit": 100}'::jsonb
)
on conflict (config_key) do nothing;

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
  v_free_cap int;
  v_std_cap int;
begin
  v_day_bucket :=
    (date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai');
  v_resets_at := v_day_bucket + interval '1 day';

  select
    coalesce(
      case
        when (c.config_value->>'free_daily_limit') ~ '^[0-9]+$'
        then (c.config_value->>'free_daily_limit')::int
        else null
      end,
      3
    ),
    coalesce(
      case
        when (c.config_value->>'standard_daily_limit') ~ '^[0-9]+$'
        then (c.config_value->>'standard_daily_limit')::int
        else null
      end,
      100
    )
  into v_free_cap, v_std_cap
  from public.app_config_kv c
  where c.config_key = 'interpret.daily_quota';

  if not found then
    v_free_cap := 3;
    v_std_cap := 100;
  end if;

  select um.expires_at, um.tier
    into v_expires, v_tier
  from public.user_membership um
  where um.user_id = p_user_id;

  if not found then
    v_limit := v_free_cap;
  elsif v_tier = 'standard'
    and v_expires is not null
    and v_expires > now() then
    v_limit := v_std_cap;
  else
    v_limit := v_free_cap;
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
  v_free_cap int;
  v_std_cap int;
begin
  v_day_bucket :=
    (date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai');
  v_resets_at := v_day_bucket + interval '1 day';

  select
    coalesce(
      case
        when (c.config_value->>'free_daily_limit') ~ '^[0-9]+$'
        then (c.config_value->>'free_daily_limit')::int
        else null
      end,
      3
    ),
    coalesce(
      case
        when (c.config_value->>'standard_daily_limit') ~ '^[0-9]+$'
        then (c.config_value->>'standard_daily_limit')::int
        else null
      end,
      100
    )
  into v_free_cap, v_std_cap
  from public.app_config_kv c
  where c.config_key = 'interpret.daily_quota';

  if not found then
    v_free_cap := 3;
    v_std_cap := 100;
  end if;

  select um.expires_at, um.tier, um.activated_at
    into v_expires, v_tier, v_activated
  from public.user_membership um
  where um.user_id = p_user_id;

  if found then
    v_is_active :=
      v_tier = 'standard'
      and v_expires is not null
      and v_expires > now();
    if v_is_active then
      v_effective_tier := 'standard';
      v_limit := v_std_cap;
    else
      v_effective_tier := 'free';
      v_limit := v_free_cap;
    end if;
  else
    v_limit := v_free_cap;
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
