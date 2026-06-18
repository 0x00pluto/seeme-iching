-- 镜脉 · 今日续照：东八区自然日幂等一条；懒生成，不扣解读额度。

create table if not exists public.interpret_mirror_thread_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  insight_date date not null,
  source_report_id uuid not null references public.interpret_saved_report (id) on delete cascade,
  echo_text text not null,
  shift_text text not null,
  optional_prompt text,
  created_at timestamptz not null default now(),
  constraint interpret_mirror_thread_daily_user_date_unique unique (user_id, insight_date)
);

create index if not exists interpret_mirror_thread_daily_user_insight_date_idx
  on public.interpret_mirror_thread_daily (user_id, insight_date desc);

comment on table public.interpret_mirror_thread_daily is
  '镜脉今日续照：按东八区自然日 (user_id, insight_date) 幂等一条；仅 service_role 经服务端访问。';

alter table public.interpret_mirror_thread_daily enable row level security;
