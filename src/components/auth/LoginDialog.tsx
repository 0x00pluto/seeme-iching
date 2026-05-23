import React, { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Mail, RefreshCw, X } from "lucide-react";
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
import {
  AuthApiError,
  messageForAuthOtpCode,
  postSendLoginEmail,
  postVerifyLoginOtp,
} from "@/lib/auth-api";
import { maskEmailForDisplay } from "@/lib/mask-email";
import { useResendCooldown } from "@/hooks/use-resend-cooldown";
import { MirrorOtpInput } from "@/components/auth/MirrorOtpInput";

type Step = "email" | "code";

export interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess?: () => void;
}

export const LoginDialog: React.FC<LoginDialogProps> = ({
  open,
  onOpenChange,
  onLoginSuccess,
}) => {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(null);
  const verifyingRef = useRef(false);

  const { secondsLeft, canResend } = useResendCooldown(resendAvailableAt);

  const resetLocal = () => {
    setStep("email");
    setEmail("");
    setOtp("");
    setLoading(false);
    setVerifying(false);
    setResending(false);
    setResendAvailableAt(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetLocal();
    onOpenChange(next);
  };

  const applySendResult = (resendAt: string) => {
    setResendAvailableAt(resendAt);
  };

  const handleSendError = (e: unknown) => {
    if (e instanceof AuthApiError) {
      if (e.resendAvailableAt) {
        setResendAvailableAt(e.resendAvailableAt);
      }
      toast.error(e.message);
      return;
    }
    const msg = e instanceof Error ? e.message : "寄送失败，请稍后再试";
    toast.error(msg);
  };

  const sendOtp = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) {
      toast.error("请输入有效的邮箱地址");
      return;
    }

    setLoading(true);
    try {
      const result = await postSendLoginEmail(normalized);
      setEmail(normalized);
      applySendResult(result.resendAvailableAt);
      setStep("code");
      setOtp("");
      toast.success("镜证已寄至你的邮箱");
    } catch (e: unknown) {
      handleSendError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResending(true);
    try {
      const result = await postSendLoginEmail(email.trim().toLowerCase());
      applySendResult(result.resendAvailableAt);
      toast.success("镜证已寄至你的邮箱");
    } catch (e: unknown) {
      handleSendError(e);
    } finally {
      setResending(false);
    }
  };

  const verifyOtp = useCallback(
    async (digits: string) => {
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      setVerifying(true);
      try {
        await postVerifyLoginOtp(email.trim().toLowerCase(), digits);
        toast.success("登录成功，欢迎来到镜微");
        onLoginSuccess?.();
        onOpenChange(false);
        resetLocal();
      } catch (e: unknown) {
        if (e instanceof AuthApiError) {
          toast.error(messageForAuthOtpCode(e.code, e.message));
        } else {
          const msg = e instanceof Error ? e.message : "验码失败";
          toast.error(msg);
        }
      } finally {
        verifyingRef.current = false;
        setVerifying(false);
      }
    },
    [email, onLoginSuccess, onOpenChange],
  );

  const goBackToEmail = () => {
    setStep("email");
    setOtp("");
  };

  const maskedEmail = email ? maskEmailForDisplay(email) : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="fixed inset-0 isolate z-50 bg-ink/40 duration-100 supports-backdrop-filter:backdrop-blur-md data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        showCloseButton={false}
        className={cn(
          "max-w-md gap-0 rounded-[48px] border border-ink/5 bg-bg p-10 shadow-2xl sm:max-w-md",
          "top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2",
          "text-ink data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        )}
      >
        <DialogTitle className="sr-only">
          {step === "email" ? "开启并同步你的档案" : "照见信中之码"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          通过邮箱六位镜证登录镜微。
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
                    void sendOtp();
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
                        <span>寄送六位镜证</span>
                        <ArrowRight size={20} className="ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className="flex w-full flex-col gap-6"
              >
                <button
                  type="button"
                  onClick={goBackToEmail}
                  className="flex items-center gap-1 self-start text-sm font-serif text-ink/40 transition-colors hover:text-ink/70"
                >
                  <ArrowLeft size={16} aria-hidden />
                  返回
                </button>

                <div className="flex flex-col gap-3 px-1">
                  <h3 className="font-serif text-3xl font-bold leading-tight text-ink">
                    照见信中之码
                  </h3>
                  <p className="px-2 font-sans text-sm leading-relaxed text-muted-foreground">
                    我们已向{" "}
                    <span className="font-medium text-ink/70">{maskedEmail}</span>{" "}
                    寄出一组六位镜证，请于三十分钟内填入下方。
                  </p>
                </div>

                <MirrorOtpInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={(digits) => void verifyOtp(digits)}
                  disabled={verifying}
                />

                {verifying && (
                  <p className="flex items-center justify-center gap-2 text-sm text-ink/50">
                    <RefreshCw className="animate-spin" size={16} aria-hidden />
                    正在照见…
                  </p>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={resending || !canResend}
                    onClick={() => void handleResend()}
                    className="text-sm font-serif text-brand/80 underline-offset-4 transition-colors hover:text-brand disabled:opacity-40"
                  >
                    {resending
                      ? "正在重新寄送…"
                      : canResend
                        ? "重新寄送镜证"
                        : `${secondsLeft} 秒后可重新寄送镜证`}
                  </button>
                  <button
                    type="button"
                    onClick={goBackToEmail}
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
