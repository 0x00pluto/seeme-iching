-- 镜脉 · 回笔：东八区自然日 (user_id, insight_date) 幂等一条；绑定当日续照 daily_id。

create table if not exists public.interpret_mirror_thread_reply (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  insight_date date not null,
  daily_id uuid not null references public.interpret_mirror_thread_daily (id) on delete cascade,
  reply_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interpret_mirror_thread_reply_user_date_unique unique (user_id, insight_date)
);

create index if not exists interpret_mirror_thread_reply_user_insight_date_idx
  on public.interpret_mirror_thread_reply (user_id, insight_date desc);

comment on table public.interpret_mirror_thread_reply is
  '镜脉回笔：用户对当日续照的可选短回应；(user_id, insight_date) 与 daily 1:1；仅 service_role 经服务端访问。';

alter table public.interpret_mirror_thread_reply enable row level security;
