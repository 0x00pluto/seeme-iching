import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hexagram } from "./Hexagram";
import { LineType, HEXAGRAMS, getBinary, getHuGuaLines, getCuoGuaLines, getZongGuaLines } from "@/lib/iching";
import { cn } from "@/lib/utils";
import { Loader2, Share2, BookOpen, MessageCircle, Eye, Heart, Ghost, Compass, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { DeepDialogue } from "./DeepDialogue";
import { streamInterpret } from "@/lib/ark-client";

interface InterpretationProps {
  lines: LineType[];
  question?: string;
  onSave?: (interpretation: string) => void;
}

export const Interpretation: React.FC<InterpretationProps> = ({ lines, question, onSave }) => {
  const [interpretation, setInterpretation] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");
  const [showDialogue, setShowDialogue] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [thinkingHint, setThinkingHint] = useState<string>("正在取象、观心、通变...");
  const [hasReceivedDelta, setHasReceivedDelta] = useState(false);

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
      setHasReceivedDelta(false);
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
              setHasReceivedDelta(true);
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
        setIsLoading(false);
      }
    };

    fetchInterpretation();
  }, [lines, question, benGua, huGua, cuoGua, zongGua]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const mirrors = [
    { title: "现状之镜", gua: benGua, lines: benLines, icon: Eye, color: "text-ink" },
    { title: "内心之镜", gua: huGua, lines: huLines, icon: Heart, color: "text-accent" },
    { title: "阴影之镜", gua: cuoGua, lines: cuoLines, icon: Ghost, color: "text-blue-600" },
    { title: "视角之镜", gua: zongGua, lines: zongLines, icon: Compass, color: "text-emerald-600" },
  ];

  return (
    <div className="max-w-6xl mx-auto py-12 px-6 flex flex-col gap-12">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mirrors.map((mirror, i) => (
          <motion.div
            key={mirror.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group relative p-8 border border-ink/5 rounded-[40px] bg-white/40 backdrop-blur-md hover:bg-white/60 hover:border-accent/20 transition-all shadow-sm hover:shadow-xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div className={cn("p-3 rounded-2xl bg-bg border border-ink/5 shadow-inner", mirror.color)}>
                <mirror.icon size={20} />
              </div>
              <div className="text-[10px] font-serif uppercase tracking-[0.3em] text-ink/20">Mirror {i + 1}</div>
            </div>
            
            <div className="flex flex-col items-center gap-6 mb-8">
              <Hexagram lines={mirror.lines} size="md" className="w-28" />
              <div className="text-center">
                <h4 className="text-3xl font-serif font-bold text-ink mb-1">{mirror.gua?.name || "未知"}</h4>
                <p className="text-[10px] text-accent font-serif uppercase tracking-[0.4em]">{mirror.title}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* AI Synthesis */}
        <div className="lg:col-span-2 flex flex-col gap-8 p-10 lg:p-16 border border-ink/5 rounded-[56px] bg-white/80 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
          
          <div className="flex flex-col items-center gap-4 text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-ink flex items-center justify-center text-bg shadow-xl">
              <BookOpen size={28} />
            </div>
            <h3 className="text-4xl font-serif font-bold tracking-tight text-ink">观心报告</h3>
            <div className="h-px w-32 bg-ink/10" />
          </div>

          {isLoading && !error && !hasReceivedDelta && (
            <div className="flex flex-col items-center text-center -mt-4 mb-8">
              <div className="text-sm text-ink/30 font-serif italic tracking-widest animate-pulse">
                {thinkingHint}
              </div>
            </div>
          )}

          {error ? (
            <div className="text-center py-16 text-accent/60 font-serif italic whitespace-pre-wrap text-sm max-w-xl mx-auto px-4">
              {error}
            </div>
          ) : interpretation.trim().length > 0 ? (
            <div className="flex flex-col gap-6">
              <div className="prose prose-ink max-w-none font-serif text-xl leading-relaxed text-ink/70">
                <ReactMarkdown>{interpretation}</ReactMarkdown>
              </div>
              {isLoading && (
                <div className="flex items-center justify-center gap-2 text-[11px] text-ink/25 font-serif italic tracking-widest">
                  <Loader2 size={14} className="animate-spin text-accent" />
                  <span>生成中…</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 gap-8">
              <div className="relative">
                <Loader2 className="animate-spin text-accent" size={56} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 bg-accent rounded-full animate-ping" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Reflection */}
        <div className="flex flex-col gap-8 p-10 border border-ink/5 rounded-[56px] bg-white/40 backdrop-blur-md shadow-xl">
          <div className="flex flex-col gap-2">
            <h4 className="text-2xl font-serif font-bold text-ink">自我觉察</h4>
            <p className="text-xs text-ink/40 font-serif">记录你此时此刻的感悟与回响</p>
          </div>
          
          <textarea
            placeholder="在此写下你的觉察..."
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            className="flex-1 w-full p-6 rounded-[32px] border border-ink/5 bg-white/20 focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent/20 transition-all resize-none font-serif text-lg leading-relaxed placeholder:text-ink/10"
          />

          <button 
            onClick={() => onSave?.(interpretation + (reflection ? `\n\n### 自我觉察\n${reflection}` : ""))}
            className="w-full py-6 rounded-full bg-ink text-bg font-serif text-lg font-bold tracking-widest hover:opacity-90 transition-all shadow-xl shadow-ink/10"
          >
            保存这份档案
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-6 pt-12">
        <button 
          onClick={() => {
            const shareUrl = process.env.APP_URL || window.location.origin;
            const shareText = `我在镜微易经获得了一份观心报告：${benGua?.name}卦。针对我的困惑：“${question}”，AI 给了我深刻的启发。`;
            if (navigator.share) {
              navigator.share({
                title: '镜微易经 · 观心报告',
                text: shareText,
                url: shareUrl,
              }).catch(console.error);
            } else {
              navigator.clipboard.writeText(`${shareText}\n查看更多：${shareUrl}`);
              alert("链接已复制到剪贴板");
            }
          }}
          className="group flex items-center justify-center gap-3 px-10 py-5 rounded-full border border-ink/10 text-sm text-ink/40 hover:text-ink hover:bg-white transition-all"
        >
          <Share2 size={18} className="group-hover:scale-110 transition-transform" />
          <span className="font-serif tracking-widest">分享这份观照</span>
        </button>
        <button 
          onClick={() => setShowDialogue(true)}
          className="group flex items-center justify-center gap-3 px-10 py-5 rounded-full bg-ink text-bg text-sm hover:scale-105 transition-all shadow-2xl shadow-ink/20"
        >
          <MessageCircle size={18} className="group-hover:animate-bounce" />
          <span className="font-serif tracking-widest">继续深度对话</span>
        </button>
      </div>
    </div>
  );
};
