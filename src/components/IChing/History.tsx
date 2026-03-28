import React from "react";
import { motion } from "framer-motion";
import { LineType, HEXAGRAMS, getBinary } from "@/lib/iching";
import { Hexagram } from "./Hexagram";
import { Calendar, ChevronRight, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export interface HistoryItem {
  id: string;
  timestamp: number;
  question: string;
  lines: LineType[];
  interpretation: string;
}

interface HistoryProps {
  items: HistoryItem[];
  onSelectItem: (item: HistoryItem) => void;
  onClear: () => void;
}

export const History: React.FC<HistoryProps> = ({ items, onSelectItem, onClear }) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-ink/20 font-serif italic">
        <Calendar size={48} className="mb-4 opacity-10" />
        <p>尚未留下观心的足迹</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-serif font-bold text-ink">观心档案</h3>
        <button 
          onClick={onClear}
          className="flex items-center gap-2 text-xs text-accent/40 hover:text-accent transition-colors font-serif uppercase tracking-widest"
        >
          <Trash2 size={14} />
          <span>清空档案</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.sort((a, b) => b.timestamp - a.timestamp).map((item) => {
          const gua = HEXAGRAMS[getBinary(item.lines)];
          return (
            <motion.button
              key={item.id}
              whileHover={{ y: -4 }}
              onClick={() => onSelectItem(item)}
              className="flex items-center gap-6 p-6 rounded-[32px] border border-ink/5 bg-white/40 backdrop-blur-sm hover:bg-white/60 hover:border-accent/20 transition-all text-left shadow-sm hover:shadow-xl group"
            >
              <div className="w-16">
                <Hexagram lines={item.lines} size="sm" />
              </div>
              
              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                <div className="flex items-center gap-2 text-[10px] text-ink/30 font-serif uppercase tracking-widest">
                  {format(item.timestamp, "yyyy.MM.dd HH:mm", { locale: zhCN })}
                </div>
                <h4 className="text-lg font-serif font-bold text-ink truncate">
                  {item.question || "无题之思"}
                </h4>
                <div className="text-xs text-accent font-serif tracking-widest">
                  {gua?.name} · {gua?.character}
                </div>
              </div>

              <ChevronRight size={20} className="text-ink/10 group-hover:text-accent group-hover:translate-x-1 transition-all" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
