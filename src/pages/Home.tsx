import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Divination } from "@/components/IChing/Divination";
import { Interpretation } from "@/components/IChing/Interpretation";
import { History, HistoryItem } from "@/components/IChing/History";
import { LineType } from "@/lib/iching";
import { cn } from "@/lib/utils";
import { Sparkles, ChevronRight, History as HistoryIcon, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const HISTORY_STORAGE_KEY = "iching_history";

type AppState = "landing" | "divination" | "interpretation" | "history";

export const Home: React.FC = () => {
  const [state, setState] = useState<AppState>("landing");
  const [lines, setLines] = useState<LineType[]>([]);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const canStartDivination = question.trim().length > 0;

  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!savedHistory) return;
    try {
      setHistory(JSON.parse(savedHistory));
    } catch (e) {
      console.error("Failed to load local history", e);
    }
  }, []);

  const saveToHistory = async (item: HistoryItem) => {
    const newHistory = [item, ...history];
    setHistory(newHistory);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
  };

  const clearHistory = async () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    toast.success("本地档案已清空");
  };

  const handleComplete = (newLines: LineType[]) => {
    setLines(newLines);
    setTimeout(() => {
      setState("interpretation");
    }, 1000);
  };

  const startDivination = () => {
    if (!canStartDivination) return;
    setState("divination");
  };

  const handleSelectItem = (item: HistoryItem) => {
    setLines(item.lines);
    setQuestion(item.question);
    setState("interpretation");
  };

  const goBack = () => {
    if (state === "divination") setState("landing");
    if (state === "interpretation") setState("divination");
    if (state === "history") setState("landing");
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink selection:bg-brand/10 selection:text-brand">
      {/* Toaster is in App.tsx */}
      
      <header className="flex justify-between items-center px-8 py-6 border-b border-ink/5 sticky top-0 bg-bg/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.7 }}
            onClick={() => setState("landing")}
            className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-bg font-serif text-sm font-bold cursor-pointer"
          >
            镜
          </motion.div>
          <h1 className="text-xl font-serif font-bold tracking-widest text-ink/80">镜微 · I-CHING</h1>
        </div>
        
        <nav className="flex items-center gap-8">
          <button 
            onClick={() => setState("history")}
            className={cn(
              "text-xs font-serif tracking-widest uppercase flex items-center gap-2 transition-colors",
              state === "history" ? "text-brand" : "text-ink/40 hover:text-ink/80"
            )}
          >
            <HistoryIcon size={14} />
            <span>档案</span>
          </button>
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {state === "landing" && (
            <motion.section
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-5xl mx-auto py-24 px-8 flex flex-col items-center text-center gap-20"
            >
              <div className="flex flex-col gap-8">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-4 text-brand font-serif tracking-[0.4em] uppercase"
                >
                  <div className="h-px w-8 bg-brand/30" />
                  <span>以卦为镜 · 观心自省</span>
                  <div className="h-px w-8 bg-brand/30" />
                </motion.div>
                
                <h2 className="text-5xl md:text-7xl font-serif font-bold tracking-tight leading-[1.1] text-ink max-w-4xl">
                  易经非预言之术，<br />
                  而是照见内心模式的明镜。
                </h2>
                
                <p className="text-lg md:text-xl text-ink/40 font-serif max-w-2xl mx-auto leading-relaxed italic">
                  “观乎天文，以察时变；观乎人文，以化成天下。”<br />
                  在这里，卦象是你的投影，AI 是你的回响。
                </p>
              </div>

              <div className="flex flex-col gap-10 w-full max-w-xl relative">
                {/* Decorative Mirror Frame */}
                <div className="absolute -inset-10 border border-ink/5 rounded-[60px] pointer-events-none opacity-50" />
                
                <div className="relative group">
                  <textarea
                    placeholder="闭目静思，在此输入你当下的困惑或意念..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="w-full h-48 p-8 rounded-[40px] border border-ink/10 bg-white/30 backdrop-blur-md focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/20 transition-all resize-none font-serif text-xl leading-relaxed placeholder:text-ink/10 shadow-2xl shadow-ink/5"
                  />
                  <div className="absolute bottom-6 right-8 flex items-center gap-2 text-[10px] text-ink/20 font-serif uppercase tracking-widest pointer-events-none">
                    <Sparkles size={12} />
                    <span>意念凝聚</span>
                  </div>
                </div>

                <button
                  onClick={startDivination}
                  disabled={!canStartDivination}
                  className={cn(
                    "group relative px-16 py-8 rounded-full bg-ink text-bg font-serif text-2xl font-bold tracking-[0.2em] overflow-hidden transition-all shadow-2xl shadow-ink/20",
                    canStartDivination
                      ? "active:scale-95 hover:shadow-brand/20 cursor-pointer"
                      : "opacity-40 cursor-not-allowed"
                  )}
                >
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-r from-brand/0 via-brand/20 to-brand/0 transition-transform duration-1000",
                      canStartDivination ? "-translate-x-full group-hover:translate-x-full" : "-translate-x-full"
                    )}
                  />
                  <span className="relative flex items-center justify-center gap-4">
                    进入镜中
                    <ChevronRight
                      size={24}
                      className={cn(
                        "opacity-20 transition-transform",
                        canStartDivination ? "group-hover:translate-x-2" : ""
                      )}
                    />
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-16 pt-32 border-t border-ink/5 w-full">
                <div className="flex flex-col gap-4 text-left group">
                  <div className="text-xs text-brand/40 font-serif tracking-widest uppercase group-hover:text-brand transition-colors">01 · 现状之镜</div>
                  <h4 className="text-xl font-serif font-bold text-ink/80">观照当下</h4>
                  <p className="text-sm text-ink/40 font-serif leading-relaxed">通过本卦，客观审视你目前所处的外部环境与事态表象。</p>
                </div>
                <div className="flex flex-col gap-4 text-left group">
                  <div className="text-xs text-brand/40 font-serif tracking-widest uppercase group-hover:text-brand transition-colors">02 · 内心之镜</div>
                  <h4 className="text-xl font-serif font-bold text-ink/80">洞察动机</h4>
                  <p className="text-sm text-ink/40 font-serif leading-relaxed">通过互卦，揭示事态核心隐藏的动力，以及你内心深处的真实渴望。</p>
                </div>
                <div className="flex flex-col gap-4 text-left group">
                  <div className="text-xs text-brand/40 font-serif tracking-widest uppercase group-hover:text-brand transition-colors">03 · 通变之道</div>
                  <h4 className="text-xl font-serif font-bold text-ink/80">心理指引</h4>
                  <p className="text-sm text-ink/40 font-serif leading-relaxed">结合阴影与视角之镜，由 AI 提供多维度的深度心理分析与行动启发。</p>
                </div>
              </div>
            </motion.section>
          )}

          {state === "divination" && (
            <motion.section
              key="divination"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto py-20 px-8 flex flex-col items-center gap-12"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <button 
                  onClick={goBack}
                  className="flex items-center gap-2 text-xs text-ink/30 hover:text-ink/60 transition-colors font-serif tracking-widest uppercase mb-4"
                >
                  <ArrowLeft size={14} />
                  <span>返回</span>
                </button>
                <h2 className="text-4xl font-serif font-bold text-ink">镜中观象</h2>
                <p className="text-sm text-ink/40 font-serif max-w-md italic">
                  {question ? `针对意念: "${question}"` : "请保持呼吸平稳，心中默念你的困惑。"}
                </p>
              </div>
              
              <Divination onComplete={handleComplete} />
            </motion.section>
          )}

          {state === "interpretation" && (
            <motion.section
              key="interpretation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <div className="max-w-6xl mx-auto pt-12 px-8 flex items-center justify-between">
                <button 
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-2 text-xs text-ink/30 hover:text-ink/60 transition-colors font-serif tracking-widest uppercase rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  <ArrowLeft size={14} aria-hidden />
                  <span>重新测算</span>
                </button>
                <div className="text-[10px] text-brand font-serif tracking-[0.3em] uppercase">观心报告 · 正在呈现</div>
              </div>
              <Interpretation 
                lines={lines} 
                question={question} 
                onSave={(interpretation) => {
                  saveToHistory({
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    question,
                    lines,
                    interpretation
                  });
                  toast.success("观心档案已保存");
                }}
              />
            </motion.section>
          )}

          {state === "history" && (
            <motion.section
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto py-20 px-8"
            >
              <div className="mb-12">
                <button 
                  onClick={goBack}
                  className="flex items-center gap-2 text-xs text-ink/30 hover:text-ink/60 transition-colors font-serif tracking-widest uppercase"
                >
                  <ArrowLeft size={14} />
                  <span>返回</span>
                </button>
              </div>
              <History 
                items={history} 
                onSelectItem={handleSelectItem}
                onClear={clearHistory}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="px-8 py-12 border-t border-ink/5 bg-white/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-serif font-bold text-ink/60 tracking-widest">镜微 · JINGWEI</div>
            <div className="text-[10px] text-ink/30 font-serif uppercase tracking-widest">© 2026 镜微易经 · 探索内心的无限可能</div>
          </div>
          
          <div className="flex gap-12">
            <div className="flex flex-col gap-3">
              <div className="text-[10px] text-ink/30 font-serif uppercase tracking-widest">关于</div>
              <nav className="flex flex-col gap-1">
                <a href="#" className="text-xs text-ink/50 hover:text-ink font-serif transition-colors">产品理念</a>
                <a href="#" className="text-xs text-ink/50 hover:text-ink font-serif transition-colors">方法论</a>
              </nav>
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-[10px] text-ink/30 font-serif uppercase tracking-widest">支持</div>
              <nav className="flex flex-col gap-1">
                <a href="#" className="text-xs text-ink/50 hover:text-ink font-serif transition-colors">使用指南</a>
                <a href="#" className="text-xs text-ink/50 hover:text-ink font-serif transition-colors">常见问题</a>
              </nav>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
