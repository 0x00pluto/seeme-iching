# 手机号镜证登录 · E2E 抽检清单

面向 Release 0 人工验收。本地 `pnpm run dev` **无法**直接收短信（Supabase Hook 须公网 HTTPS）；请在 **Vercel Preview** 或生产环境执行。

## 前置

- [ ] Supabase Auth → Phone 已启用；OTP 长度 **6**、过期 **600s**（10 分钟，与阿里云默认对齐）
- [ ] Send SMS Hook URL 指向 `https://<origin>/api/hooks/supabase/send-sms`
- [ ] `SEND_SMS_HOOK_SECRET` 与 Dashboard 一致
- [ ] `ALIYUN_*` 已配置且模板透传 OTP（非 `##code##`）

## 发码与验码（真实 +86）

- [ ] 打开登录弹窗，第一屏展示 **+86** 与 11 位输入
- [ ] 输入有效手机号，点击「寄送六位镜证」→ Toast「镜证已寄至你的手机」
- [ ] 60 秒内收到 **6 位**短信，内容与 Supabase OTP 一致
- [ ] 第二屏标题「照见讯中之码」，脱敏号形如 `138****5678`
- [ ] 填入 6 位后自动验码 → Toast「登录成功，欢迎来到镜微」
- [ ] 全流程 ≤ **2 分钟**（抽检建议 10 次）

## 重发与冷却

- [ ] 第二屏倒计时「{n} 秒后可重新寄送镜证」
- [ ] 60 秒内 API 返回 **429** `OTP_COOLDOWN`；Toast「请稍后再寄送镜证」
- [ ] 冷却结束后「重新寄送镜证」可再次收信

## 纠错与导航

- [ ] 错误镜证：Toast「镜证有误或已失效，请再照见一次」；**不清空**已输入格
- [ ] 「返回」「修改手机号」回到第一屏并保留已填号码
- [ ] 无效手机号 Toast「请输入有效的手机号」

## 会话与账户菜单

- [ ] `GET /api/auth/me` 含 `phone`（E.164）与 `phoneMasked`
- [ ] 顶栏账户菜单展示脱敏手机号
- [ ] 登出后 `user: null`

## 硬切换

- [ ] `POST /api/auth/send-otp` 传 `{ email }` → **400**
- [ ] 旧含 `email` 的会话 Cookie 不再视为已登录

## Hook 专项

- [ ] 非法签名 → Hook **403**
- [ ] Supabase 发码后 Hook 日志 200；阿里云控制台有发送记录
