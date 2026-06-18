import { fetchDeepInquiry, InterpretDailyQuotaError, streamInterpret } from "@/lib/ark-client";
import { normalizeMarkdownTables } from "@/lib/normalize-markdown-report";
import { HEXAGRAMS, LineType, getBinary, getCuoGuaLines, getHuGuaLines, getZongGuaLines } from "@/lib/iching";
import { TomorrowPromiseCard } from "@/components/IChing/TomorrowPromiseCard";
import { daysUntilExpiry } from "@/lib/archive-expiry";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, BookOpen, ClipboardCopy, Compass, Eye, Ghost, Heart, Loader2, Share2 } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownReportRehypePlugins } from "@/lib/markdown-report-rehype";
import { markdownReportMarkdownComponents } from "@/lib/markdown-report-table-tr";
import { toast } from "sonner";
import { DeepDialogue } from "./DeepDialogue";
import { Hexagram } from "./Hexagram";
import type { HistoryItem } from "./History";
import { patchArchive } from "@/lib/archives-api";
import { deleteArchiveShare, postArchiveShare } from "@/lib/share-api";

interface InterpretationProps {
  lines: LineType[];
  question?: string;
  /** 与深入追问本地缓存、DeepDialogue 锚定一致；新解读为 client_session_id，从档案进入为档案 id */
  dialogueAnchorId: string;
  /** 从档案进入：只读已保存内容，不提供再次保存 */
  fromArchive?: boolean;
  /** 从档案进入时已保存的全文（含可选「自我觉察」）；有值则不再请求流式解读 */
  cachedMarkdown?: string;
  /** 与档案一并保存的三条深入追问；缺失时用本地兜底 */
  cachedDeepInquiryQuestions?: string[];
  /** 会员专享：镜下深入对话；免费档为 false */
  canUseDeepFollowUp?: boolean;
  /** 已登录且档案后端可用时，可生成分享短链 */
  archivesShareEnabled?: boolean;
  /** 用于分享/撤销 API 的档案 id：档案入口为档案 id；当场保存后为父组件写入的 savedReportId */
  shareReportId?: string | null;
  /** 从档案打开时：列表接口给出的当前是否仍有有效分享 */
  initialShareActive?: boolean;
  /** 账号当前档位对应的观心档案保留上限天数（非单笔剩余） */
  archiveRetentionDays?: number;
  /** 本条报告失效时刻（毫秒）；autosave 或从档案进入时传入 */
  initialArchiveExpiresAt?: number;
  onSave?: (payload: {
    interpretation: string;
    deepInquiryQuestions?: string[];
  }) => void | Promise<void | HistoryItem>;
}

const SELF_OBSERVATION_QUOTE =
  "照见不是为了判定对错，而是为了在叙事里多一个温柔的停顿；当你写下觉察时，故事便有了可以改写的一笔。";

/** API 失败或未配置时的兜底，与 newjingwei 稿面对齐 */
const FALLBACK_DEEP_INQUIRY: [string, string, string] = [
  "这件事真正触动我的是什么？",
  "我是不是又回到了某个熟悉的模式？",
  "如果不急着做决定，我现在最需要承认什么？",
];

/** 与「保存这次照见」拼接格式一致，用于从档案拆回报告正文与觉察输入框 */
const SELF_OBSERVATION_SECTION = "\n\n### 自我觉察\n";

function splitSavedMarkdown(full: string): { reportBody: string; reflection: string } {
  const idx = full.indexOf(SELF_OBSERVATION_SECTION);
  if (idx === -1) return { reportBody: full, reflection: "" };
  return {
    reportBody: full.slice(0, idx),
    reflection: full.slice(idx + SELF_OBSERVATION_SECTION.length),
  };
}

const THINKING_HINTS = [
  "镜面起雾，卦象正在成形…",
  "取象未毕，先让心静一息…",
  "四镜对照之中，答案正在显影…",
] as const;

