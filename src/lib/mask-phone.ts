const CHINA_MOBILE_RE = /^1[3-9]\d{9}$/;

export function isValidChinaMobile(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  return CHINA_MOBILE_RE.test(digits);
}

/** 脱敏：前 3 + **** + 后 4 */
export function maskPhoneForDisplay(input: string): string {
  const digits = input.replace(/\D/g, "");
  const local =
    digits.startsWith("86") && digits.length === 13 ? digits.slice(2) : digits;

  if (local.length !== 11) {
    return input;
  }

  return `${local.slice(0, 3)}****${local.slice(-4)}`;
}
