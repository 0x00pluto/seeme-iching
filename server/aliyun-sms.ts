import Dypnsapi20170525, { SendSmsVerifyCodeRequest } from "@alicloud/dypnsapi20170525";

type DypnsapiConfig = ConstructorParameters<typeof Dypnsapi20170525>[0];

const DEFAULT_SIGN_NAME = "速通互联验证码";
const DEFAULT_TEMPLATE_CODE = "100001";
const DEFAULT_VALID_MINUTES = 10;

function aliyunDepsReady(): boolean {
  return Boolean(
    process.env.ALIYUN_ACCESS_KEY_ID?.trim() &&
      process.env.ALIYUN_ACCESS_KEY_SECRET?.trim(),
  );
}

function phoneE164ToAliyunNumber(phoneE164: string): string {
  return phoneE164.replace(/\D/g, "");
}

function getValidMinutes(): number {
  const raw = process.env.ALIYUN_SMS_VALID_MINUTES?.trim();
  if (!raw) return DEFAULT_VALID_MINUTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_VALID_MINUTES;
  return Math.floor(n);
}

/**
 * 经阿里云 Dypnsapi 发送 Supabase 生成的 OTP。
 * templateParam 透传真实 code，禁止使用 ##code## 占位符。
 */
export async function sendSupabaseOtpSms(params: {
  phone: string;
  code: string;
}): Promise<void> {
  if (!aliyunDepsReady()) {
    throw new Error("Missing ALIYUN_ACCESS_KEY_ID or ALIYUN_ACCESS_KEY_SECRET");
  }

  const signName = process.env.ALIYUN_SMS_SIGN_NAME?.trim() || DEFAULT_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE?.trim() || DEFAULT_TEMPLATE_CODE;
  const validMinutes = getValidMinutes();

  const client = new Dypnsapi20170525({
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!.trim(),
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!.trim(),
    endpoint: "dypnsapi.aliyuncs.com",
  } as DypnsapiConfig);

  const request = new SendSmsVerifyCodeRequest({
    phoneNumber: phoneE164ToAliyunNumber(params.phone),
    signName,
    templateCode,
    // 透传 Supabase OTP，与模板变量对齐（非 ##code##）
    templateParam: JSON.stringify({ code: params.code, min: String(validMinutes) }),
    validTime: validMinutes * 60,
    codeLength: 6,
    codeType: 1,
    countryCode: "86",
    interval: 60,
    duplicatePolicy: 1,
    returnVerifyCode: false,
  });

  const response = await client.sendSmsVerifyCode(request);
  const body = response.body;
  if (!body || body.code !== "OK") {
    const msg = body?.message ?? "Aliyun SendSmsVerifyCode failed";
    throw new Error(msg);
  }
}
