import React, { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * 魔法链接回调：URL hash 中带 access_token（Supabase implicit）。
 * 换取服务端 HttpOnly 会话后跳转首页。
 */
export const AuthCallback: React.FC = () => {
  const [message, setMessage] = useState("正在完成登录…");

  useEffect(() => {
    async function run() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const search = new URLSearchParams(window.location.search);
      const accessToken =
        hash.get("access_token") ?? search.get("access_token");
      const errDesc =
        hash.get("error_description") ??
        search.get("error_description") ??
        hash.get("error") ??
        search.get("error");

      if (errDesc) {
        setMessage(decodeURIComponent(String(errDesc).replace(/\+/g, " ")));
        toast.error("登录未完成");
        return;
      }

      if (!accessToken) {
        setMessage("未找到登录令牌，请从邮件中的链接进入，或重新发送登录邮件。");
        return;
      }

      try {
        const res = await fetch("/api/auth/session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "登录失败");
        }
        toast.success("登录成功，欢迎来到镜微");
        window.location.replace("/");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "登录失败";
        setMessage(msg);
        toast.error(msg);
      }
    }

    void run();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 font-serif text-ink">
      <div className="max-w-md rounded-[48px] border border-ink/10 bg-white/80 px-10 py-12 text-center shadow-xl backdrop-blur-sm">
        <p className="text-lg leading-relaxed text-ink/80">{message}</p>
        <a
          href="/"
          className="mt-8 inline-block text-sm text-brand underline-offset-4 hover:underline"
        >
          返回首页
        </a>
      </div>
    </main>
  );
};
