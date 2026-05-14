-- 观心报告公开只读分享：不可猜测 token，撤销软删除；删档案时级联失效。

create table if not exists public.interpret_share_link (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.interpret_saved_report (id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint interpret_share_link_token_len check (char_length(token) between 16 and 128)
);

create unique index if not exists interpret_share_link_token_key
  on public.interpret_share_link (token);

-- 每条已保存报告至多一条「未撤销」分享行；撤销后可再 POST 生成新 token
create unique index if not exists interpret_share_link_one_active_per_report
  on public.interpret_share_link (report_id)
  where revoked_at is null;

comment on table public.interpret_share_link is '已保存观心报告的公开只读分享；anon 不经 PostgREST，仅服务端 service_role 读写。';

alter table public.interpret_share_link enable row level security;
