-- PRD-00002: interpret_saved_report expires_at, retention config, refresh on membership change, pg_cron purge.

-- 1) expires_at column + backfill (O1: all rows saved_at + 7 days)
alter table public.interpret_saved_report
  add column if not exists expires_at timestamptz;

update public.interpret_saved_report
set expires_at = saved_at + interval '7 days'
where expires_at is null;

alter table public.interpret_saved_report
  alter column expires_at set not null;

create index if not exists interpret_saved_report_expires_at_idx
  on public.interpret_saved_report (expires_at);

create index if not exists interpret_saved_report_user_expires_at_idx
  on public.interpret_saved_report (user_id, expires_at);

comment on column public.interpret_saved_report.expires_at is
  'Report expiry; recomputed from saved_at + current membership retention days; refresh on membership change.';

-- 2) archive.retention_days config
insert into public.app_config_kv (config_key, config_value)
values (
  'archive.retention_days',
  '{"free_days": 7, "standard_days": 180}'::jsonb
)
on conflict (config_key) do nothing;

-- 3) Resolve retention days for a user (matches quota RPC standard check)
create or replace function public.resolve_archive_retention_days_for_user(p_user_id uuid)
returns int
language plpgsql
stable
set search_path = public
as $$
declare
  v_free_days int;
  v_std_days int;
  v_expires timestamptz;
  v_tier text;
begin
  select
    coalesce(
      case
        when (c.config_value->>'free_days') ~ '^[0-9]+$'
        then (c.config_value->>'free_days')::int
        else null
      end,
      7
    ),
    coalesce(
      case
        when (c.config_value->>'standard_days') ~ '^[0-9]+$'
        then (c.config_value->>'standard_days')::int
        else null
      end,
      180
    )
  into v_free_days, v_std_days
  from public.app_config_kv c
  where c.config_key = 'archive.retention_days';

  if not found then
    v_free_days := 7;
    v_std_days := 180;
  end if;

  select um.expires_at, um.tier
    into v_expires, v_tier
  from public.user_membership um
  where um.user_id = p_user_id;

  if found
    and v_tier = 'standard'
    and v_expires is not null
    and v_expires > now() then
    return v_std_days;
  end if;

  return v_free_days;
end;
$$;

comment on function public.resolve_archive_retention_days_for_user(uuid) is
  'Current archive retention days for user from membership + archive.retention_days config.';

revoke all on function public.resolve_archive_retention_days_for_user(uuid) from public;
grant execute on function public.resolve_archive_retention_days_for_user(uuid) to service_role;

-- 4) Refresh all reports for a user after membership change
create or replace function public.refresh_archive_expires_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int;
begin
  v_days := public.resolve_archive_retention_days_for_user(p_user_id);

  update public.interpret_saved_report r
  set expires_at = r.saved_at + (v_days || ' days')::interval
  where r.user_id = p_user_id;
end;
$$;

comment on function public.refresh_archive_expires_for_user(uuid) is
  'Recompute expires_at for all saved reports of user from saved_at + current retention days.';

revoke all on function public.refresh_archive_expires_for_user(uuid) from public;
grant execute on function public.refresh_archive_expires_for_user(uuid) to service_role;

-- 5) Trigger on user_membership changes
create or replace function public.trg_refresh_archive_expires_on_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_archive_expires_for_user(new.user_id);
  return new;
end;
$$;

drop trigger if exists refresh_archive_expires_on_membership on public.user_membership;

create trigger refresh_archive_expires_on_membership
  after insert or update on public.user_membership
  for each row
  execute function public.trg_refresh_archive_expires_on_membership();

-- 6) One-time: extend reports for users who are currently effective standard (O1 backfill was 7d only)
do $refresh_std$
declare
  r record;
begin
  for r in
    select um.user_id
    from public.user_membership um
    where um.tier = 'standard'
      and um.expires_at is not null
      and um.expires_at > now()
  loop
    perform public.refresh_archive_expires_for_user(r.user_id);
  end loop;
end
$refresh_std$;

-- 7) R1: pg_cron purge expired reports
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function public.purge_expired_interpret_saved_reports()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  delete from public.interpret_saved_report
  where expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.purge_expired_interpret_saved_reports() is
  'R1: delete reports past expires_at; interpret_share_link CASCADE.';

revoke all on function public.purge_expired_interpret_saved_reports() from public;
grant execute on function public.purge_expired_interpret_saved_reports() to service_role;

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'interpret-saved-report-purge') then
    perform cron.unschedule('interpret-saved-report-purge');
  end if;
end
$cron$;

select cron.schedule(
  'interpret-saved-report-purge',
  '0 3 * * *',
  $$ select public.purge_expired_interpret_saved_reports(); $$
);
