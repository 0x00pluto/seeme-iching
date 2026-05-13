### **Q: 为什么本仓库 `tsconfig.json` 必须启用 `strict: true`？关掉会踩到哪些坑？**

**A:**
本仓库 [`tsconfig.json`](../../tsconfig.json) 显式开启了 `"strict": true`。**这不是装饰性配置**，关掉后 TypeScript 5.x 会失去对**可辨识联合（discriminated union）** 的控制流收窄能力，导致教科书级别的写法直接编译报错。曾经在开发登录守卫 [`server/require-auth.ts`](../../server/require-auth.ts) 时踩到此坑，最终通过显式开启 `strict` 才得到正常类型行为。

**问题症状：**

- 标准的可辨识联合 `if (!result.ok) { ... }` 收窄不生效。
- 在分支内访问失败侧的属性会被报 `TS2339: Property 'xxx' does not exist on type 'AuthGuardResult'`，并附带提示 `Property 'xxx' does not exist on type '{ ok: true; ... }'`，说明 TS 把变量当成了**整个联合**，而不是已收窄到失败分支。
- 现象不限于本项目特定代码：在仓库根用最小复现也能稳定触发（见下文）。

**根本原因：**

TypeScript 的可辨识联合控制流分析依赖 `strictNullChecks`（即 `strict` 默认开启项之一）。`strict` 关闭时：

- `null` / `undefined` 被合并进每个类型，控制流分析对「真值/假值收窄」处理变弱，对 `if (!x.ok)` 这种 `boolean` 字面量判别也变得不可靠。
- TS 仍报「属性不存在」式错误（不会假装通过），但**不再做有效收窄**，所以正确写出来的代码也跑不过 lint。

历史上仓库代码本身**全部按 strict 风格写**（类型注解齐全、避免 implicit any、null 检查到位），**只是 tsconfig 漏了打开** `strict`。叠加 `--strict` 跑全仓 `tsc --noEmit` 后零新增错误，证明这是个偶然遗漏而非历史包袱。

**解决方案：**

在 [`tsconfig.json`](../../tsconfig.json) 的 `compilerOptions` 中显式开启 `"strict": true`（已默认开启，不要再关回去）。

**最小复现（关闭 strict 时失败）：**

```ts
type X = { ok: true; a: number } | { ok: false; b: number; c: string };
function f(): X { return { ok: false, b: 1, c: "x" }; }

const g = f();
if (!g.ok) {
  console.log(g.b, g.c);
}
```

- `tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --isolatedModules` → 报 `TS2339: Property 'b' does not exist on type 'X'`。
- 加上 `--strict` 后 → 通过。

**错误配置示例：**

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "isolatedModules": true
  }
}
```

**正确配置示例：**

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "isolatedModules": true
  }
}
```

**关键配置要点：**

- `"strict": true` 一次性打开 `strictNullChecks`、`noImplicitAny`、`strictFunctionTypes`、`strictBindCallApply`、`strictPropertyInitialization`、`alwaysStrict`、`useUnknownInCatchVariables` 等子项。
- 收窄行为的核心依赖来自 `strictNullChecks`；如确有特殊原因只想要它，可写 `"strictNullChecks": true` 而不是整套 `strict`。**本仓库选整套**，因为既有代码已经满足。
- 修改 `tsconfig.json` 后请运行 `pnpm run lint`（等同 `tsc --noEmit`）确认 0 错误，再继续开发。

**「绕开陷阱」的临时写法（不再推荐，仅作参考）：**

之前在不知道 strict 缺失的情况下，曾把守卫函数改为 `T | null + 常量` 形式：

```ts
export const UNAUTHORIZED_RESPONSE = {
  status: 401,
  body: { error: "请先登录" },
} as const;

export function requireAuth(cookieHeader: string | undefined): UserSessionPayload | null {
  return getSessionFromRequest(cookieHeader);
}
```

调用方：

```ts
if (!requireAuth(req.headers.cookie)) {
  res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
  return;
}
```

这种写法**不依赖可辨识联合的收窄**，所以即便 strict 关闭也能编译通过。**开启 strict 后两种写法都可行**，但可辨识联合在「成功路径要带出会话载荷」时表达力更强。本仓库 [`server/require-auth.ts`](../../server/require-auth.ts) 当前沿用了 `T | null` 写法，KISS 起见保持现状；未来如有需要再切回联合形式，前提是 strict 仍然启用。

**参考文档：**

- [TypeScript Handbook · Narrowing · Discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- [TypeScript Handbook · tsconfig · strict](https://www.typescriptlang.org/tsconfig#strict)
