const TABLE_SEPARATOR_REGEX = /\|(?:\s*:?-{3,}:?\s*\|)+/g;

/** 模型常把多行压成一行，用 || 粘连下一行；remark-gfm 需要每行独立 |...| */
function splitCollapsedTablePipeRows(markdown: string): string {
  let s = markdown;
  while (s.includes("||")) {
    s = s.replace(/\|\|/g, "|\n|");
  }
  return s;
}

function countTableColumns(pipeRow: string): number {
  return pipeRow
    .trim()
    .split("|")
    .filter((cell) => cell.trim().length > 0).length;
}

/** 与表头同宽的标准 GFM 分隔行 */
function buildSeparatorLine(columnCount: number): string {
  const cells = Array.from({ length: columnCount }, () => ":---");
  return `| ${cells.join(" | ")} |`;
}

function isPipedSeparatorRow(trimmed: string): boolean {
  return /^\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(trimmed);
}

/** 仅有横线、无竖线 — 模型拆坏的第二行 */
function isOrphanDashLine(trimmed: string): boolean {
  return trimmed.length > 0 && !trimmed.includes("|") && /^:?-{3,}:?\s*$/.test(trimmed);
}

function isTableLikePipeRow(trimmed: string): boolean {
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  return countTableColumns(trimmed) >= 2;
}

/**
 * 表头后若为空行 + 多行裸 :---，合并为一行 | :--- | ... |；
 * 表头与合法分隔行之间的空行去掉（GFM 要求紧邻）。
 */
function repairOrphanSeparatorLines(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (isTableLikePipeRow(trimmed)) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;

      if (j < lines.length) {
        const nextTrim = lines[j].trim();
        if (isOrphanDashLine(nextTrim)) {
          let k = j;
          while (k < lines.length && isOrphanDashLine(lines[k].trim())) k++;
          out.push(trimmed);
          out.push(buildSeparatorLine(countTableColumns(trimmed)));
          i = k;
          continue;
        }
        if (isPipedSeparatorRow(nextTrim)) {
          out.push(trimmed);
          out.push(nextTrim);
          i = j + 1;
          continue;
        }
      }
    }

    out.push(raw);
    i++;
  }
  return out;
}

const TABLE_SEPARATOR_LINE = /^\|(?:\s*:?-{3,}:?\s*\|)+\s*$/;

/**
 * 去掉「表头行」与「分隔行」之间的空行（流式/模型常在中间插空行导致表格断开）。
 */
function removeBlankLinesBetweenHeaderAndSeparator(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (isTableLikePipeRow(t) && !isPipedSeparatorRow(t)) {
      let j = i + 1;
      const gapStart = j;
      while (j < lines.length && lines[j].trim() === "") j++;
      if (j < lines.length && TABLE_SEPARATOR_LINE.test(lines[j].trim())) {
        out.push(lines[i].trim());
        out.push(lines[j].trim());
        i = j + 1;
        continue;
      }
      if (j > gapStart) {
        for (let k = i; k < j; k++) out.push(lines[k]);
        i = j;
        continue;
      }
    }
    out.push(lines[i]);
    i++;
  }
  return out;
}

/**
 * 模型偶在表尾再输出一行 `| :--- | :--- |`；GFM 只认紧跟表头的那一条，多出的会被当成数据行整格显示。
 * 从底部向上找：若某分隔行之后只有「表尾收束」内容，且其上方已出现过分隔行，则删掉这条多余分隔行。
 * 收束含：空行、`>` 引用、`##` 标题、独立 `---`/`***` 水平线，以及不含管道表结构的普通正文行。
 * 若下一非空行是新的 `|...|` 数据/表头或又一整行分隔符，则不删（避免误伤下一张表）。
 */
function isTrailingContentAfterSpuriousTableSeparator(trimmed: string): boolean {
  if (trimmed === "") return true;
  if (trimmed.startsWith(">")) return true;
  if (/^#{1,6}\s/.test(trimmed)) return true;
  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) return true;
  if (isPipedSeparatorRow(trimmed)) return false;
  if (isTableLikePipeRow(trimmed)) return false;
  return true;
}

function stripTrailingSpuriousMarkdownTableSeparator(lines: string[]): string[] {
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (t === "") continue;
    if (!isPipedSeparatorRow(t)) continue;

    let tailOk = true;
    for (let j = i + 1; j < lines.length; j++) {
      const u = lines[j].trim();
      if (!isTrailingContentAfterSpuriousTableSeparator(u)) {
        tailOk = false;
        break;
      }
    }
    if (!tailOk) continue;

    let seenSepAbove = false;
    for (let k = 0; k < i; k++) {
      if (isPipedSeparatorRow(lines[k].trim())) {
        seenSepAbove = true;
        break;
      }
    }
    if (!seenSepAbove) continue;

    let prev = i - 1;
    while (prev >= 0 && lines[prev].trim() === "") prev--;
    if (prev < 0) continue;
    const pt = lines[prev].trim();
    const prevIsData = isTableLikePipeRow(pt) && !isPipedSeparatorRow(pt);
    const prevIsSep = isPipedSeparatorRow(pt);
    if (!prevIsData && !prevIsSep) continue;

    return lines.slice(0, i).concat(lines.slice(i + 1));
  }
  return lines;
}

/** 与解读页一致：规整 GFM 表格换行，避免 remark 解析异常 */
export function normalizeMarkdownTables(markdown: string): string {
  let normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.includes("|")) return normalized.trim();

  normalized = splitCollapsedTablePipeRows(normalized);
  normalized = normalized.replace(/\|\s+\|/g, "|\n|");

  // 不再在「任意非换行 + 竖线」前插 \n：紧凑分隔行 `|:---|:---|` 的单元以 `-|` 结尾，
  // 会误匹配 `[^\n]` 为 `-` 并拆碎整行，导致 remark-gfm 丢列（见计划「表格回归与根因治理」）。

  let fixedLines: string[] = [];

  for (const line of normalized.split("\n")) {
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

  fixedLines = repairOrphanSeparatorLines(fixedLines);
  fixedLines = removeBlankLinesBetweenHeaderAndSeparator(fixedLines);
  fixedLines = stripTrailingSpuriousMarkdownTableSeparator(fixedLines);

  let joined = fixedLines.join("\n").replace(TABLE_SEPARATOR_REGEX, (match) => `\n${match.trim()}\n`);
  // 分隔行两侧补 \n 时易与相邻换行叠成空行，GFM 表要求各行紧邻
  joined = joined.replace(/(\|[^\n]+\|)\n\n(\|(?:\s*:?-{3,}:?\s*\|)+\s*)/g, "$1\n$2");
  joined = joined.replace(/(\|(?:\s*:?-{3,}:?\s*\|)+\s*)\n\n(\|[^\n]+\|)/g, "$1\n$2");
  return joined.replace(/\n{3,}/g, "\n\n").trim();
}
