import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hexagram } from "./Hexagram";
import { LineType } from "@/lib/iching";
import { cn } from "@/lib/utils";
import { Sparkles, RotateCcw, Fingerprint } from "lucide-react";

interface DivinationProps {
  onComplete: (lines: LineType[]) => void;
}

export const Divination: React.FC<DivinationProps> = ({ onComplete }) => {
  const [lines, setLines] = useState<LineType[]>([]);
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startPress = () => {
    if (lines.length >= 6) return;
    setIsPressing(true);
    setProgress(0);
    
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timerRef.current!);
          return 100;
        }
        return prev + 2;
      });
    }, 20);
  };

  const endPress = () => {
    if (!isPressing) return;
    setIsPressing(false);
    if (timerRef.current) clearInterval(timerRef.current);

    if (progress > 30) {
      // Cast all 6 lines at once
      const newLines: LineType[] = Array.from({ length: 6 }, () => 
        (Math.floor(Math.random() * 4) + 6) as LineType
      );
      setLines(newLines);
      
      setTimeout(() => onComplete(newLines), 1500);
    }
    setProgress(0);
  };

  const reset = () => {
    setLines([]);
    setIsPressing(false);
    setProgress(0);
  };

  return (
    <div className="flex flex-col items-center gap-16 py-8 w-full max-w-2xl mx-auto">
      <div className="relative w-full aspect-[4/5] flex items-center justify-center border border-ink/5 rounded-[60px] bg-white/30 backdrop-blur-2xl shadow-2xl overflow-hidden group">
        {/* Mirror Background Effect */}
        <div className="absolute inset-0 bg-radial-gradient from-accent/10 to-transparent opacity-30 group-hover:opacity-50 transition-opacity duration-1000" />
        <div className="absolute inset-0 border-[20px] border-white/10 rounded-[60px] pointer-events-none" />
        
        <AnimatePresence mode="wait">
          {lines.length > 0 ? (
            <motion.div 
              key="hexagram"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative z-10 w-48 flex flex-col items-center"
            >
              <Hexagram lines={lines} size="lg" className="w-full drop-shadow-2xl" />
              <div className="mt-16 flex flex-col items-center gap-4">
                <div className="flex gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all duration-700",
                        i < lines.length ? "bg-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]" : "bg-ink/5"
                      )} 
                    />
                  ))}
                </div>
                <p className="text-[10px] text-accent font-serif uppercase tracking-[0.4em] animate-pulse">
                  {lines.length === 6 ? "意念凝聚完成" : `已成 ${lines.length} 爻`}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-ink/30 font-serif italic text-center px-16 flex flex-col items-center gap-8"
            >
              <div className="w-16 h-16 rounded-full border border-ink/10 flex items-center justify-center">
                <Sparkles size={24} className="text-accent/40" />
              </div>
              <div className="flex flex-col gap-4">
                <p className="text-3xl tracking-[0.2em] text-ink/60">静心观照</p>
                <p className="text-sm leading-relaxed max-w-[240px]">
                  闭目，深呼吸。<br />
                  长按下方指纹，将你的意念注入镜中。<br />
                  一念即成，六爻显现。
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Ring Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <svg className="w-[80%] h-[80%] -rotate-90 opacity-20">
            <circle
              cx="50%"
              cy="50%"
              r="48%"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-ink/10"
            />
            <motion.circle
              cx="50%"
              cy="50%"
              r="48%"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="100 100"
              initial={{ strokeDashoffset: 100 }}
              animate={{ strokeDashoffset: 100 - progress }}
              className="text-accent"
            />
          </svg>
        </div>
      </div>

      <div className="flex flex-col items-center gap-12 w-full">
        <div className="relative">
          {/* Breathing Aura */}
          <motion.div
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.1, 0, 0.1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 rounded-full bg-accent/20 -z-10"
          />
          
          <button
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            disabled={lines.length >= 6}
            className={cn(
              "relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-700",
              isPressing 
                ? "scale-90 bg-ink text-bg shadow-[0_0_50px_rgba(0,0,0,0.2)]" 
                : "bg-white text-ink border border-ink/5 shadow-xl hover:scale-105 hover:border-accent/20",
              lines.length >= 6 && "opacity-20 cursor-not-allowed grayscale"
            )}
          >
            <Fingerprint size={48} className={cn("transition-all duration-1000", isPressing && "animate-pulse text-accent")} />
            {isPressing && (
              <motion.div
                layoutId="breath-ring"
                className="absolute -inset-4 rounded-full border border-accent/30"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </button>
        </div>

        <div className="flex items-center gap-8">
          <button
            onClick={reset}
            className="group flex items-center gap-2 text-[10px] text-ink/20 hover:text-accent transition-all font-serif uppercase tracking-[0.3em]"
          >
            <RotateCcw size={12} className="group-hover:rotate-180 transition-transform duration-700" />
            <span>重置镜面</span>
          </button>
          
          <div className="h-4 w-px bg-ink/5" />
          
          <div className="text-[10px] text-ink/30 font-serif uppercase tracking-[0.3em] flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-accent animate-ping" />
            {lines.length === 6 ? "卦象已成，正在显现..." : "意念凝聚中"}
          </div>
        </div>
      </div>
    </div>
  );
};
