### **Q: 如何解决部署到 Vercel 后，同源 SSE 流式接口出现 `ERR_CONNECTION_CLOSED` / `Failed to fetch`、而本地 `pnpm run dev` 正常的问题？**

**A:**  
线上用户在调用 `POST /api/interpret/stream` 或 `POST /api/chat/stream` 时，浏览器可能报 `net::ERR_CONNECTION_CLOSED`、`TypeError: Failed to fetch` 或 `network error`；Vercel Runtime 里同一请求有时仍记 **HTTP 200**、函数跑完全程。根因通常是 **首字延迟（TTFT）过长** 叠加 **边缘/代理对「长时间无有效下行」的空闲超时**，并不等价于「方舟或函数未返回」。本项目通过 **OpenAI 兼容的空 `data:` 心跳** 与可配置的 **`SSE_PERIODIC_PING_MS`** 降低断连概率；前端对空 `content` 不触发 `onDelta`。

**问题症状：**

- 浏览器 Network 中流式请求失败或提前结束；控制台出现 `ERR_CONNECTION_CLOSED`、`Failed to fetch`、`network error`。
- 本地 Express + Vite 联调往往正常，线上（经 Vercel + CDN）更容易复现。
- Vercel 面板里该请求可能仍是 200、函数 Duration 较长，与用户侧「已断开」不一致。

**根本原因：**

1. **首 token 慢（TTFT）**：火山方舟/模型从建连到输出**第一个有内容的 token** 可达数十秒；若中间层只认 **`data:` 行**为有效下行，在这段时间内可能被判定为空闲。
2. **中间层空闲超时**：部分 CDN、代理、负载均衡对长连接无有效下行有超时（常见量级约 **60s**，依环境而异）。
3. **仅靠 SSE 注释 `: ping` 不足**：有的链路不把 **注释行**算作下行流量，仍会按「多久没有 `data:`」掐连接。
4. **控制台噪声干扰判断**：如 `SES Removing unpermitted intrinsics`、`lockdown-install.js`、扩展的 `message channel` 报错、Vercel 注入脚本里的依赖告警等，**多数与业务 API 无关**；应配合无痕窗口、关闭扩展复现。

**解决方案：**

1. **服务端（本项目已落地）**  
   - 设好 SSE 与 `X-Accel-Buffering: no` 后 **`flushHeaders`**，并立即发送 **OpenAI 流式兼容**的空片段：`choices[0].delta.content === ""` 的 `data:` 行（见 [`server/sse-warmup.ts`](../../server/sse-warmup.ts)）。  
   - 在 [`server/pipe-ark-sse.ts`](../../server/pipe-ark-sse.ts) 中按环境变量间隔重复发送**同一格式**空 delta，避免两包真实内容间隔过长。  
   - 路由层：[`api/interpret/stream.ts`](../../api/interpret/stream.ts)、[`api/chat/stream.ts`](../../api/chat/stream.ts)、[`server.ts`](../../server.ts)。

2. **配置调优**  
   - 在 Vercel Project → Environment Variables（Production）设置 **`SSE_PERIODIC_PING_MS`**，酌情**减小**间隔（例如 `8000`），再部署验证。

3. **自助排查**  
   - 对比浏览器失败时刻与 Vercel 函数时长：若函数仍在跑而浏览器已断，多属 **客户端到边缘链路**，而非模型未响应。  
   - 排除本机 HTTPS 拦截（如 `ERR_CERT_AUTHORITY_INVALID`）、公司代理/杀毒 HTTPS 扫描；换网络或无痕关扩展对照。

**关键配置要点：**

| 项 | 说明 |
|----|------|
| `SSE_PERIODIC_PING_MS` | 空 delta 心跳间隔（毫秒），服务端只读；默认 `12000`，合法范围 `3000`～`120000`（代码内 clamp）。 |
| `X-Accel-Buffering: no` | 减轻 nginx 类反向代理对响应的缓冲，利于流式及时下行。 |
| 前端 | [`src/lib/ark-client.ts`](../../src/lib/ark-client.ts) 仅 `if (delta) cb.onDelta(delta)`，空串不展示。 |

**参考文档：**

- [backend-best-practices.md §6 流式（SSE）](../backend-best-practices.md#6-流式sse规范)
- [doc_index.md](../doc_index.md)
- 环境变量示例：[`.env.example`](../../.env.example)
