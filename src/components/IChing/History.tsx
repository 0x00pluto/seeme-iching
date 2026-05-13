import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { LineType, HEXAGRAMS, getBinary } from "@/lib/iching";
import { Hexagram } from "./Hexagram";
import { BookOpen, ChevronRight, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Button } from "@/components/ui/button";

export interface HistoryItem {
  id: string;
  timestamp: number;
  question: string;
  lines: LineType[];
  interpretation: string;
  /** 保存时的三条深入追问；旧档案可无此字段，打开时用本地兜底文案 */
  deepInquiryQuestions?: string[];
}

/** 摘取观心报告首行可读预览，供列表底栏展示（非完整 Markdown 渲染） */
function interpretationPreview(raw: string): string {
  if (!raw?.trim()) return "";
  let s = raw
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
}

interface HistoryProps {
  items: HistoryItem[];
  /** 档案总数（未过滤）；用于区分「从未有档案」与「搜索无结果」 */
  allItemsCount: number;
  /** 全部档案中含已保存「深入追问」的条数（由父组件从完整 history 计算） */
  deepInquirySavedCount: number;
  /** 为 true 时表示当前已登录且档案服务（Supabase）可用，数据来自云端 */
  archivesRemote?: boolean;
  onSelectItem: (item: HistoryItem) => void;
  onClear: () => void;
  onStartCasting?: () => void;
  onClearSearch?: () => void;
}

export const History: React.FC<HistoryProps> = ({
  items,
  allItemsCount,
  deepInquirySavedCount,
  archivesRemote = false,
  onSelectItem,
  onClear,
  onStartCasting,
  onClearSearch,
}) => {
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.timestamp - a.timestamp),
    [items]
  );

  if (allItemsCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center sm:py-36">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-ink/5 text-ink/15">
          <BookOpen size={48} strokeWidth={1.25} aria-hidden />
        </div>
        <p className="mb-2 font-serif text-xl text-ink/30 italic">
          尚未留下观心的足迹
        </p>
        <p className="mb-10 max-w-md font-serif text-sm leading-relaxed text-ink/20">
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
      <div className="flex flex-col items-center justify-center gap-8 py-28 text-center sm:py-36">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ink/5 text-ink/12">
          <BookOpen size={40} strokeWidth={1.25} aria-hidden />
        </div>
        <p className="font-serif text-lg text-ink/30">未找到相关记录</p>
        {onClearSearch && (
          <Button
            type="button"
            variant="outline"
            className="rounded-full px-8 font-serif"
            onClick={onClearSearch}
          >
            清空搜索
          </Button>
        )}
      </div>
    );
  }

  const listFiltered = items.length < allItemsCount;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs font-serif uppercase tracking-[0.25em] text-ink/35">
          观心档案
        </p>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-2 font-serif text-xs uppercase tracking-widest text-brand/40 transition-colors hover:text-brand"
        >
          <Trash2 size={14} aria-hidden />
          <span>清空档案</span>
        </button>
      </div>

      <div className="relative overflow-hidden rounded-[52px] border border-ink/5 bg-white/60 p-10 sm:p-12">
        <div
          className="pointer-events-none absolute -top-24 right-0 h-64 w-64 translate-x-1/4 rounded-full bg-brand/[0.06] blur-3xl"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-xl flex-col gap-3">
            <h2 className="font-serif text-2xl font-bold leading-tight text-ink sm:text-3xl">
              已保存 {allItemsCount} 次照见
            </h2>
            <p className="font-serif text-sm leading-relaxed text-ink/40">
              {listFiltered
                ? `当前列表显示 ${items.length} 条，与搜索条件匹配。`
                : archivesRemote
                  ? "记录保存在你的登录账号下，换设备登录同一邮箱可继续回看。"
                  : "登录且档案服务就绪后，观心记录将保存在你的账号下。"}
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-4 sm:min-w-[280px]">
            <div className="rounded-[28px] border border-ink/5 bg-white/50 p-6 text-center">
              <div className="mb-1 font-serif text-3xl font-bold text-ink">
                {allItemsCount}
              </div>
              <div className="font-serif text-[10px] uppercase tracking-widest text-ink/25">
                总足迹数
              </div>
            </div>
            <div className="rounded-[28px] border border-ink/5 bg-white/50 p-6 text-center">
              <div className="mb-1 font-serif text-3xl font-bold text-brand">
                {deepInquirySavedCount}
              </div>
              <div className="font-serif text-[10px] uppercase tracking-widest text-ink/25">
                含深入追问
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {sortedItems.map((item, i) => {
          const gua = HEXAGRAMS[getBinary(item.lines)];
          const preview =
            interpretationPreview(item.interpretation) || "照见仍在展开，点开可读全文。";
          const hexLabel =
            gua?.name && gua?.character
              ? `${gua.name} · ${gua.character}`
              : gua?.name || "卦象";

          return (
            <motion.button
              key={item.id}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
              onClick={() => onSelectItem(item)}
              className="group flex flex-col gap-8 rounded-[44px] border border-ink/5 bg-white/40 p-8 text-left shadow-sm backdrop-blur-sm transition-all hover:border-brand/20 hover:bg-white hover:shadow-xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink/5 bg-bg text-ink/25">
                    <Clock size={16} aria-hidden />
                  </div>
                  <span className="font-serif text-[10px] uppercase tracking-widest text-ink/25">
                    {format(item.timestamp, "MM.dd / HH:mm", { locale: zhCN })}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-6 sm:gap-8">
                <div className="w-20 shrink-0 pt-0.5">
                  <Hexagram lines={item.lines} size="sm" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <h3 className="line-clamp-2 font-serif text-xl font-bold leading-tight text-ink sm:text-2xl">
                    {item.question || "无题之思"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand/8 px-4 py-1.5 font-serif text-[10px] font-semibold tracking-widest text-brand">
                      {hexLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between gap-4 border-t border-ink/5 pt-6">
                <p className="min-w-0 flex-1 font-serif text-xs italic leading-relaxed text-ink/45 line-clamp-1">
                  “{preview}”
                </p>
                <ChevronRight
                  size={18}
                  className="shrink-0 text-ink/10 transition-all group-hover:translate-x-1 group-hover:text-brand"
                  aria-hidden
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
