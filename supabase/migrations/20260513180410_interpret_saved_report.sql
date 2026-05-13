-- 观心报告（已保存解读）持久化。
-- 表名遵循 public 下约定：interpret_* 与主解读额度 interpret_usage_daily 同属「解读」域。

create table if not exists public.interpret_saved_report (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_session_id text not null,
  question text not null default '',
  lines jsonb not null,
  interpretation text not null,
  deep_inquiry_questions jsonb,
  saved_at timestamptz not null default now(),
  constraint interpret_saved_report_user_session_unique unique (user_id, client_session_id),
  constraint interpret_saved_report_client_session_id_len check (char_length(client_session_id) between 1 and 128)
);

create index if not exists interpret_saved_report_user_saved_at_idx
  on public.interpret_saved_report (user_id, saved_at desc);

comment on table public.interpret_saved_report is '用户保存的观心解读全文；按 (user_id, client_session_id) 幂等一条。';

alter table public.interpret_saved_report enable row level security;
