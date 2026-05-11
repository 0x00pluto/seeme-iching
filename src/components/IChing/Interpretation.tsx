import { streamInterpret } from "@/lib/ark-client";
import { HEXAGRAMS, LineType, getBinary, getCuoGuaLines, getHuGuaLines, getZongGuaLines } from "@/lib/iching";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Compass, Eye, Ghost, Heart, Loader2, MessageCircle, Share2 } from "lucide-react";
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

function normalizeMarkdownTables(markdown: string): string {
  if (!markdown.includes("|")) return markdown;

  // Streaming output occasionally merges table rows into one line, so we split obvious row boundaries.
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
  const abortRef = useRef<AbortController | null>(null);
  const [thinkingHint, setThinkingHint] = useState<string>("正在取象、观心、通变...");
  const THINKING_HINTS = [
    "镜面起雾，卦象正在成形…",
    "取象未毕，先让心静一息…",
    "四镜对照之中，答案正在显影…",
  ];

  // Derive the 4 mirrors
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
        /** 被取消的请求也会走 finally；若在此处 setLoading(false)，会在 StrictMode/重跑 effect 时把 loading 误判为结束并闪出「暂无可呈现」。 */
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchInterpretation();
    return () => {
      abortRef.current?.abort();
    };
  }, [lines, question, benGua, huGua, cuoGua, zongGua]);

  const mirrors = [
    { title: "现状之镜", gua: benGua, lines: benLines, icon: Eye, color: "text-ink" },
    { title: "内心之镜", gua: huGua, lines: huLines, icon: Heart, color: "text-brand" },
    { title: "阴影之镜", gua: cuoGua, lines: cuoLines, icon: Ghost, color: "text-blue-600" },
    { title: "视角之镜", gua: zongGua, lines: zongLines, icon: Compass, color: "text-emerald-600" },
  ];
  const normalizedInterpretation = useMemo(() => normalizeMarkdownTables(interpretation), [interpretation]);

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 sm:px-8 flex flex-col gap-10">
      <AnimatePresence>
        {showDialogue && (
          <DeepDialogue 
            divinationId={Date.now().toString()} 
            question={question || "未提供具体问题"} 
            interpretation={interpretation}
            onClose={() => setShowDialogue(false)}
          />
        )}
      </AnimatePresence>

      {/* Bento Grid Mirrors */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {mirrors.map((mirror, i) => (
          <motion.div
            key={mirror.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group relative p-7 sm:p-8 border border-ink/5 rounded-[36px] bg-white/40 backdrop-blur-md hover:bg-white/60 hover:border-brand/20 transition-all shadow-sm hover:shadow-xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div className={cn("p-3 rounded-2xl bg-bg border border-ink/5 shadow-inner", mirror.color)}>
                <mirror.icon size={20} />
              </div>
              <div className="text-[10px] font-medium tracking-[0.35em] text-ink/25">
                MIRROR {i + 1}
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-6 mb-8">
              <Hexagram lines={mirror.lines} size="md" className="w-28" />
              <div className="text-center">
                <h4 className="text-3xl font-serif font-bold text-ink mb-1">{mirror.gua?.name || "未知"}</h4>
                <p className="text-[10px] text-brand font-serif uppercase tracking-[0.4em]">{mirror.title}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-ink/5 opacity-40 group-hover:opacity-100 transition-opacity">
              <p className="text-[11px] font-serif leading-relaxed text-ink/60 line-clamp-3 italic text-center">
                “{mirror.gua?.judgment}”
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-11">
        {/* AI Synthesis */}
        <div className="lg:col-span-2 flex flex-col gap-8 p-9 sm:p-12 lg:p-14 border border-ink/5 rounded-[52px] bg-white/80 backdrop-blur-xl shadow-2xl relative overflow-hidden min-h-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
          
          <div className="flex flex-col items-center gap-4 text-center shrink-0">
            <div className="w-14 h-14 rounded-full bg-ink flex items-center justify-center text-bg shadow-xl">
              <BookOpen size={28} />
            </div>
            <h3 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-ink">观心报告</h3>
            <div className="h-px w-32 bg-ink/10" />
          </div>

          <div className="flex flex-col flex-1 min-h-[min(28rem,52vh)]">
            {error ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center py-12 text-brand/70 font-serif italic whitespace-pre-wrap text-sm max-w-xl mx-auto px-4">
                {error}
              </div>
            ) : interpretation.trim().length > 0 ? (
              <div className="flex flex-col gap-6 flex-1">
                <div className="markdown-report text-[1.05rem] sm:text-xl leading-relaxed text-ink/75">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizedInterpretation}</ReactMarkdown>
                </div>
                {isLoading && (
                  <div className="flex items-center justify-center gap-2 text-[11px] text-ink/25 font-serif italic tracking-widest pt-2">
                    <Loader2 size={14} className="animate-spin text-brand" aria-hidden />
                    <span>生成中…</span>
                  </div>
                )}
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center text-center flex-1 gap-6 py-12">
                <div className="relative" aria-busy="true" aria-live="polite">
                  <Loader2 className="animate-spin text-brand" size={48} aria-hidden />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="w-3 h-3 bg-brand rounded-full animate-ping opacity-60" />
                  </div>
                </div>
                <div className="text-sm text-ink/45 font-serif italic tracking-widest animate-pulse max-w-md px-4">
                  {thinkingHint}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-sm text-ink/35 font-serif">
                暂无可呈现的解读内容。
              </div>
            )}
          </div>
        </div>

        {/* User Reflection */}
        <div className="flex flex-col gap-7 p-9 sm:p-10 border border-ink/5 rounded-[52px] bg-white/40 backdrop-blur-md shadow-xl min-h-0 lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-col gap-2">
            <h4 className="text-2xl font-serif font-bold text-ink">自我觉察</h4>
            <p className="text-xs text-ink/40 font-serif">记录你此时此刻的感悟与回响</p>
          </div>
          
          <Textarea
            placeholder="在此写下你的觉察..."
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={8}
            className={cn(
              "min-h-[12rem] w-full flex-1 resize-y rounded-[32px] border-ink/10 bg-white/20 p-6 font-serif text-lg leading-relaxed md:text-lg",
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
            保存这份档案
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-5 sm:gap-6 pt-8 sm:pt-10 pb-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const shareUrl = process.env.APP_URL || window.location.origin;
            const shareText = `我在镜微易经获得了一份观心报告：${benGua?.name}卦。针对我的困惑：“${question}”，AI 给了我深刻的启发。`;
            if (navigator.share) {
              navigator.share({
                title: "镜微易经 · 观心报告",
                text: shareText,
                url: shareUrl,
              }).catch(console.error);
            } else {
              navigator.clipboard.writeText(`${shareText}\n查看更多：${shareUrl}`);
              alert("链接已复制到剪贴板");
            }
          }}
          className={cn(
            "h-auto min-h-12 gap-3 rounded-full border-ink/10 px-10 py-5 font-serif text-sm tracking-widest text-ink/50",
            "hover:bg-white hover:text-ink"
          )}
        >
          <Share2 size={18} className="transition-transform group-hover/button:scale-110" aria-hidden />
          分享这份观照
        </Button>
        <Button
          type="button"
          onClick={() => setShowDialogue(true)}
          className={cn(
            "h-auto min-h-12 gap-3 rounded-full bg-ink px-10 py-5 font-serif text-sm tracking-widest text-bg shadow-2xl shadow-ink/20",
            "hover:bg-ink/90 hover:opacity-100",
            "hover:scale-[1.02] active:scale-[0.99]",
            "focus-visible:ring-brand/40"
          )}
        >
          <MessageCircle size={18} className="group-hover/button:animate-bounce" aria-hidden />
          继续深度对话
        </Button>
      </div>
    </div>
  );
};
