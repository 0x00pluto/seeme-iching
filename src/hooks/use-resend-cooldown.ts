import { useEffect, useState } from "react";

function secondsUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso) - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

/** 以服务端 resendAvailableAt 为准的 60s 重发倒计时 */
export function useResendCooldown(resendAvailableAt: string | null): {
  secondsLeft: number;
  canResend: boolean;
} {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(resendAvailableAt));

  useEffect(() => {
    const tick = () => setSecondsLeft(secondsUntil(resendAvailableAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [resendAvailableAt]);

  return { secondsLeft, canResend: secondsLeft <= 0 };
}
