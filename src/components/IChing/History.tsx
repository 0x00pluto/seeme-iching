import React from "react";
import { motion } from "framer-motion";
import { LineType, HEXAGRAMS, getBinary } from "@/lib/iching";
import { Hexagram } from "./Hexagram";
import { BookOpen, ChevronRight, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Button } from "@/components/ui/button";

export interface HistoryItem {
  id: string;
  timestamp: number;
  question: string;
  lines: LineType[];
  interpretation: string;
}

interface HistoryProps {
  items: HistoryItem[];
  /** 本地档案总数（未过滤）；用于区分「从未有档案」与「搜索无结果」 */
  allItemsCount: number;
  onSelectItem: (item: HistoryItem) => void;
  onClear: () => void;
  onStartCasting?: () => void;
  onClearSearch?: () => void;
}

export const History: React.FC<HistoryProps> = ({
  items,
  allItemsCount,
  onSelectItem,
  onClear,
  onStartCasting,
  onClearSearch,
}) => {
  if (allItemsCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center sm:py-32">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-ink/5 text-ink/15">
          <BookOpen size={48} strokeWidth={1.25} aria-hidden />
        </div>
        <p className="mb-2 font-serif text-xl text-ink/30 italic">
          尚未留下观心的足迹
        </p>
        <p className="mb-10 max-w-md font-serif text-sm text-ink/20 leading-relaxed">
          每一次起卦，都是与自己的一次对话
        </p>
        {onStartCasting && (
          <Button
            type="button"
            onClick={onStartCasting}
            className="h-auto rounded-full bg-ink px-10 py-5 font-serif text-sm tracking-widest text-bg hover:bg-ink/90"
          >
            起一卦，照见此刻
          </Button>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24 text-center sm:py-32">
        <p className="font-serif text-lg text-ink/30">未找到相关记录</p>
        {onClearSearch && (
          <Button
            type="button"
            variant="outline"
            className="rounded-full font-serif"
            onClick={onClearSearch}
          >
            清空搜索
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-serif font-bold text-ink">观心档案</h3>
        <button
          onClick={onClear}
          className="flex items-center gap-2 text-xs text-brand/40 hover:text-brand transition-colors font-serif uppercase tracking-widest"
        >
          <Trash2 size={14} />
          <span>清空档案</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[...items]
          .sort((a, b) => b.timestamp - a.timestamp)
          .map((item) => {
            const gua = HEXAGRAMS[getBinary(item.lines)];
            return (
              <motion.button
                key={item.id}
                whileHover={{ y: -4 }}
                onClick={() => onSelectItem(item)}
                className="group flex items-center gap-6 rounded-[32px] border border-ink/5 bg-white/40 p-6 text-left shadow-sm backdrop-blur-sm transition-all hover:border-brand/20 hover:bg-white/60 hover:shadow-xl"
              >
                <div className="w-16">
                  <Hexagram lines={item.lines} size="sm" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                  <div className="flex items-center gap-2 text-[10px] font-serif uppercase tracking-widest text-ink/30">
                    {format(item.timestamp, "yyyy.MM.dd HH:mm", { locale: zhCN })}
                  </div>
                  <h4 className="truncate font-serif text-lg font-bold text-ink">
                    {item.question || "无题之思"}
                  </h4>
                  <div className="font-serif text-xs tracking-widest text-brand">
                    {gua?.name} · {gua?.character}
                  </div>
                </div>

                <ChevronRight
                  size={20}
                  className="shrink-0 text-ink/10 transition-all group-hover:translate-x-1 group-hover:text-brand"
                />
              </motion.button>
            );
          })}
      </div>
    </div>
  );
};