/** 将 resetsAt ISO 格式化为北京时间可读文案 */
function formatResetsAtShanghai(iso: string): string {
  if (!iso.trim()) return "下一东八区自然日 0 点";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/** 主解读加载态下，一句文案展示时长（一次「呼吸」） */
const BREATH_MS = 4000;

function SeemingSpinnerGlyph() {
  return (
    <div className="relative" aria-busy={true} aria-live="polite">
      <Loader2 className="animate-spin text-brand" size={48} aria-hidden />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="h-3 w-3 animate-ping rounded-full bg-brand opacity-60" />
      </div>
    </div>
  );
}

export const Interpretation: React.FC<InterpretationProps> = ({
  lines,
  question,
  dialogueAnchorId,
  fromArchive = false,
  cachedMarkdown,
  cachedDeepInquiryQuestions,
  canUseDeepFollowUp = false,
  archivesShareEnabled = false,
  shareReportId = null,
  initialShareActive,
  archiveRetentionDays = 7,
  initialArchiveExpiresAt,
  onSave,
}) => {
  const [interpretation, setInterpretation] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");
  const [showDialogue, setShowDialogue] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);
  const [deepInquiryQuestions, setDeepInquiryQuestions] = useState<string[] | null>(null);
  const [deepInquiryLoading, setDeepInquiryLoading] = useState(false);
  const [archiveExpiresAt, setArchiveExpiresAt] = useState<number | undefined>(initialArchiveExpiresAt);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [stopShareBusy, setStopShareBusy] = useState(false);
  const [copyShareLinkBusy, setCopyShareLinkBusy] = useState(false);
  /** 当场保存后父组件可能尚未重渲染 shareReportId，用返回值兜底 */
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  /** 仅在有活跃分享时展示「停止分享」；当场分享成功会置 true */
  const [hasActiveShare, setHasActiveShare] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const deepInquiryAbortRef = useRef<AbortController | null>(null);
  const autosaveDoneRef = useRef(false);
  const autosavePromiseRef = useRef<Promise<string | null> | null>(null);
  const [hintOffset, setHintOffset] = useState(0);
  const [hintStep, setHintStep] = useState(0);

  useEffect(() => {
    autosaveDoneRef.current = false;
    autosavePromiseRef.current = null;
    setAutosaveFailed(false);
    setSavedItemId(null);
    setArchiveExpiresAt(initialArchiveExpiresAt);
    setHasActiveShare(Boolean(initialShareActive));
  }, [dialogueAnchorId, cachedMarkdown, initialShareActive, initialArchiveExpiresAt]);

  const benLines = lines;
  const huLines = getHuGuaLines(lines);
  const cuoLines = getCuoGuaLines(lines);
  const zongLines = getZongGuaLines(lines);

  const benGua = HEXAGRAMS[getBinary(benLines)];
  const huGua = HEXAGRAMS[getBinary(huLines)];
  const cuoGua = HEXAGRAMS[getBinary(cuoLines)];
  const zongGua = HEXAGRAMS[getBinary(zongLines)];

  useEffect(() => {
    if (cachedMarkdown?.trim()) {
      abortRef.current?.abort();
      deepInquiryAbortRef.current?.abort();
      const { reportBody, reflection: savedReflection } = splitSavedMarkdown(cachedMarkdown);
      setInterpretation(reportBody);
      setReflection(savedReflection);
      setIsLoading(false);
      setError(null);
      setDeepInquiryLoading(false);
      const qs =
        cachedDeepInquiryQuestions && cachedDeepInquiryQuestions.length === 3
          ? [...cachedDeepInquiryQuestions]
          : [...FALLBACK_DEEP_INQUIRY];
      setDeepInquiryQuestions(qs);
      setHintOffset(0);
      setHintStep(0);
      return;
    }

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
      setHintOffset(Math.floor(Math.random() * THINKING_HINTS.length));
      setHintStep(0);
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
        if (err instanceof InterpretDailyQuotaError) {
          const when = formatResetsAtShanghai(err.payload.resetsAt);
          setError(
            `${err.message}（已用 ${err.payload.used}/${err.payload.limit} 次）额度将在 ${when}（北京时间）起恢复。`
          );
          return;
        }
        const hint =
          err instanceof Error && err.message !== "API request failed"
            ? err.message
            : "AI 解读生成失败，请检查网络或 API 配置。";
        setError(hint);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    // 推迟到宏任务：避免 React StrictMode 开发环境下「effect → cleanup → effect」
    // 同步发起两次 stream，导致服务端连续扣两次日额度。
    let cancelled = false;
    const scheduleId = window.setTimeout(() => {
      if (!cancelled) void fetchInterpretation();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(scheduleId);
      abortRef.current?.abort();
    };
  }, [lines, question, benGua, huGua, cuoGua, zongGua, cachedMarkdown, cachedDeepInquiryQuestions]);

  useEffect(() => {
    if (!isLoading || interpretation.trim() !== "") return;
    const id = window.setInterval(() => {
      setHintStep((s) => s + 1);
    }, BREATH_MS);
    return () => clearInterval(id);
  }, [isLoading, interpretation]);

  useEffect(() => {
    if (cachedMarkdown?.trim()) return;
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
  }, [
    cachedMarkdown,
    isLoading,
    error,
    interpretation,
    question,
    benGua,
    huGua,
    cuoGua,
    zongGua,
  ]);

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

  const buildSavePayload = (): {
    interpretation: string;
    deepInquiryQuestions?: string[];
  } => ({
    interpretation: interpretation + (reflection ? `${SELF_OBSERVATION_SECTION}${reflection}` : ""),
    deepInquiryQuestions:
      deepInquiryQuestions && deepInquiryQuestions.length === 3 ? [...deepInquiryQuestions] : undefined,
  });

  const effectiveArchiveId = shareReportId ?? savedItemId;

  const applySavedItem = (item: HistoryItem) => {
    setSavedItemId(item.id);
    if (typeof item.expiresAt === "number") {
      setArchiveExpiresAt(item.expiresAt);
    }
    if (item.share_active) {
      setHasActiveShare(true);
    }
  };

  const waitForArchiveId = async (): Promise<string | null> => {
    if (effectiveArchiveId) return effectiveArchiveId;
    if (autosavePromiseRef.current) {
      return autosavePromiseRef.current;
    }
    return null;
  };

  const runAutosave = useCallback(async (): Promise<string | null> => {
    if (!onSave || fromArchive) return null;
    const text = interpretation.trim();
    if (!text || text.startsWith("未能生成解读")) return null;

    const promise = (async () => {
      const result = await onSave({ interpretation: text });
      if (result && typeof result === "object" && "id" in result && typeof result.id === "string") {
        applySavedItem(result as HistoryItem);
        setAutosaveFailed(false);
        return result.id;
      }
      return null;
    })();

    autosavePromiseRef.current = promise;
    return promise;
  }, [fromArchive, interpretation, onSave]);

  useEffect(() => {
    if (!reportReadyForFollowUp || fromArchive || !onSave) return;
    if (autosaveDoneRef.current) return;

    let cancelled = false;
    const scheduleId = window.setTimeout(() => {
      if (cancelled || autosaveDoneRef.current) return;
      autosaveDoneRef.current = true;
      void runAutosave().catch(() => {
        autosaveDoneRef.current = false;
        setAutosaveFailed(true);
        toast.error("档案未能自动保存，请检查网络");
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(scheduleId);
    };
  }, [reportReadyForFollowUp, fromArchive, onSave, dialogueAnchorId, runAutosave]);

  useEffect(() => {
    if (fromArchive || cachedMarkdown?.trim()) return;
    if (!deepInquiryQuestions || deepInquiryQuestions.length !== 3) return;

    void (async () => {
      const archiveId = await waitForArchiveId();
      if (!archiveId) return;
      try {
        await patchArchive(archiveId, { deep_inquiry_questions: [...deepInquiryQuestions] });
      } catch (patchErr) {
        console.error("patch deep inquiry failed:", patchErr);
      }
    })();
  }, [fromArchive, cachedMarkdown, deepInquiryQuestions]);

  const patchReflectionToArchive = useCallback(async () => {
    const archiveId = await waitForArchiveId();
    if (!archiveId || fromArchive) return;
    const merged =
      interpretation + (reflection ? `${SELF_OBSERVATION_SECTION}${reflection}` : "");
    try {
      await patchArchive(archiveId, { interpretation: merged });
    } catch (e) {
      console.error("patch reflection failed:", e);
    }
  }, [fromArchive, interpretation, reflection]);

  useEffect(() => {
    if (fromArchive) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void patchReflectionToArchive();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fromArchive, patchReflectionToArchive]);

  const expiryDaysLeft =
    typeof archiveExpiresAt === "number" ? daysUntilExpiry(archiveExpiresAt) : null;
  const showExpirySoonHint = expiryDaysLeft !== null && expiryDaysLeft <= 1;

  /** 与系统分享 / 剪贴板一致：叙事文案 + 完整分享 URL（无额外换行） */
  const composeShareClipText = (shareUrl: string) =>
    `我在镜微易经获得了一份观心报告：${benGua?.name ?? ""}卦。针对我的困惑：“${question ?? ""}”，这里照见的是叙事与感受，而非断言。${shareUrl}`;

  const handleShare = async () => {
    if (!archivesShareEnabled) {
      toast.message("请先登录并确保观心档案服务可用后再分享");
      return;
    }
    setShareBusy(true);
    try {
      const archiveId = await waitForArchiveId();
      if (!archiveId) {
        toast.message("报告尚未就绪，请稍候");
        return;
      }
      const { path } = await postArchiveShare(archiveId);
      setHasActiveShare(true);
      const origin = process.env.APP_URL || window.location.origin;
      const shareUrl = `${origin.replace(/\/$/, "")}${path}`;
      const clip = composeShareClipText(shareUrl);
      if (navigator.share) {
        await navigator.share({
          title: "镜微易经 · 观心报告",
          text: clip,
        });
      } else {
        await navigator.clipboard.writeText(clip);
        toast.success("链接已复制到剪贴板");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "分享失败";
      toast.error(msg);
    } finally {
      setShareBusy(false);
    }
  };

  const handleStopShare = async () => {
    const archiveId = effectiveArchiveId;
    if (!archiveId || !archivesShareEnabled) {
      toast.message("当前没有可停止的分享上下文");
      return;
    }
    setStopShareBusy(true);
    try {
      const { revoked } = await deleteArchiveShare(archiveId);
      if (revoked === 0) {
        toast.message("当前没有进行中的分享");
      } else {
        setHasActiveShare(false);
        toast.success("已停止分享");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "停止分享失败");
    } finally {
      setStopShareBusy(false);
    }
  };

  const canStopShare = hasActiveShare && archivesShareEnabled && Boolean(effectiveArchiveId);

  const handleShareButtonClick = () => {
    if (canStopShare) {
      void handleStopShare();
      return;
    }
    void handleShare();
  };

  const shareButtonBusy = shareBusy || stopShareBusy;

  const handleCopyShareLink = async () => {
    if (!archivesShareEnabled) {
      toast.message("无法复制：请先登录并确保观心档案可用");
      return;
    }
    setCopyShareLinkBusy(true);
    try {
      const archiveId = await waitForArchiveId();
      if (!archiveId) {
        toast.message("报告尚未就绪，请稍候");
        return;
      }
      const { path } = await postArchiveShare(archiveId);
      const origin = process.env.APP_URL || window.location.origin;
      const shareUrl = `${origin.replace(/\/$/, "")}${path}`;
      await navigator.clipboard.writeText(composeShareClipText(shareUrl));
      toast.success("分享链接已复制");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "复制失败");
    } finally {
      setCopyShareLinkBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 sm:px-8 flex flex-col gap-10">
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="gap-4 sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-ink">深入追问为会员功能</DialogTitle>
            <DialogDescription className="font-serif text-ink/60 leading-relaxed">
              三条追问是陪你从叙事里多看一角的入口；镜下对话需要会员身份。你仍可完整阅读观心报告与书写自我觉察——照见不是为了断言命运，而是多一个温柔的停顿。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button
                type="button"
                className="rounded-full bg-ink px-8 font-serif tracking-widest text-bg hover:bg-ink/90"
              >
                我知道了
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {showDialogue && (
          <DeepDialogue
            key={`${dialogueAnchorId}-${selectedDirection ?? "open"}`}
            divinationId={dialogueAnchorId}
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
              {!fromArchive && reportReadyForFollowUp && (
                <p className="max-w-md font-serif text-xs text-ink/40">
                  已为你保留 {archiveRetentionDays} 天
                  {showExpirySoonHint && (
                    <span className="mt-1 block text-brand/80">
                      即将过期，请及时分享或回看
                    </span>
                  )}
                </p>
              )}
              {autosaveFailed && !fromArchive && (
                <button
                  type="button"
                  onClick={() => {
                    autosaveDoneRef.current = false;
                    setAutosaveFailed(false);
                    void runAutosave().catch(() => {
                      setAutosaveFailed(true);
                      toast.error("档案未能自动保存，请检查网络");
                    });
                  }}
                  className="font-serif text-xs text-brand underline-offset-2 hover:underline"
                >
                  重试自动保存
                </button>
              )}
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
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={markdownReportRehypePlugins}
                      components={markdownReportMarkdownComponents}
                    >
                      {normalizedInterpretation}
                    </ReactMarkdown>
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
                <SeemingSpinnerGlyph />
                <div className="relative flex min-h-[1.75rem] w-full justify-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${hintOffset}-${hintStep}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: "easeInOut" }}
                      className="max-w-md px-4 text-sm font-serif tracking-widest text-ink/45 italic"
                    >
                      {THINKING_HINTS[(hintOffset + hintStep) % THINKING_HINTS.length]}
                    </motion.div>
                  </AnimatePresence>
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
              <div className="flex w-full flex-col items-center gap-8">
                <SeemingSpinnerGlyph />
                <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-28 animate-pulse rounded-[40px] border border-ink/5 bg-white/40 p-8"
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {(deepInquiryQuestions.length === 3 ? deepInquiryQuestions : [...FALLBACK_DEEP_INQUIRY]).map(
                  (label, i) => (
                    <button
                      key={`deep-inquiry-${i}`}
                      type="button"
                      onClick={() => {
                        if (!canUseDeepFollowUp) {
                          setUpgradeDialogOpen(true);
                          return;
                        }
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
                <p className="mt-1 text-xs font-serif text-ink/40">
                  {fromArchive
                    ? "本条为已保存的观心档案，可在此重温；若需新的照见请从首页再起一卦。"
                    : "把你此刻的回响留在这里，作为对话的补充。"}
                </p>
              </div>
              <Textarea
                placeholder="在此写下你的觉察..."
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                onBlur={() => {
                  if (!fromArchive) void patchReflectionToArchive();
                }}
                readOnly={fromArchive}
                rows={8}
                className={cn(
                  "min-h-[12rem] w-full flex-1 resize-y rounded-[28px] border-ink/10 bg-white/30 p-6 font-serif text-lg leading-relaxed",
                  "placeholder:text-ink/10",
                  "focus-visible:border-brand/30 focus-visible:ring-brand/20",
                  fromArchive && "cursor-default bg-white/20 text-ink/70"
                )}
              />
              {fromArchive ? (
                <p className="rounded-full border border-ink/10 bg-white/40 px-6 py-4 text-center font-serif text-sm text-ink/45">
                  本条已在观心档案中
                  {typeof archiveExpiresAt === "number" && (
                    <span className="mt-1 block text-ink/35">
                      剩余 {daysUntilExpiry(archiveExpiresAt)} 天
                    </span>
                  )}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col justify-between gap-8 lg:pt-1">
              <blockquote className="border-none font-serif text-base italic leading-relaxed text-ink/55 md:text-lg">
                {SELF_OBSERVATION_QUOTE}
              </blockquote>
              <div
                className={cn(
                  "flex flex-col self-start gap-3",
                  canStopShare && "sm:flex-row sm:flex-wrap sm:items-stretch",
                )}
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={shareButtonBusy || copyShareLinkBusy}
                  onClick={handleShareButtonClick}
                  className={cn(
                    "inline-flex h-auto min-h-12 items-center gap-2 rounded-full border-ink/12 px-8 py-4 font-serif text-sm tracking-widest text-ink/60",
                    "hover:bg-white hover:text-ink",
                  )}
                >
                  {shareButtonBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={17} aria-hidden />
                      {canStopShare ? "处理中…" : "正在生成链接…"}
                    </span>
                  ) : canStopShare ? (
                    <>
                      <Ban size={17} className="shrink-0" aria-hidden />
                      <span>停止分享本条</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={17} className="shrink-0" aria-hidden />
                      <span>分享这段见解</span>
                    </>
                  )}
                </Button>
                {canStopShare ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={copyShareLinkBusy || shareButtonBusy}
                    onClick={() => void handleCopyShareLink()}
                    className={cn(
                      "inline-flex h-auto min-h-12 items-center gap-2 rounded-full border-ink/12 px-8 py-4 font-serif text-sm tracking-widest text-ink/60",
                      "hover:bg-white hover:text-ink",
                    )}
                  >
                    {copyShareLinkBusy ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="animate-spin" size={17} aria-hidden />
                        复制中…
                      </span>
                    ) : (
                      <>
                        <ClipboardCopy size={17} className="shrink-0" aria-hidden />
                        <span>复制分享链接</span>
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
          </section>
        )}
        {reportReadyForFollowUp && !fromArchive && effectiveArchiveId && !autosaveFailed ? (
          <TomorrowPromiseCard className="mt-10" />
        ) : null}
      </div>
    </div>
  );
};
