# PRD 索引（镜微 · seeme-iching）

本目录存放产品需求文档。文件名规则：**`prd-{五位序号}-{feature-slug}.md`**（kebab-case slug，序号按创建顺序递增，勿手写插队）。

| 序号 | 路径 | 摘要 | status |
|------|------|------|--------|
| 00001 | [prd-00001-email-otp-login.md](./prd-00001-email-otp-login.md) | 邮箱六位镜证登录：Supabase OTP 替换魔法链接；6 格 UI；有效 30 分钟、重发 60 秒 | backlog |
| 00002 | [prd-00002-report-auto-save-retention.md](./prd-00002-report-auto-save-retention.md) | 观心报告自动保存；免费 7 天 / 会员 180 天保留；移除手动保存、保留分享 | backlog |
| 00003 | [prd-00003-mirror-thread-daily-insight.md](./prd-00003-mirror-thread-daily-insight.md) | 镜脉叙事续照：明日之约 + 今日续照懒生成；内因 D1 回访；不扣解读额度 | backlog |
| 00004 | [prd-00004-mirror-thread-seed-pregen.md](./prd-00004-mirror-thread-seed-pregen.md) | 镜脉续照 v2：autosave 异步 seed 预写 + 7 档 shift 选档；echo Hero；打开日零 LLM | backlog |

## 协作命令

| 命令 | 职责 |
|------|------|
| `/team:product-manager` | 头脑风暴 → 撰写 PRD → 落盘本目录 → 更新本索引 |
| `/team:prd-accept` | 对照代码验收 PRD，回写文末「工程验收状态」与 frontmatter `status` |

撰写 PRD 前请先读 [`docs/product-brief.md`](../../docs/product-brief.md) 与 [`docs/doc_index.md`](../../docs/doc_index.md)。

PRD 引用的截图与线框见 [`specs/prds/reference/`](./reference/README.md)。

母版维护于 Obsidian：`99_Assets/Vibecoding团队/团队成员/`。
