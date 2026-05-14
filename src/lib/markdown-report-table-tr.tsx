import type { JSX, ReactNode } from "react";
import { cn } from "@/lib/utils";

type HastLike = {
  type: string;
  tagName?: string;
  value?: string;
  children?: unknown[];
};

function hastPlainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as HastLike;
  if (n.type === "text" && typeof n.value === "string") return n.value;
  if (n.type === "element" && Array.isArray(n.children)) {
    return n.children.map(hastPlainText).join("");
  }
  return "";
}

/** GFM 对齐占位格（含 :---、--- 等），非真实正文 */
function isAlignmentPlaceholderCellContent(text: string): boolean {
  return /^\s*:?-{3,}:?\s*$/.test(text);
}

export type MarkdownReportTrProps = JSX.IntrinsicElements["tr"] & {
  node?: unknown;
  children?: ReactNode;
};

/**
 * rehype 后部分管线会把对齐行落成「仅含 :--- 文本」的 tr；与库里多写一行分隔 Markdown 无关时仍会在 UI 露一行。
 */
export function MarkdownReportTr(props: MarkdownReportTrProps): JSX.Element {
  const { node, children, className, ...rest } = props;
  if (node && typeof node === "object" && "type" in node) {
    const el = node as HastLike;
    if (el.type === "element" && el.tagName === "tr" && Array.isArray(el.children)) {
      const cells = el.children.filter(
        (c: unknown): c is HastLike =>
          typeof c === "object" &&
          c !== null &&
          (c as HastLike).type === "element" &&
          ["th", "td"].includes(String((c as HastLike).tagName)),
      );
      if (
        cells.length > 0 &&
        cells.every((c: HastLike) => isAlignmentPlaceholderCellContent(hastPlainText(c)))
      ) {
        return (
          <tr {...rest} className={cn("hidden", className)} aria-hidden>
            {children}
          </tr>
        );
      }
    }
  }
  return (
    <tr {...rest} className={className}>
      {children}
    </tr>
  );
}

export const markdownReportMarkdownComponents = {
  tr: MarkdownReportTr,
};
