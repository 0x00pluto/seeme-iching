# Cursor 团队命令 · 安装说明

团队命令安装于 [`.cursor/commands/team/`](../.cursor/commands/team/)（**已在 `.gitignore`**，不进版本库；各协作者需本地自行安装）。

母版维护于 Obsidian：`99_Assets/Vibecoding团队/团队成员/`。安装 SOP 见该目录下的 [Cursor命令模板-使用说明.md](file:///Users/peng.zhi/Documents/Obsidian/0x00pluto.ai/99_Assets/Vibecoding团队/团队成员/Cursor命令模板-使用说明.md)。

## 本仓库已安装角色

| 命令 | 安装文件 | 母版目录 | 安装稿版本 |
|------|----------|----------|------------|
| `/team:product-manager` | `.cursor/commands/team/product-manager.md` | `01-产品经理` | 3.1 |
| `/team:prd-accept` | `.cursor/commands/team/prd-accept.md` | `02-工程验收官` | 1.1 |
| `/team:test-enginer` | `.cursor/commands/team/test-enginer.md` | `07-测试工程师` | 1.0 |

PM 与验收官须**同批**保持 ≥ 3.1 / ≥ 1.1（Release 仅 R0 + 可选 R1；验收默认 `--release R0,R1`）。升级前读各角色母版 `CHANGELOG.md`。

## 重装步骤（摘要）

1. 打开母版角色目录，阅读 `README.md`、`CHANGELOG.md` 与 `variables.example.md`。
2. 按 [_shared/project-variables.example.md](file:///Users/peng.zhi/Documents/Obsidian/0x00pluto.ai/99_Assets/Vibecoding团队/团队成员/_shared/project-variables.example.md) 填写项目级变量（`specs/prds`、`docs/doc_index.md`、`pnpm` 等）。
3. 复制 `command.template.md` → `.cursor/commands/team/<INSTALL_FILENAME>`，替换 `{{变量}}`；处理「特殊取值」删节。
4. 全文搜索 `` `{{` ``，确认零残留；Cursor 重载窗口后验证命令可触发。

## seeme-iching 项目级变量速查

| 变量 | 取值 |
|------|------|
| 项目名 | 镜微 · 易经 AI 内省 |
| PRD | `specs/prds` |
| Feature Spec | `specs/features` |
| 文档地图 | `docs/doc_index.md` |
| 数据表 doc | `docs/supabase-tables.md` |
| API/路由 doc | `docs/backend-best-practices.md`（本仓无 `api-route-governance.md`） |
| 开发 | `pnpm run dev` → `http://localhost:3000` |
| 测试 / Lint / 迁移 | `pnpm test` / `pnpm lint` / `pnpm run db:migrate` |
