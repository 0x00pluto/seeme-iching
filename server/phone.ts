const CHINA_MOBILE_RE = /^1[3-9]\d{9}$/;

/** 大陆 11 位手机号（不含国家码） */
export function isValidChinaMobile(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  return CHINA_MOBILE_RE.test(digits);
}

/** 接受 11 位或 +86 前缀，规范化为 E.164（+861xxxxxxxxxx） */
export function parseChinaMobileToE164(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+86") || trimmed.startsWith("86")) {
    if (digits.startsWith("86") && digits.length === 13) {
      digits = digits.slice(2);
    }
  }

  if (!CHINA_MOBILE_RE.test(digits)) {
    return null;
  }

  return `+86${digits}`;
}

/** 脱敏：前 3 + **** + 后 4，例 138****5678 */
export function maskChinaMobile(e164Or11: string): string {
  const e164 = parseChinaMobileToE164(e164Or11) ?? e164Or11;
  const digits = e164.replace(/\D/g, "");
  const local =
    digits.startsWith("86") && digits.length === 13 ? digits.slice(2) : digits;

  if (local.length !== 11) {
    return e164Or11;
  }

  return `${local.slice(0, 3)}****${local.slice(-4)}`;
}
