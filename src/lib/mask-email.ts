/** 脱敏展示：本地部分首字符 + *** + @ 后完整域名 */
export function maskEmailForDisplay(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return trimmed;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  const first = local.charAt(0);
  return `${first}***${domain}`;
}
