import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Divination } from "@/components/IChing/Divination";
import { Interpretation } from "@/components/IChing/Interpretation";
import { History, HistoryItem } from "@/components/IChing/History";
import { LoginDialog } from "@/components/auth/LoginDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineType } from "@/lib/iching";
import { fetchAuthMe, postLogout, type AuthUser } from "@/lib/auth-api";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ChevronRight,
  History as HistoryIcon,
  ArrowLeft,
  LogIn,
  MoreVertical,
  Search,
} from "lucide-react";
import { toast } from "sonner";

/** 邮箱 @ 前本地部分作为昵称展示（避免整段邮箱形态）；过长截断 */
function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? email;
  return local.length > 12 ? `${local.slice(0, 12)}…` : local;
}

/** 头像圆内首字符（支持中文首字） */
function initialFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  const ch = [...local][0];
  if (!ch) return "?";
  return ch.toLocaleUpperCase("en-US");
}

/** 订阅档位占位，后续可接 /api/auth/me */
const SUBSCRIPTION_TIER: "free" | "pro" = "free";

const HISTORY_STORAGE_KEY = "iching_history";

type AppState = "landing" | "divination" | "interpretation" | "history";

export const Home: React.FC = () => {
  const [state, setState] = useState<AppState>("landing");
  const [lines, setLines] = useState<LineType[]>([]);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const canStartDivination = question.trim().length > 0;

  const filteredHistory = useMemo(() => {
    const q = historySearchQuery.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.interpretation.toLowerCase().includes(q)
    );
  }, [history, historySearchQuery]);

  const tierLabel = SUBSCRIPTION_TIER === "free" ? "免费" : "PRO";

  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!savedHistory) return;
    try {
      setHistory(JSON.parse(savedHistory));
    } catch (e) {
      console.error("Failed to load local history", e);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const { user } = await fetchAuthMe();
      setAuthUser(user);
    } catch {
      setAuthUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (!authUser) setAccountMenuOpen(false);
  }, [authUser]);

  useEffect(() => {
    if (state !== "history") {
      setHistorySearchQuery("");
      setHistorySearchOpen(false);
    }
  }, [state]);

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
    if (!authUser) {
      toast.message("请先登录后再开始测算");
      setLoginOpen(true);
      return;
    }
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

  const handleLogout = async () => {
    await postLogout();
    setAuthUser(null);
    toast.success("已退出登录");
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink selection:bg-brand/10 selection:text-brand">
      {/* Toaster is in App.tsx */}
      
      <header className="flex justify-between items-center gap-4 px-8 py-6 border-b border-ink/5 sticky top-0 bg-bg/80 backdrop-blur-md z-50">
        {state === "history" ? (
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={goBack}
              aria-label="返回"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink/5 text-ink/40 transition-colors hover:bg-white hover:text-ink"
            >
              <ArrowLeft size={20} strokeWidth={2} aria-hidden />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-xl font-bold text-ink">
                我的内省足迹
              </h1>
              <p className="text-[10px] font-serif uppercase tracking-[0.3em] text-ink/20">
                MY INTROSPECTION FOOTPRINTS
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.7 }}
              onClick={() => setState("landing")}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-ink font-serif text-sm font-bold text-bg"
            >
              镜
            </motion.div>
            <h1 className="font-serif text-xl font-bold tracking-widest text-ink/80">
              镜微 · I-CHING
            </h1>
          </div>
        )}

        <nav className="flex shrink-0 items-center gap-4 sm:gap-6">
          {authUser && (
            <button
              onClick={() => setState("history")}
              className={cn(
                "flex items-center gap-2 font-serif text-xs tracking-widest uppercase transition-colors",
                state === "history"
                  ? "text-brand"
                  : "text-ink/40 hover:text-ink/80"
              )}
            >
              <HistoryIcon size={14} />
              <span>档案</span>
            </button>
          )}
          {authUser ? (
            <>
              <div className="flex items-center gap-2 sm:gap-4">
                {state === "history" && (
                  <button
                    type="button"
                    aria-label="搜索档案"
                    onClick={() => setHistorySearchOpen(true)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink/5 text-ink/20 transition-colors hover:bg-white hover:text-ink"
                  >
                    <Search size={20} strokeWidth={2} aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="更多选项"
                  className="rounded-md p-1 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink/80"
                >
                  <MoreVertical size={18} strokeWidth={2} aria-hidden />
                </button>
                <span
                  className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-ink/70 uppercase"
                  aria-label={tierLabel === "免费" ? "免费版" : "专业版"}
                >
                  {tierLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen(true)}
                  aria-label="打开账户菜单"
                  aria-haspopup="dialog"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink font-serif text-sm font-bold text-bg transition-opacity hover:opacity-90"
                >
                  {authUser.email
                    ? initialFromEmail(authUser.email)
                    : "?"}
                </button>
              </div>

              <Dialog
                open={accountMenuOpen && !!authUser}
                onOpenChange={setAccountMenuOpen}
              >
                <DialogContent
                  className="top-24 right-4 left-auto z-[100] max-h-[min(90vh,520px)] w-[min(calc(100vw-2rem),22rem)] max-w-none translate-x-0 translate-y-0 origin-top-right gap-0 overflow-y-auto p-0 sm:right-8 sm:w-[min(calc(100vw-4rem),28rem)] data-open:zoom-in-95"
                  showCloseButton
                >
                  <div className="relative border-b border-ink/10 px-4 pt-8 pb-4">
                    <DialogTitle className="text-center font-serif text-lg font-bold tracking-widest text-ink">
                      镜微
                    </DialogTitle>
                  </div>

                  <div className="flex gap-3 border-b border-ink/10 px-4 py-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink font-serif text-lg font-bold text-bg"
                      aria-hidden
                    >
                      {authUser.email
                        ? initialFromEmail(authUser.email)
                        : "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-base font-bold text-ink">
                        {authUser.email
                          ? displayNameFromEmail(authUser.email)
                          : "已登录"}
                      </p>
                      <DialogDescription className="mt-0.5 break-all text-xs text-ink/50">
                        {authUser.email ?? "—"}
                      </DialogDescription>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 px-4 py-4">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 w-full justify-center gap-2 rounded-xl font-serif"
                      onClick={() => {
                        setState("history");
                        setAccountMenuOpen(false);
                      }}
                    >
                      <HistoryIcon size={16} aria-hidden />
                      档案
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full justify-center rounded-xl font-serif"
                      onClick={() => void handleLogout()}
                    >
                      退出账号
                    </Button>
                  </div>

                  <p className="px-4 pb-4 text-center text-[10px] leading-relaxed text-ink/40">
                    隐私权 · 服务条款 · 许可
                  </p>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="text-xs font-serif tracking-widest uppercase flex items-center gap-2 rounded-full border border-ink/15 px-3 py-1.5 text-ink/70 transition-colors hover:border-ink/25 hover:text-ink"
            >
              <LogIn size={14} aria-hidden />
              <span>登录</span>
            </button>
          )}
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
              className="mx-auto max-w-5xl px-8 py-12"
            >
              <History
                items={filteredHistory}
                allItemsCount={history.length}
                onSelectItem={handleSelectItem}
                onClear={clearHistory}
                onStartCasting={() => setState("landing")}
                onClearSearch={() => setHistorySearchQuery("")}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />

      <Dialog
        open={state === "history" && historySearchOpen}
        onOpenChange={(open) => {
          setHistorySearchOpen(open);
        }}
      >
        <DialogContent className="gap-4 sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-ink">
              搜索档案
            </DialogTitle>
            <DialogDescription className="font-serif text-ink/50">
              按问题或解读内容筛选本地记录
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="搜索问题或关键词"
            value={historySearchQuery}
            onChange={(e) => setHistorySearchQuery(e.target.value)}
            className="h-10 font-serif"
            autoFocus
          />
          {historySearchQuery.trim() ? (
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl font-serif"
              onClick={() => setHistorySearchQuery("")}
            >
              清空搜索条件
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      <footer className="px-8 py-12 border-t border-ink/5 bg-white/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-serif font-bold text-ink/60 tracking-widest">镜微 · JINGWEI</div>
            <div className="text-[10px] text-ink/30 font-serif uppercase tracking-widest">© 2026 镜微易经 · 探索内心的无限可能</div>
          </div>
          
          <div className="flex flex-wrap justify-end gap-x-10 gap-y-6 sm:gap-x-14">
            <nav className="flex flex-col gap-2">
              <a href="#" className="text-xs text-ink/50 hover:text-ink font-serif transition-colors">
                用户协议
              </a>
              <a href="#" className="text-xs text-ink/50 hover:text-ink font-serif transition-colors">
                隐私政策
              </a>
            </nav>
            <nav className="flex flex-col gap-2">
              <a href="#" className="text-xs text-ink/50 hover:text-ink font-serif transition-colors">
                使用指南
              </a>
              <a href="#" className="text-xs text-ink/50 hover:text-ink font-serif transition-colors">
                常见问题
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
