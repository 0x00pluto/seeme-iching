import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { postSendLoginEmail } from "@/lib/auth-api";

type Step = "email" | "sent";

export interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess?: () => void;
}

export const LoginDialog: React.FC<LoginDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const resetLocal = () => {
    setStep("email");
    setEmail("");
    setLoading(false);
    setResending(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetLocal();
    onOpenChange(next);
  };

  const sendLink = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) {
      toast.error("请输入有效的邮箱地址");
      return;
    }

    setLoading(true);
    try {
      await postSendLoginEmail(normalized);
      setEmail(normalized);
      setStep("sent");
      toast.success("登录邮件已发送");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "发送失败，请稍后再试";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await postSendLoginEmail(email.trim().toLowerCase());
      toast.success("登录邮件已重新发送");
    } catch {
      toast.error("重新发送失败");
    } finally {
      setResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="fixed inset-0 isolate z-50 bg-ink/40 duration-100 supports-backdrop-filter:backdrop-blur-md data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        showCloseButton={false}
        className={cn(
          "max-w-md gap-0 rounded-[48px] border border-ink/5 bg-bg p-10 shadow-2xl sm:max-w-md",
          "top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2",
          "text-ink data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        )}
      >
        <DialogTitle className="sr-only">
          {step === "email" ? "开启并同步你的档案" : "请查收邮件"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          通过邮箱中的登录链接登录镜微。
        </DialogDescription>

        <button
          type="button"
          aria-label="关闭"
          onClick={() => handleOpenChange(false)}
          className="absolute top-8 right-8 text-ink/20 transition-colors hover:text-ink"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-bg shadow-xl">
            <Mail size={24} aria-hidden />
          </div>

          <AnimatePresence mode="wait">
            {step === "email" ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className="flex w-full flex-col gap-8"
              >
                <div className="flex flex-col gap-3 px-1">
                  <h3 className="font-serif text-3xl font-bold leading-tight text-ink">
                    开启并同步你的档案
                  </h3>
                  <p className="px-2 font-sans text-sm leading-relaxed text-muted-foreground">
                    登录后，你的每一次内省足迹都将安全同步至云端，永不迷失。
                  </p>
                </div>

                <form
                  className="flex flex-col gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendLink();
                  }}
                >
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="请输入您的邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="h-auto rounded-full border-ink/10 bg-white/60 py-5 px-8 font-serif text-lg italic shadow-sm placeholder:text-ink/25 md:text-lg"
                  />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-auto w-full items-center justify-center gap-2 rounded-full bg-ink py-5 font-serif text-lg font-bold text-bg shadow-xl hover:bg-ink/90"
                  >
                    {loading ? (
                      <RefreshCw className="animate-spin" size={20} />
                    ) : (
                      <>
                        <span>发送登录链接</span>
                        <ArrowRight size={20} className="ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="sent"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className="flex w-full flex-col gap-6"
              >
                <div className="flex flex-col gap-3 px-1">
                  <h3 className="font-serif text-3xl font-bold leading-tight text-ink">
                    请查收邮件
                  </h3>
                  <p className="px-2 font-sans text-sm leading-relaxed text-muted-foreground">
                    我们已向 <span className="font-medium text-ink/70">{email}</span>{" "}
                    发送登录链接，请点击邮件中的链接完成登录（无需输入数字验证码）。
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={resending}
                    onClick={() => void handleResend()}
                    className="text-sm font-serif text-brand/80 underline-offset-4 transition-colors hover:text-brand disabled:opacity-40"
                  >
                    {resending ? "正在重新发送…" : "重新发送登录邮件"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                    }}
                    className="text-xs font-serif uppercase tracking-widest text-ink/30 hover:text-ink/50"
                  >
                    修改邮箱
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full border-t border-ink/5 pt-6">
            <p className="text-[10px] font-serif uppercase tracking-[0.2em] leading-relaxed text-ink/25">
              镜微镜像档案 · 加密存储您的每一次照见
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
