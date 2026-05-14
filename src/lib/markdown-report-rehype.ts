import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

/** 观心报告：解析表内 `<br>` 等 raw HTML，再经 rehype-sanitize 默认（GitHub 风格）schema 清洗 XSS */
export const markdownReportRehypePlugins = [rehypeRaw, rehypeSanitize];
