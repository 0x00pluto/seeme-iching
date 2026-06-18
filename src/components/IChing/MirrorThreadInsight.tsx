import { daysUntilExpiry } from "@/lib/archive-expiry";
import type { MirrorThreadToday } from "@/lib/mirror-thread-api";
import { postMirrorThreadReadBeacon } from "@/lib/mirror-thread-api";
import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";

export type MirrorThreadInsightVariant = "hero" | "loading";

type MirrorThreadInsightProps = {
  data: MirrorThreadToday | null;
  variant: MirrorThreadInsightVariant;
  className?: string;
  onContinue?: () => void;
  onStartFresh?: () => void;
};

function useReadDurationBeacon(data: MirrorThreadToday | null, enabled: boolean) {
  const rootRef = useRef<HTMLElement | null>(null);
  const visibleSinceRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    reportedRef.current = false;
    accumulatedMsRef.current = 0;
    visibleSinceRef.current = null;
  }, [data?.insightDate, data?.generatedAt]);

  useEffect(() => {
    if (!enabled || !data || !rootRef.current) return;

    const flushDuration = () => {
      if (visibleSinceRef.current !== null) {
        accumulatedMsRef.current += Date.now() - visibleSinceRef.current;
        visibleSinceRef.current = null;
      }
    };

    const maybeReport = () => {
      flushDuration();
      if (reportedRef.current) return;
      if (accumulatedMsRef.current < 1000) return;
      reportedRef.current = true;
      postMirrorThreadReadBeacon({
        insightDate: data.insightDate,
        insightReadDurationMs: Math.round(accumulatedMsRef.current),
        generatedAt: data.generatedAt,
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (visibleSinceRef.current === null) {
            visibleSinceRef.current = Date.now();
          }
        } else {
          flushDuration();
        }
      },
      { threshold: [0, 0.5, 1] },
    );

    observer.observe(rootRef.current);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        maybeReport();
      } else if (rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        const inView =
          rect.top < window.innerHeight * 0.75 && rect.bottom > window.innerHeight * 0.25;
        if (inView && visibleSinceRef.current === null) {
          visibleSinceRef.current = Date.now();
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      maybeReport();
    };
  }, [data, enabled]);

  return rootRef;
}

function HeroLoading({ className }: { className?: string }) {
  return (
    <section
      className={cn("w-full max-w-4xl text-center", className)}
      aria-busy="true"
      aria-label="镜脉续照加载中"
    >
      <div className="flex flex-col items-center gap-6 animate-pulse">
        <div className="h-4 w-56 rounded bg-ink/10" />
        <div className="h-6 w-full max-w-2xl rounded bg-ink/5" />
        <div className="h-10 w-full max-w-3xl rounded bg-ink/5" />
        <div className="h-10 w-5/6 max-w-2xl rounded bg-ink/5" />
        <div className="h-6 w-full max-w-3xl rounded bg-ink/5" />
      </div>
    </section>
  );
}

export const MirrorThreadInsight: React.FC<MirrorThreadInsightProps> = ({
  data,
  variant,
  className,
  onContinue,
  onStartFresh,
}) => {
  const trackReads = variant === "hero";
  const rootRef = useReadDurationBeacon(data, trackReads);

  if (variant === "loading") {
    return <HeroLoading className={className} />;
  }

  if (!data) return null;

  const expiresMs = new Date(data.sourceReportExpiresAt).getTime();
  const daysLeft = Number.isFinite(expiresMs) ? daysUntilExpiry(expiresMs) : null;
  const showFadeHint = daysLeft !== null && daysLeft <= 7;

  return (
    <section
      ref={rootRef}
      className={cn("w-full max-w-4xl text-center", className)}
      aria-label="镜脉 · 今日续照"
    >
      <div className="flex flex-col items-center gap-6 md:gap-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-4 font-serif tracking-[0.4em] uppercase text-brand">
            <div className="h-px w-8 bg-brand/30" />
            <span>镜脉 · 今日续照</span>
            <div className="h-px w-8 bg-brand/30" />
          </div>
          <p className="max-w-2xl font-serif text-lg md:text-xl leading-relaxed text-ink/40 italic">
            不必起新卦，先把昨日的故事读完。
          </p>
          {showFadeHint && daysLeft !== null ? (
            <p className="font-serif text-sm text-ink/40">
              这条叙事线还会在镜中保留 {daysLeft} 天。
            </p>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-8 text-left">
          <div className="mx-auto w-full max-w-3xl">
            <p className="mb-3 font-serif text-xs uppercase tracking-[0.35em] text-ink/30">
              回响
            </p>
            <blockquote className="border-l-2 border-brand/30 pl-6 font-serif text-2xl md:text-3xl leading-relaxed text-ink/85">
              {data.echoText}
            </blockquote>
          </div>

          <div className="mx-auto w-full max-w-3xl">
            <p className="mb-3 font-serif text-xs uppercase tracking-[0.35em] text-ink/30">
              位移
            </p>
            <p className="font-serif text-lg md:text-xl leading-relaxed text-ink/50 italic">
              {data.shiftText}
            </p>
          </div>

          {data.optionalPrompt ? (
            <div className="mx-auto w-full max-w-3xl">
              <p className="font-serif text-lg md:text-xl leading-relaxed text-ink/50 italic">
                {data.optionalPrompt}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
          {onContinue ? (
            <button
              type="button"
              onClick={onContinue}
              className="rounded-full bg-ink px-12 py-5 font-serif text-lg font-bold tracking-[0.2em] text-bg shadow-lg shadow-ink/15 transition-transform hover:scale-[1.02] active:scale-95 md:text-xl"
            >
              继续照见
            </button>
          ) : null}
          {onStartFresh ? (
            <button
              type="button"
              onClick={onStartFresh}
              className="rounded-full border border-ink/15 bg-white/40 px-12 py-5 font-serif text-lg font-bold tracking-[0.2em] text-ink shadow-md shadow-ink/5 transition-all hover:border-ink/25 hover:bg-white/60 active:scale-95 md:text-xl"
            >
              开启新的照见
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};
