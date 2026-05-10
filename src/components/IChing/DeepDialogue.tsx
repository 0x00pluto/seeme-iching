import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Loader2, X, Sparkles, User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const DIALOGUE_STORAGE_PREFIX = "iching_deep_dialogue_";
import { streamDeepChat } from "@/lib/ark-client";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface DeepDialogueProps {
  divinationId: string;
  question: string;
  interpretation: string;
  onClose: () => void;
}

export const DeepDialogue: React.FC<DeepDialogueProps> = ({ divinationId, question, interpretation, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [round, setRound] = useState(1);
  const [sessionId] = useState(() => `dialogue_${Date.now()}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Initial system message or greeting
    const initialMessage: Message = {
      role: "assistant",
      content: `你好。通过刚才的卦象，我们已经触碰到了你内心的一角。

针对你的困惑：“${question}”，
以及我们看到的现状、内心、阴影与视角。

现在，让我们开启一段深度的对话（共8轮）。
我将通过提问的方式，协助你更好地看见自己的叙事，发现不同视角的自己。

**第一轮：**
在刚才的解读中，哪一个“镜子”（现状、内心、阴影、视角）最让你感到意外或触动？为什么？`,
      timestamp: Date.now()
    };
    setMessages([initialMessage]);
    saveSession([initialMessage], 1);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const saveSession = (newMessages: Message[], currentRound: number) => {
    try {
      const payload = {
        id: sessionId,
        divinationId,
        messages: newMessages,
        round: currentRound,
        isComplete: currentRound >= 8,
        timestamp: Date.now(),
      };
      localStorage.setItem(`${DIALOGUE_STORAGE_PREFIX}${sessionId}`, JSON.stringify(payload));
    } catch (e) {
      console.error("Failed to persist dialogue session", e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || round > 8) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userContent = input;
    const userMsg: Message = { role: "user", content: userContent, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

      try {
        const assistantTimestamp = Date.now();
        const assistantPlaceholder: Message = { role: "assistant", content: "", timestamp: assistantTimestamp };
        setMessages((prev) => [...prev, assistantPlaceholder]);

        let assistantContent = "";

        await streamDeepChat(
          {
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
            question,
            interpretation,
            round,
            input: userContent,
          },
          {
            onDelta: (delta) => {
              assistantContent += delta;
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.role === "assistant" && m.timestamp === assistantTimestamp);
                if (idx < 0) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], content: next[idx].content + delta };
                return next;
              });
            },
          },
          { signal: controller.signal }
        );

        const finalAssistant = assistantContent.trim() ? assistantContent : "我正在深思，请稍后再试。";
        const finalMessages: Message[] = [
          ...newMessages,
          { role: "assistant", content: finalAssistant, timestamp: assistantTimestamp },
        ];
        setMessages(finalMessages);

        const nextRound = round + 1;
        setRound(nextRound);
        saveSession(finalMessages, nextRound);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("API Error:", error);
        const fallback = "抱歉，由于意念波动（网络错误），我暂时无法回应。请稍后再试。";
        const content =
          error instanceof Error && error.message !== "API request failed"
            ? error.message
            : fallback;
        setMessages(prev => [...prev, { role: "assistant", content, timestamp: Date.now() }]);
      } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/40 backdrop-blur-sm"
    >
      <div className="w-full max-w-4xl h-[85vh] bg-bg rounded-[48px] border border-ink/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-ink/5 flex items-center justify-between bg-white/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-ink">深度对话 · 观心叙事</h3>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "w-2 h-1 rounded-full transition-all",
                        i < round ? "bg-accent w-4" : "bg-ink/10"
                      )} 
                    />
                  ))}
                </div>
                <span className="text-[10px] text-ink/30 font-serif uppercase tracking-widest">Round {round}/8</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-ink/5 text-ink/30 hover:text-ink transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 scroll-smooth"
        >
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 max-w-[85%]",
                msg.role === "user" ? "self-end flex-row-reverse" : "self-start"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm",
                msg.role === "user" ? "bg-accent text-bg" : "bg-ink text-bg"
              )}>
                {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={cn(
                "p-6 rounded-[32px] font-serif text-lg leading-relaxed shadow-sm",
                msg.role === "user" 
                  ? "bg-accent/5 text-ink border border-accent/10 rounded-tr-none" 
                  : "bg-white border border-ink/5 rounded-tl-none"
              )}>
                <div className="prose prose-sm prose-ink max-w-none">
                  <ReactMarkdown>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex gap-4 self-start">
              <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-bg">
                <Bot size={14} />
              </div>
              <div className="p-6 rounded-[32px] bg-white border border-ink/5 rounded-tl-none flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-accent" />
                <span className="text-sm font-serif italic text-ink/30">正在深思...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-8 border-t border-ink/5 bg-white/50 backdrop-blur-md">
          <div className="relative group">
            <textarea
              rows={1}
              placeholder={round > 8 ? "对话已圆满结束" : "在此输入你的感悟或回答..."}
              disabled={isLoading || round > 8}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="w-full p-6 pr-16 rounded-[32px] border border-ink/10 bg-white focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent/20 transition-all resize-none font-serif text-lg leading-relaxed shadow-inner disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || round > 8}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-ink text-bg hover:bg-accent transition-all disabled:opacity-20 disabled:hover:bg-ink"
            >
              <Send size={20} />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-ink/20 font-serif uppercase tracking-widest">
            <Sparkles size={12} />
            <span>对话将协助你发现新的可能性</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
