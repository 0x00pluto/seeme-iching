/**
 * 服务端本卦名解析：与前端 History 同源（getBinary + HEXAGRAMS）。
 */
import { HEXAGRAMS, getBinary, type LineType } from "../src/lib/iching.js";

const LINE_VALUES = new Set([6, 7, 8, 9]);

export function isValidLinesJson(lines: unknown): lines is number[] {
  if (!Array.isArray(lines) || lines.length !== 6) return false;
  return lines.every((x) => typeof x === "number" && LINE_VALUES.has(x));
}

/** 六爻 → 本卦名；无效 lines 返回「未知」 */
export function hexagramNameFromLines(lines: unknown): string {
  if (!isValidLinesJson(lines)) return "未知";
  const binary = getBinary(lines as LineType[]);
  return HEXAGRAMS[binary]?.name ?? "未知";
}
