import { cn } from "@/lib/utils";
import React from "react";

type TomorrowPromiseCardProps = {
  className?: string;
};

/** autosave 成功后的「明日之约」叙事契约 */
export const TomorrowPromiseCard: React.FC<TomorrowPromiseCardProps> = ({ className }) => (
  <section
    className={cn(
      "rounded-[32px] border border-brand/15 bg-brand/5 px-8 py-7 text-center shadow-lg backdrop-blur-sm",
      className,
    )}
    aria-label="明日之约"
  >
    <p className="font-serif text-lg leading-relaxed text-ink/85">
      镜脉已记下这一照。明日你再来，会照见这条线的下一笔。
    </p>
    <p className="mt-3 font-serif text-sm leading-relaxed text-ink/45 italic">
      照见不是为了判定对错，只是让故事多一笔可以回看的痕迹。
    </p>
  </section>
);
