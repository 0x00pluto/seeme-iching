# Cursor 团队命令 · 安装说明

团队命令安装于 [`.cursor/commands/team/`](../.cursor/commands/team/)（**已在 `.gitignore`**，不进版本库；各协作者需本地自行安装）。

母版维护于 Obsidian：`99_Assets/Vibecoding团队/团队成员/`。安装 SOP 见该目录下的 [Cursor命令模板-使用说明.md](file:///Users/peng.zhi/Documents/Obsidian/0x00pluto.ai/99_Assets/Vibecoding团队/团队成员/Cursor命令模板-使用说明.md)。

## 本仓库已安装角色

| 命令 | 安装文件 | 母版目录 |
|------|----------|----------|
| `/team:test-enginer` | `.cursor/commands/team/test-enginer.md` | `07-测试工程师` |

下列命令在 [`AGENTS.md`](../AGENTS.md) 与 PRD 中有引用，若本地尚未安装，请按母版 SOP 补装：

| 命令 | 母版目录 |
|------|----------|
| `/team:product-manager` | `01-产品经理` |
| `/team:prd-accept` | `02-工程验收官` |

## 重装步骤（摘要）

1. 打开母版角色目录，阅读 `README.md` 与 `variables.example.md`。
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
| 开发 | `pnpm run dev` → `http://localhost:3000` |
| 测试 | `pnpm test` |
