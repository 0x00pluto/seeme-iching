import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidChinaMobile,
  maskChinaMobile,
  parseChinaMobileToE164,
} from "./phone.js";

describe("phone", () => {
  it("validates mainland 11-digit numbers", () => {
    assert.equal(isValidChinaMobile("13812345678"), true);
    assert.equal(isValidChinaMobile("12812345678"), false);
    assert.equal(isValidChinaMobile("1381234567"), false);
  });

  it("parses 11-digit local to E.164", () => {
    assert.equal(parseChinaMobileToE164("13812345678"), "+8613812345678");
  });

  it("parses +86 prefix", () => {
    assert.equal(parseChinaMobileToE164("+8613812345678"), "+8613812345678");
    assert.equal(parseChinaMobileToE164("8613812345678"), "+8613812345678");
  });

  it("rejects invalid numbers", () => {
    assert.equal(parseChinaMobileToE164("123"), null);
    assert.equal(parseChinaMobileToE164(""), null);
  });

  it("masks phone for display", () => {
    assert.equal(maskChinaMobile("13812345678"), "138****5678");
    assert.equal(maskChinaMobile("+8613812345678"), "138****5678");
  });
});
