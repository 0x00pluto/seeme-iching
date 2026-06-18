# Feature Spec 目录（镜微 · seeme-iching）

本目录存放**需求探索专家**产出的 Feature Spec（特性规格书）。文件名规则：**`feat-{五位序号}-{feature-slug}.md`**（kebab-case slug，序号按创建顺序递增，勿手写插队）。

## 协作命令

| 命令 | 职责 |
|------|------|
| `/team:po-explorer` | 模糊想法 / 业务目标 → 双引擎探索 → 落盘本目录（含 Issue 级开发 Backlog） |
| `/team:product-manager` | 探索收敛后可选：撰写正式 PRD → 落盘 [`specs/prds/`](../prds/prd-wiki-index.md) |

## 与 PRD 的关系

- **早期探索**：用 `/team:po-explorer <topic-or-problem>` 产出 Feature Spec（轻量、可直拆 Issue）
- **定稿 PRD**：用 `/team:product-manager <feature-slug>` 产出正式 PRD、用户故事地图与 Release 切片

探索前建议先读 [`docs/product-brief.md`](../../docs/product-brief.md) 与 [`docs/doc_index.md`](../../docs/doc_index.md)。

母版维护于 Obsidian：`99_Assets/Vibecoding团队/团队成员/06-需求探索专家/`。
