import React from "react";
import { cn } from "@/lib/utils";
import { LineType } from "@/lib/iching";

interface HexagramProps {
  lines: LineType[];
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Hexagram: React.FC<HexagramProps> = ({ lines, className, size = "md" }) => {
  const lineHeights = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  const gapWidths = {
    sm: "w-4",
    md: "w-6",
    lg: "w-8",
  };

  return (
    <div className={cn("flex flex-col-reverse gap-2", className)}>
      {lines.map((line, index) => {
        const isYang = line === 7 || line === 9;
        const isChanging = line === 6 || line === 9;

        return (
          <div key={index} className="relative flex justify-center items-center w-full group">
            {isYang ? (
              <div 
                className={cn(
                  "w-full rounded-full transition-all duration-500", 
                  lineHeights[size], 
                  isChanging ? "bg-accent shadow-[0_0_15px_rgba(var(--accent-rgb),0.4)]" : "bg-ink/80 group-hover:bg-ink"
                )} 
              />
            ) : (
              <div className="flex justify-between w-full">
                <div 
                  className={cn(
                    "w-[42%] rounded-full transition-all duration-500", 
                    lineHeights[size], 
                    isChanging ? "bg-accent shadow-[0_0_15px_rgba(var(--accent-rgb),0.4)]" : "bg-ink/80 group-hover:bg-ink"
                  )} 
                />
                <div 
                  className={cn(
                    "w-[42%] rounded-full transition-all duration-500", 
                    lineHeights[size], 
                    isChanging ? "bg-accent shadow-[0_0_15px_rgba(var(--accent-rgb),0.4)]" : "bg-ink/80 group-hover:bg-ink"
                  )} 
                />
              </div>
            )}
            {isChanging && (
              <div className="absolute -right-8 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping opacity-50" />
                <div className="absolute text-[10px] font-bold text-accent/40 tracking-tighter">
                  {line === 9 ? "阳动" : "阴动"}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
