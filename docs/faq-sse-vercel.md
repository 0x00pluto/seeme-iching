# FAQ：Vercel / 线上 SSE 流式断连（`ERR_CONNECTION_CLOSED`、`Failed to fetch`）

面向「本地正常、部署后偶现」的同类问题；与通用后端约定见 [backend-best-practices.md](./backend-best-practices.md)。

---

## 现象

- 浏览器控制台：`POST /api/interpret/stream` 或 `/api/chat/stream` 报 **`net::ERR_CONNECTION_CLOSED`**、**`TypeError: Failed to fetch`** / **`network error`**。
- 本地 `pnpm run dev`（Express）往往正常。
- Vercel Runtime 侧同一请求可能仍显示 **HTTP 200**、函数跑完全程——**不代表用户的浏览器一定收到了全程字节**。

---

## 常见原因

1. **首 token 很慢（TTFT）**  
   火山方舟/模型侧从建连到输出**第一个内容 token** 可能达**数十秒**。这段时间里，若对浏览器与边缘而言「几乎没有任何可解析的流式正文」，容易被判为**空闲**。

2. **中间层空闲超时**  
   部分 CDN、代理、负载均衡对**长连接上长时间无有效下行**会掐断，**约 60 秒**是常见量级之一（依提供商而异）。

3. **仅注释型 SSE 不足以保活**  
   旧实践会用 SSE 注释行 `: ping`。有的链路**不把注释算作下行流量**，仍会在「长时间没有 `data:` 行」时超时。因此本项目改为下发 **与 OpenAI 流式一致格式的空 `data:` 片段**（`content: ""`），见下文「主要改动」。

4. **与后端无关的噪声**（易误判为接口坏）  
   例如 `lockdown-install.js` / `SES Removing unpermitted intrinsics`、扩展报 `A listener indicated an asynchronous response...`、Vercel 工具脚本报 zustand 等——**先尝试无痕窗口、关闭扩展**再复现。

---

## 本项目已做改动（代码入口）

| 作用 | 位置 |
|------|------|
| 设完 SSE 头后 `flushHeaders` + **首包空 delta**（OpenAI 兼容 JSON，`content: ""`） | [`server/sse-warmup.ts`](../server/sse-warmup.ts)：`flushHeadersAndInitialSsePing`、`sseEmptyModelDeltaHeartbeat` |
| 拉流过程中按间隔发送**同格式空 delta** 保活；间隔由环境变量控制 | [`server/pipe-ark-sse.ts`](../server/pipe-ark-sse.ts) + [`server/sse-warmup.ts`](../server/sse-warmup.ts)：`getSsePeriodicPingMs` |
| 响应头 **`X-Accel-Buffering: no`**（减轻 nginx 类缓冲）；与上两步一起在三条路由落地 | [`api/interpret/stream.ts`](../api/interpret/stream.ts)、[`api/chat/stream.ts`](../api/chat/stream.ts)、[`server.ts`](../server.ts) |
| 前端忽略空文本 delta | [`src/lib/ark-client.ts`](../src/lib/ark-client.ts)：仅 `if (delta) cb.onDelta(delta)` |

环境变量（服务端/Vercel）：

- **`SSE_PERIODIC_PING_MS`**（可选）：空 delta 心跳间隔（毫秒），默认 **12000**，合法范围 **3000～120000**。若仍有掐断，可适当**减小**（如 `8000`），见 [`.env.example`](../.env.example)。

---

## 自助排查建议

1. **对齐时间**：浏览器 Network 里请求失败的时刻 vs Vercel 日志里的函数时长；若函数仍在跑而浏览器已断，多为**链路空闲/客户端路径**问题。
2. **收窄心跳**：在 Production 配置更小的 **`SSE_PERIODIC_PING_MS`** 再试。
3. **排除本机因素**：HTTPS 证书报错（如字体资源 `ERR_CERT_AUTHORITY_INVALID`）、代理/杀毒 HTTPS 扫描可能影响同一环境下的其它请求；换网络或无痕关扩展对比。

---

## 相关文档

- [backend-best-practices.md §6 流式（SSE）](./backend-best-practices.md#6-流式sse规范)
- [doc_index.md](./doc_index.md)
