-- One row per auth.users in public.user_membership (ops/admin JOIN).
-- Free: tier = 'free', expires_at IS NULL. Paid: tier = 'standard', expires_at NOT NULL and > now() for 100/day cap.

alter table public.user_membership
  alter column expires_at drop not null;

alter table public.user_membership
  alter column tier set default 'free';

comment on table public.user_membership is
  'One row per auth user; tier free + expires_at null by default; standard + future expires_at = paid quota.';

-- Backfill existing auth users (idempotent).
insert into public.user_membership (user_id, activated_at, expires_at, tier)
select
  u.id,
  coalesce(u.created_at, now()),
  null,
  'free'
from auth.users u
where not exists (
  select 1 from public.user_membership m where m.user_id = u.id
);

-- Historical row repair (existing user_membership from before nullable expires_at / free tier).
-- 1) Free tier should not carry a paid expiry timestamp.
update public.user_membership
set
  expires_at = null,
  updated_at = now()
where tier = 'free'
  and expires_at is not null;

-- 2) Paid standard without expires_at is invalid for quota; normalize to free (re-grant via ops UPDATE).
update public.user_membership
set
  tier = 'free',
  expires_at = null,
  updated_at = now()
where tier = 'standard'
  and expires_at is null;

create or replace function public.handle_auth_user_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_membership (user_id, activated_at, expires_at, tier)
  values (
    new.id,
    coalesce(new.created_at, now()),
    null,
    'free'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

comment on function public.handle_auth_user_membership() is
  'After auth.users insert, ensure public.user_membership row exists (free tier).';

drop trigger if exists on_auth_user_created_membership on auth.users;

create trigger on_auth_user_created_membership
  after insert on auth.users
  for each row
  execute function public.handle_auth_user_membership();

-- Quota: 100/day only if standard + expires_at set + not expired.
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

  if not found then
    v_limit := 3;
  elsif v_tier = 'standard'
    and v_expires is not null
    and v_expires > now() then
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

  if found then
    v_is_active :=
      v_tier = 'standard'
      and v_expires is not null
      and v_expires > now();
    if v_is_active then
      v_effective_tier := 'standard';
      v_limit := 100;
    else
      v_effective_tier := 'free';
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
