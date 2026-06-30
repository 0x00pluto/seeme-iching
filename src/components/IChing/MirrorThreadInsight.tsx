import type { MirrorThreadToday } from "@/lib/mirror-thread-api";
import { postMirrorThreadReadBeacon } from "@/lib/mirror-thread-api";
import {
  clearMirrorThreadReplyDraft,
  loadMirrorThreadReplyDraft,
  saveMirrorThreadReplyDraft,
} from "@/lib/mirror-thread-reply-draft";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type MirrorThreadInsightVariant = "hero" | "loading";

type MirrorThreadInsightProps = {
  data: MirrorThreadToday | null;
  variant: MirrorThreadInsightVariant;
  className?: string;
  /** seed pending / 补跑中：展示「镜脉正在续照…」 */
  showPregenHint?: boolean;
  replyEditable?: boolean;
  onReplySave?: (replyText: string) => Promise<void>;
  onContinue?: () => void;
  onStartFresh?: () => void;
};

const REPLY_PLACEHOLDER = "把你此刻的回响留在这里，明日会再照见一笔。";
const REPLY_TITLE = "若有余力，留一笔";
const TOAST_SAVED = "已记下。";
const TOAST_SAVE_FAILED = "暂未记下，请稍后再试。";

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

function ReplySectionLabel() {
  return (
    <p className="mb-4 font-serif text-xs uppercase tracking-[0.35em] text-ink/30">
      {REPLY_TITLE}
    </p>
  );
}

const replyCardClass =
  "rounded-[32px] border border-ink/5 bg-white/40 p-6 sm:p-8 transition-colors hover:border-brand/15 hover:bg-white/50";

function MirrorThreadReplySection({
  insightDate,
  userReply,
  replyEditable,
  onReplySave,
}: {
  insightDate: string;
  userReply: string | null | undefined;
  replyEditable: boolean;
  onReplySave?: (replyText: string) => Promise<void>;
}) {
  const savedText = userReply?.trim() ?? "";
  const [draft, setDraft] = useState(() => savedText || loadMirrorThreadReplyDraft(insightDate) || "");
  const [isWriting, setIsWriting] = useState(() => {
    if (savedText) return false;
    return Boolean(loadMirrorThreadReplyDraft(insightDate)?.trim());
  });
  const lastSavedRef = useRef(savedText);
  const savingRef = useRef(false);

  useEffect(() => {
    const next = savedText || loadMirrorThreadReplyDraft(insightDate) || "";
    setDraft(next);
    lastSavedRef.current = savedText;
    if (savedText) {
      setIsWriting(false);
    }
  }, [insightDate, savedText]);

  const persist = useCallback(async () => {
    if (!replyEditable || !onReplySave || savingRef.current) return;
    const trimmed = draft.trim();
    if (trimmed === lastSavedRef.current) return;

    savingRef.current = true;
    try {
      await onReplySave(trimmed);
      lastSavedRef.current = trimmed;
      clearMirrorThreadReplyDraft(insightDate);
      if (trimmed) {
        toast.success(TOAST_SAVED);
        setIsWriting(false);
      }
    } catch {
      saveMirrorThreadReplyDraft(insightDate, draft);
      toast.error(TOAST_SAVE_FAILED);
    } finally {
      savingRef.current = false;
    }
  }, [draft, insightDate, onReplySave, replyEditable]);

  const showReadOnly = !replyEditable && savedText.length > 0;
  const showEditable = replyEditable && Boolean(onReplySave);

  if (!showReadOnly && !showEditable) {
    return null;
  }

  const textareaBlock = (
    <div className="relative">
      <Textarea
        placeholder={REPLY_PLACEHOLDER}
        value={draft}
        maxLength={120}
        rows={3}
        autoFocus={isWriting && Boolean(savedText)}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          saveMirrorThreadReplyDraft(insightDate, next);
        }}
        onBlur={() => {
          void persist();
        }}
        className={cn(
          "min-h-[7rem] w-full resize-y rounded-[28px] border-ink/10 bg-white/30 p-6 font-serif text-lg leading-relaxed",
          "placeholder:text-ink/10",
          "focus-visible:border-brand/30 focus-visible:ring-brand/20",
        )}
      />
      <span className="pointer-events-none absolute bottom-4 right-6 text-[10px] font-serif tracking-widest text-ink/20">
        {draft.length}/120
      </span>
    </div>
  );

  if (showReadOnly) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ReplySectionLabel />
        <div className={replyCardClass}>
          <blockquote className="border-l-2 border-brand/30 pl-4 font-serif text-lg leading-relaxed text-ink/80">
            {savedText}
          </blockquote>
        </div>
      </div>
    );
  }

  if (savedText && !isWriting) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ReplySectionLabel />
        <div className={replyCardClass}>
          <blockquote className="border-l-2 border-brand/30 pl-4 font-serif text-lg leading-relaxed text-ink/80">
            {savedText}
          </blockquote>
          <button
            type="button"
            onClick={() => setIsWriting(true)}
            className="mt-4 font-serif text-sm text-ink/40 transition-colors hover:text-ink/60"
          >
            改一改
          </button>
        </div>
      </div>
    );
  }

  if (isWriting) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ReplySectionLabel />
        <div className={replyCardClass}>
          <p className="mb-4 font-serif text-sm leading-relaxed text-ink/40">
            {REPLY_PLACEHOLDER}
          </p>
          {textareaBlock}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ReplySectionLabel />
      <button
        type="button"
        onClick={() => setIsWriting(true)}
        className={cn(replyCardClass, "w-full text-left")}
      >
        <p className="font-serif text-sm leading-relaxed text-ink/40">{REPLY_PLACEHOLDER}</p>
        <div
          className={cn(
            "mt-4 rounded-[28px] border border-dashed border-ink/10 bg-white/25 px-6 py-4",
          )}
        >
          <span className="font-serif text-base text-ink/20">轻触写下</span>
        </div>
      </button>
    </div>
  );
}

