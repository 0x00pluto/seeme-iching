import { fetchDeepInquiry, streamInterpret } from "@/lib/ark-client";
import { HEXAGRAMS, LineType, getBinary, getCuoGuaLines, getHuGuaLines, getZongGuaLines } from "@/lib/iching";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Compass, Eye, Ghost, Heart, Loader2, Share2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DeepDialogue } from "./DeepDialogue";
import { Hexagram } from "./Hexagram";

interface InterpretationProps {
  lines: LineType[];
  question?: string;
  onSave?: (interpretation: string) => void;
}

const TABLE_SEPARATOR_REGEX = /\|(?:\s*:?-{3,}:?\s*\|)+/g;

const SELF_OBSERVATION_QUOTE =
  "照见不是为了判定对错，而是为了在叙事里多一个温柔的停顿；当你写下觉察时，故事便有了可以改写的一笔。";

/** API 失败或未配置时的兜底，与 newjingwei 稿面对齐 */
const FALLBACK_DEEP_INQUIRY: [string, string, string] = [
  "这件事真正触动我的是什么？",
  "我是不是又回到了某个熟悉的模式？",
  "如果不急着做决定，我现在最需要承认什么？",
];

function normalizeMarkdownTables(markdown: string): string {
  if (!markdown.includes("|")) return markdown;

  let normalized = markdown.replace(/\r\n/g, "\n").replace(/\|\s+\|/g, "|\n|");

  normalized = normalized.replace(/([^\n])(\|(?:\s*:?-{3,}:?\s*\|)+)/g, "$1\n$2");
  normalized = normalized.replace(/(\|(?:\s*:?-{3,}:?\s*\|)+)([^\n])/g, "$1\n$2");

  const lines = normalized.split("\n");
  const fixedLines: string[] = [];

  for (const line of lines) {
    if (!line.includes("|")) {
      fixedLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      fixedLines.push(trimmed);
      continue;
    }

    const firstPipe = line.indexOf("|");
    const lastPipe = line.lastIndexOf("|");
    if (firstPipe > 0 && lastPipe > firstPipe) {
      const prefix = line.slice(0, firstPipe).trimEnd();
      const row = line.slice(firstPipe, lastPipe + 1).trim();
      const suffix = line.slice(lastPipe + 1).trimStart();
      if (prefix) fixedLines.push(prefix);
      fixedLines.push(row);
      if (suffix) fixedLines.push(suffix);
      continue;
    }

    fixedLines.push(line);
  }

  return fixedLines
    .join("\n")
    .replace(TABLE_SEPARATOR_REGEX, (match) => `\n${match.trim()}\n`)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const Interpretation: React.FC<InterpretationProps> = ({ lines, question, onSave }) => {
  const [interpretation, setInterpretation] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");
  const [showDialogue, setShowDialogue] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);
  const [deepInquiryQuestions, setDeepInquiryQuestions] = useState<string[] | null>(null);
  const [deepInquiryLoading, setDeepInquiryLoading] = useState(false);
  const [readingSessionId] = useState(() => `reading_${Date.now()}`);
  const abortRef = useRef<AbortController | null>(null);
  const deepInquiryAbortRef = useRef<AbortController | null>(null);
  const [thinkingHint, setThinkingHint] = useState<string>("正在取象、观心、通变...");
  const THINKING_HINTS = [
    "镜面起雾，卦象正在成形…",
    "取象未毕，先让心静一息…",
    "四镜对照之中，答案正在显影…",
  ];

  const benLines = lines;
  const huLines = getHuGuaLines(lines);
  const cuoLines = getCuoGuaLines(lines);
  const zongLines = getZongGuaLines(lines);

  const benGua = HEXAGRAMS[getBinary(benLines)];
  const huGua = HEXAGRAMS[getBinary(huLines)];
  const cuoGua = HEXAGRAMS[getBinary(cuoLines)];
  const zongGua = HEXAGRAMS[getBinary(zongLines)];

  useEffect(() => {
    const fetchInterpretation = async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);
      setInterpretation("");
      setDeepInquiryQuestions(null);
      setDeepInquiryLoading(false);
      deepInquiryAbortRef.current?.abort();
      setThinkingHint(THINKING_HINTS[Math.floor(Math.random() * THINKING_HINTS.length)] ?? "正在取象、观心、通变...");
      try {
        let receivedAny = false;
        await streamInterpret(
          {
            question,
            benGua,
            huGua,
            cuoGua,
            zongGua,
          },
          {
            onDelta: (delta) => {
              receivedAny = true;
              setInterpretation((prev) => prev + delta);
            },
          },
          { signal: controller.signal }
        );

        if (!receivedAny) {
          setInterpretation("未能生成解读，请稍后再试。");
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("API Error:", err);
        const hint =
          err instanceof Error && err.message !== "API request failed"
            ? err.message
            : "AI 解读生成失败，请检查网络或 API 配置。";
        setError(hint);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchInterpretation();
    return () => {
      abortRef.current?.abort();
    };
  }, [lines, question, benGua, huGua, cuoGua, zongGua]);

  useEffect(() => {
    if (isLoading || error) return;
    const text = interpretation.trim();
    if (!text || text.startsWith("未能生成解读")) return;

    deepInquiryAbortRef.current?.abort();
    const controller = new AbortController();
    deepInquiryAbortRef.current = controller;

    setDeepInquiryLoading(true);
    void (async () => {
      try {
        const { deepInquiry } = await fetchDeepInquiry(
          {
            question,
            interpretation: text,
            benGua,
            huGua,
            cuoGua,
            zongGua,
          },
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) {
          setDeepInquiryQuestions([...deepInquiry]);
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        console.error("Deep inquiry fetch failed:", e);
        if (!controller.signal.aborted) {
          setDeepInquiryQuestions([...FALLBACK_DEEP_INQUIRY]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setDeepInquiryLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isLoading, error, interpretation, question, benGua, huGua, cuoGua, zongGua]);

  const mirrors = [
    { title: "现状之镜", gua: benGua, lines: benLines, icon: Eye, color: "text-ink" },
    { title: "内心之镜", gua: huGua, lines: huLines, icon: Heart, color: "text-brand" },
    { title: "阴影之镜", gua: cuoGua, lines: cuoLines, icon: Ghost, color: "text-blue-600" },
    { title: "视角之镜", gua: zongGua, lines: zongLines, icon: Compass, color: "text-emerald-600" },
  ];
  const normalizedInterpretation = useMemo(() => normalizeMarkdownTables(interpretation), [interpretation]);
  const showReportHeader = interpretation.trim().length > 0;
  /** 解读流已结束且为有效正文：再展示 DEEP INQUIRY 与自我觉察（与流式中的占位区分） */
  const reportReadyForFollowUp =
    !isLoading &&
    !error &&
    interpretation.trim().length > 0 &&
    !interpretation.trim().startsWith("未能生成解读");

  const handleShare = () => {
    const shareUrl = process.env.APP_URL || window.location.origin;
    const shareText = `我在镜微易经获得了一份观心报告：${benGua?.name}卦。针对我的困惑：“${question}”，这里照见的是叙事与感受，而非断言。`;
    if (navigator.share) {
      navigator
        .share({
          title: "镜微易经 · 观心报告",
          text: shareText,
          url: shareUrl,
        })
        .catch(console.error);
    } else {
      void navigator.clipboard.writeText(`${shareText}\n查看更多：${shareUrl}`);
      alert("链接已复制到剪贴板");
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 sm:px-8 flex flex-col gap-10">
      <AnimatePresence>
        {showDialogue && (
          <DeepDialogue
            key={`${readingSessionId}-${selectedDirection ?? "open"}`}
            divinationId={readingSessionId}
            question={question || "未提供具体问题"}
            interpretation={interpretation}
            direction={selectedDirection ?? undefined}
            onClose={() => {
              setShowDialogue(false);
              setSelectedDirection(null);
            }}
          />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-5">
        {mirrors.map((mirror, i) => (
          <motion.div
            key={mirror.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group relative rounded-[26px] border border-ink/8 bg-white/50 p-6 shadow-md backdrop-blur-md transition-all hover:border-brand/20 hover:bg-white/70 hover:shadow-lg sm:p-7"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className={cn("rounded-xl border border-ink/5 bg-bg p-2.5 shadow-inner", mirror.color)}>
                <mirror.icon size={20} />
              </div>
              <div className="text-[10px] font-medium tracking-[0.3em] text-ink/25">MIRROR {i + 1}</div>
            </div>

            <div className="mb-6 flex flex-col items-center gap-5">
              <Hexagram lines={mirror.lines} size="md" className="w-28" />
              <div className="text-center">
                <h4 className="mb-1 font-serif text-2xl font-bold text-ink sm:text-3xl">{mirror.gua?.name || "未知"}</h4>
                <p className="text-[10px] font-serif uppercase tracking-[0.35em] text-brand">{mirror.title}</p>
              </div>
            </div>

            <div className="border-t border-ink/5 pt-5 opacity-40 transition-opacity group-hover:opacity-100">
              <p className="line-clamp-3 text-center text-[11px] font-serif italic leading-relaxed text-ink/60">
                “{mirror.gua?.judgment}”
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-10">
        <div className="relative flex min-h-0 flex-col gap-8 overflow-hidden rounded-[40px] border border-ink/5 bg-white/85 p-9 shadow-2xl backdrop-blur-xl sm:p-12 lg:p-14">
          <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-brand/30 to-transparent" />

          {showReportHeader && (
            <div className="flex shrink-0 flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-bg shadow-xl">
                <BookOpen size={28} aria-hidden />
              </div>
              <h3 className="font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">观心报告</h3>
              <div className="h-px w-32 bg-ink/10" />
            </div>
          )}

          <div className="flex min-h-[min(24rem,42vh)] flex-1 flex-col">
            {error ? (
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center text-sm font-serif text-brand/75 italic whitespace-pre-wrap">
                {error}
              </div>
            ) : interpretation.trim().length > 0 ? (
              <div className="flex flex-1 flex-col gap-6">
                <div className="relative min-h-0">
                  <div className="markdown-report text-[1.05rem] leading-relaxed text-ink/75 sm:text-xl">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizedInterpretation}</ReactMarkdown>
                  </div>
                </div>
                {isLoading && (
                  <div className="flex items-center justify-center gap-2 pt-2 text-[11px] font-serif tracking-widest text-ink/25 italic">
                    <Loader2 size={14} className="animate-spin text-brand" aria-hidden />
                    <span>生成中…</span>
                  </div>
                )}
              </div>
            ) : isLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12 text-center">
                <div className="relative" aria-busy="true" aria-live="polite">
                  <Loader2 className="animate-spin text-brand" size={48} aria-hidden />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="h-3 w-3 animate-ping rounded-full bg-brand opacity-60" />
                  </div>
                </div>
                <div className="max-w-md animate-pulse px-4 text-sm font-serif tracking-widest text-ink/45 italic">
                  {thinkingHint}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-sm font-serif text-ink/35">
                暂无可呈现的解读内容。
              </div>
            )}
          </div>
        </div>

        {reportReadyForFollowUp && (
          <section className="flex flex-col gap-8 pt-2">
            <div className="text-center">
              <p className="text-[10px] font-medium tracking-[0.35em] text-ink/30 uppercase">DEEP INQUIRY</p>
              <h4 className="mt-2 font-serif text-xl leading-snug text-ink/60 sm:text-[1.35rem]">
                如果你愿意继续看下去，镜微可以陪你从三个方向深入：
              </h4>
            </div>
            {deepInquiryLoading || deepInquiryQuestions === null ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-[40px] border border-ink/5 bg-white/40 p-8"
                    aria-hidden
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {(deepInquiryQuestions.length === 3 ? deepInquiryQuestions : [...FALLBACK_DEEP_INQUIRY]).map(
                  (label, i) => (
                    <button
                      key={`deep-inquiry-${i}`}
                      type="button"
                      onClick={() => {
                        setSelectedDirection(label);
                        setShowDialogue(true);
                      }}
                      className={cn(
                        "flex min-h-[7.5rem] items-center rounded-[40px] border border-ink/5 bg-white p-8 text-left font-serif text-lg leading-snug text-ink/60 shadow-sm transition-all",
                        "hover:border-brand/25 hover:bg-brand/[0.04] hover:text-ink hover:shadow-md"
                      )}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {reportReadyForFollowUp && (
          <section className="grid grid-cols-1 gap-10 rounded-[40px] border border-ink/5 bg-white/45 p-8 shadow-xl backdrop-blur-md lg:grid-cols-2 lg:gap-12 lg:p-11">
            <div className="flex min-h-0 flex-col gap-5">
              <div>
                <h4 className="font-serif text-2xl font-bold text-ink">自我觉察</h4>
                <p className="mt-1 text-xs font-serif text-ink/40">把你此刻的回响留在这里，作为对话的补充。</p>
              </div>
              <Textarea
                placeholder="在此写下你的觉察..."
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={8}
                className={cn(
                  "min-h-[12rem] w-full flex-1 resize-y rounded-[28px] border-ink/10 bg-white/30 p-6 font-serif text-lg leading-relaxed",
                  "placeholder:text-ink/10",
                  "focus-visible:border-brand/30 focus-visible:ring-brand/20"
                )}
              />
              <Button
                type="button"
                onClick={() => onSave?.(interpretation + (reflection ? `\n\n### 自我觉察\n${reflection}` : ""))}
                className={cn(
                  "h-auto min-h-14 w-full rounded-full bg-ink py-6 font-serif text-lg font-bold tracking-widest text-bg shadow-xl shadow-ink/10",
                  "hover:bg-ink/90 hover:opacity-100",
                  "focus-visible:ring-brand/40"
                )}
              >
                保存这次照见
              </Button>
            </div>

            <div className="flex flex-col justify-between gap-8 lg:pt-1">
              <blockquote className="border-none font-serif text-base italic leading-relaxed text-ink/55 md:text-lg">
                {SELF_OBSERVATION_QUOTE}
              </blockquote>
              <Button
                type="button"
                variant="outline"
                onClick={handleShare}
                className={cn(
                  "h-auto min-h-12 self-start rounded-full border-ink/12 px-8 py-4 font-serif text-sm tracking-widest text-ink/60",
                  "hover:bg-white hover:text-ink"
                )}
              >
                <Share2 size={17} className="shrink-0" aria-hidden />
                <span className="ml-2">分享这段见解</span>
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
