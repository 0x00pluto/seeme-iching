-- 镜脉 · 续照 Seed：autosave 后异步预写；1 档案 : 1 seed；打开日选档拼装 daily，不扣解读额度。

create table if not exists public.interpret_mirror_thread_seed (
  report_id uuid primary key references public.interpret_saved_report (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  echo_text text,
  shift_by_day_offset jsonb,
  optional_prompt text,
  status text not null default 'pending',
  model_id text,
  error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interpret_mirror_thread_seed_status_check
    check (status in ('pending', 'ready', 'failed'))
);

create index if not exists interpret_mirror_thread_seed_user_updated_idx
  on public.interpret_mirror_thread_seed (user_id, updated_at desc);

comment on table public.interpret_mirror_thread_seed is
  '镜脉续照 Seed：autosave 后预写 echo + 7 档 shift + optional；仅 service_role 经服务端访问。';

alter table public.interpret_mirror_thread_seed enable row level security;
