import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { Webhook } from "standardwebhooks";
import { verifySendSmsHook } from "./supabase-send-sms-hook.js";

const TEST_SECRET_BASE64 = Buffer.from("test-hook-secret-32bytes-long!!").toString("base64");
const TEST_SECRET = `v1,whsec_${TEST_SECRET_BASE64}`;

function signPayload(body: string): Record<string, string> {
  const wh = new Webhook(TEST_SECRET_BASE64);
  const msgId = "msg_test_001";
  const timestamp = new Date();
  const signature = wh.sign(msgId, timestamp, body);
  return {
    "webhook-id": msgId,
    "webhook-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
    "webhook-signature": signature,
  };
}

describe("verifySendSmsHook", () => {
  const prevSecret = process.env.SEND_SMS_HOOK_SECRET;

  beforeEach(() => {
    process.env.SEND_SMS_HOOK_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    if (prevSecret === undefined) {
      delete process.env.SEND_SMS_HOOK_SECRET;
    } else {
      process.env.SEND_SMS_HOOK_SECRET = prevSecret;
    }
  });

  it("verifies valid payload and extracts phone + otp", () => {
    const body = JSON.stringify({
      user: { phone: "+8613812345678" },
      sms: { otp: "123456" },
    });
    const headers = signPayload(body);
    const payload = verifySendSmsHook(body, headers);
    assert.equal(payload.user.phone, "+8613812345678");
    assert.equal(payload.sms.otp, "123456");
  });

  it("rejects invalid signature", () => {
    const body = JSON.stringify({ user: { phone: "+8613812345678" }, sms: { otp: "123456" } });
    assert.throws(
      () =>
        verifySendSmsHook(body, {
          "webhook-id": "msg_bad",
          "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
          "webhook-signature": "v1,invalid",
        }),
      /signature|webhook|timestamp/i,
    );
  });

  it("throws when secret missing", () => {
    delete process.env.SEND_SMS_HOOK_SECRET;
    const body = JSON.stringify({ user: { phone: "+8613812345678" }, sms: { otp: "123456" } });
    assert.throws(() => verifySendSmsHook(body, signPayload(body)), /SEND_SMS_HOOK_SECRET/);
  });
});
