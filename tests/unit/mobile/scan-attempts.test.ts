import {
  type ScanAttempt,
  shouldPairScannedCode,
} from "@cocurdex/mobile/internal/hosts/scan-attempts";
import { describe, expect, it } from "vitest";

const CODE = "cocurdex://pair?code=abc";

describe("shouldPairScannedCode", () => {
  it("pairs a code it has not tried", () => {
    expect(shouldPairScannedCode(null, CODE, 0)).toBe(true);
    const tried: ScanAttempt = { data: "other", failure: "invalid", at: 0 };
    expect(shouldPairScannedCode(tried, CODE, 0)).toBe(true);
  });

  it("retries an unreachable or rate-limited code after the cooldown", () => {
    for (const failure of ["unreachable", "rateLimited"] as const) {
      const tried: ScanAttempt = { data: CODE, failure, at: 1_000 };
      expect(shouldPairScannedCode(tried, CODE, 1_500)).toBe(false);
      expect(shouldPairScannedCode(tried, CODE, 5_000)).toBe(true);
    }
  });

  it("never retries a code that cannot pair", () => {
    for (const failure of ["invalid", "link", "notPairingCode"] as const) {
      const tried: ScanAttempt = { data: CODE, failure, at: 0 };
      expect(shouldPairScannedCode(tried, CODE, 60_000)).toBe(false);
    }
  });
});
