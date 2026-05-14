const TABLE_SEPARATOR_REGEX = /\|(?:\s*:?-{3,}:?\s*\|)+/g;

/** 与解读页一致：规整 GFM 表格换行，避免 remark 解析异常 */
export function normalizeMarkdownTables(markdown: string): string {
  if (!markdown.includes("|")) return markdown;

  let normalized = markdown.replace(/\r\n/g, "\n").replace(/\|\s+\|/g, "|\n|");

  normalized = normalized.replace(/([^\n])(\|(?:\s*:?-{3,}:?\s*\|)+)/g, "$1\n$2");
  normalized = normalized.replace(/(\|(?:\s*:?-{3,}:?\s*\|)+)([^\n])/g, "$1\n$2");

  const lines = normalized.split("\n");
  const fixedLines: string[] = [];

  for (const line of lines) {
    if (!line.includes("|")) {
      fixedLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      fixedLines.push(trimmed);
      continue;
    }

    const firstPipe = line.indexOf("|");
    const lastPipe = line.lastIndexOf("|");
    if (firstPipe > 0 && lastPipe > firstPipe) {
      const prefix = line.slice(0, firstPipe).trimEnd();
      const row = line.slice(firstPipe, lastPipe + 1).trim();
      const suffix = line.slice(lastPipe + 1).trimStart();
      if (prefix) fixedLines.push(prefix);
      fixedLines.push(row);
      if (suffix) fixedLines.push(suffix);
      continue;
    }

    fixedLines.push(line);
  }

  return fixedLines
    .join("\n")
    .replace(TABLE_SEPARATOR_REGEX, (match) => `\n${match.trim()}\n`)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