function HeroLoading({
  className,
  showPregenHint,
}: {
  className?: string;
  showPregenHint?: boolean;
}) {
  return (
    <section
      className={cn("w-full max-w-4xl text-center", className)}
      aria-busy="true"
      aria-label={showPregenHint ? "镜脉正在续照" : "镜脉续照加载中"}
    >
      <div className="flex flex-col items-center gap-6 animate-pulse">
        {showPregenHint ? (
          <p className="font-serif text-lg md:text-xl leading-relaxed text-ink/40 italic animate-none">
            镜脉正在续照…
          </p>
        ) : null}
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
  showPregenHint,
  replyEditable = false,
  onReplySave,
  onContinue,
  onStartFresh,
}) => {
  const trackReads = variant === "hero";
  const rootRef = useReadDurationBeacon(data, trackReads);

  if (variant === "loading") {
    return <HeroLoading className={className} showPregenHint={showPregenHint} />;
  }

  if (!data) return null;

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
            不必起新卦，先把昨日的故事读完
          </p>
        </div>

        <div className="flex w-full flex-col gap-8 text-left">
          <div className="mx-auto w-full max-w-3xl">
            <p className="mb-4 font-serif text-xs uppercase tracking-[0.35em] text-ink/30">
              你曾照见
            </p>
            <blockquote className="font-serif text-3xl md:text-4xl leading-relaxed text-ink/90">
              {data.echoText}
            </blockquote>
          </div>

          <div className="mx-auto w-full max-w-3xl">
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

          <MirrorThreadReplySection
            insightDate={data.insightDate}
            userReply={data.userReply}
            replyEditable={replyEditable}
            onReplySave={onReplySave}
          />
        </div>

        <div className="mt-4 w-full max-w-3xl border-t border-ink/5 pt-10">
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
      </div>
    </section>
  );
};
