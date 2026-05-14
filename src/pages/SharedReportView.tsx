import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownReportRehypePlugins } from "@/lib/markdown-report-rehype";
import { markdownReportMarkdownComponents } from "@/lib/markdown-report-table-tr";
import { BookOpen, Compass, Eye, Ghost, Heart, Loader2 } from "lucide-react";
import { Hexagram } from "@/components/IChing/Hexagram";
import { Button } from "@/components/ui/button";
import { normalizeMarkdownTables } from "@/lib/normalize-markdown-report";
import { HEXAGRAMS, LineType, getBinary, getCuoGuaLines, getHuGuaLines, getZongGuaLines } from "@/lib/iching";
import { fetchSharedReport } from "@/lib/share-api";
import { cn } from "@/lib/utils";

const LINE_VALUES = new Set([6, 7, 8, 9]);

function asLineTypes(raw: unknown): LineType[] | null {
  if (!Array.isArray(raw) || raw.length !== 6) return null;
  if (!raw.every((v) => typeof v === "number" && LINE_VALUES.has(v))) return null;
  return raw as LineType[];
}

export interface SharedReportViewProps {
  token: string;
}

export const SharedReportView: React.FC<SharedReportViewProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [interpretation, setInterpretation] = useState("");
  const [lines, setLines] = useState<LineType[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSharedReport(token);
        if (cancelled) return;
        const parsed = asLineTypes(data.lines);
        if (!parsed) {
          setError("分享数据中的卦象格式无效");
          setLines(null);
        } else {
          setLines(parsed);
        }
        setQuestion(data.question);
        setInterpretation(data.interpretation);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const benLines = lines ?? [];
  const huLines = getHuGuaLines(benLines);
  const cuoLines = getCuoGuaLines(benLines);
  const zongLines = getZongGuaLines(benLines);
  const benGua = HEXAGRAMS[getBinary(benLines)];
  const huGua = HEXAGRAMS[getBinary(huLines)];
  const cuoGua = HEXAGRAMS[getBinary(cuoLines)];
  const zongGua = HEXAGRAMS[getBinary(zongLines)];

  const mirrors = [
    { title: "现状之镜", gua: benGua, lines: benLines, icon: Eye, color: "text-ink" },
    { title: "内心之镜", gua: huGua, lines: huLines, icon: Heart, color: "text-brand" },
    { title: "阴影之镜", gua: cuoGua, lines: cuoLines, icon: Ghost, color: "text-blue-600" },
    { title: "视角之镜", gua: zongGua, lines: zongLines, icon: Compass, color: "text-emerald-600" },
  ];

  const normalizedInterpretation = useMemo(() => normalizeMarkdownTables(interpretation), [interpretation]);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink selection:bg-brand/10 selection:text-brand">
      <header className="border-b border-ink/5 bg-white/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-[10px] font-medium tracking-[0.35em] text-ink/30 uppercase">SHARED READING</p>
            <h1 className="mt-2 font-serif text-2xl font-bold text-ink sm:text-3xl">镜微易经 · 观心报告</h1>
            <p className="mt-2 max-w-xl text-sm font-serif leading-relaxed text-ink/50">
              他人通过此链接仅可见本条照见，无法访问分享者的观心档案列表。照见呈现的是叙事与感受，而非断言。
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 rounded-full border-ink/15 px-6 font-serif text-sm tracking-widest text-ink/70"
            asChild
          >
            <a href="/">返回首页</a>
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="animate-spin text-brand" size={40} aria-hidden />
            <p className="text-sm font-serif tracking-widest text-ink/40">载入分享内容…</p>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-lg px-6 py-20 text-center">
            <p className="font-serif text-lg text-brand/80">{error}</p>
            <Button className="mt-8 rounded-full bg-ink px-8 font-serif text-bg" asChild>
              <a href="/">回到镜微首页</a>
            </Button>
          </div>
        ) : !lines ? (
          <div className="mx-auto max-w-lg px-6 py-20 text-center font-serif text-ink/50">无法展示此条分享。</div>
        ) : (
          <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8 flex flex-col gap-10">
            {question.trim() ? (
              <p className="text-center font-serif text-sm italic text-ink/50">
                针对意念：<span className="text-ink/70 not-italic">「{question}」</span>
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {mirrors.map((mirror, i) => (
                <motion.div
                  key={mirror.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="group relative rounded-[26px] border border-ink/8 bg-white/50 p-6 shadow-md backdrop-blur-md sm:p-7"
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
                      <h2 className="mb-1 font-serif text-2xl font-bold text-ink sm:text-3xl">{mirror.gua?.name || "未知"}</h2>
                      <p className="text-[10px] font-serif uppercase tracking-[0.35em] text-brand">{mirror.title}</p>
                    </div>
                  </div>
                  <div className="border-t border-ink/5 pt-5 opacity-50">
                    <p className="line-clamp-3 text-center text-[11px] font-serif italic leading-relaxed text-ink/60">
                      “{mirror.gua?.judgment}”
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="relative flex flex-col gap-8 overflow-hidden rounded-[40px] border border-ink/5 bg-white/85 p-9 shadow-2xl backdrop-blur-xl sm:p-12 lg:p-14">
              <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-bg shadow-xl">
                  <BookOpen size={28} aria-hidden />
                </div>
                <h2 className="font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">观心报告</h2>
                <div className="h-px w-32 bg-ink/10" />
              </div>
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
          </div>
        )}
      </main>
    </div>
  );
};
