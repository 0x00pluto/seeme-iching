import React from "react";

/**
 * 旧魔法链接书签兼容页；新登录请使用 LoginDialog 内六位镜证。
 */
export const AuthCallback: React.FC = () => {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 font-serif text-ink">
      <div className="max-w-md rounded-[48px] border border-ink/10 bg-white/80 px-10 py-12 text-center shadow-xl backdrop-blur-sm">
        <h1 className="font-serif text-2xl font-bold text-ink">请使用镜证登录</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink/70">
          镜微已改为邮箱六位镜证登录。请返回首页，在登录弹窗中输入邮箱并照见信中之码。
        </p>
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
