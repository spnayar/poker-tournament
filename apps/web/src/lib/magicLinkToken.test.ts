import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { hashEmailSignInToken } from "./magicLinkToken";

describe("hashEmailSignInToken", () => {
  it("matches NextAuth v4 sha256(token + secret)", () => {
    const token = "abc123";
    const secret = "test-secret";
    expect(hashEmailSignInToken(token, secret)).toBe(
      createHash("sha256").update(`${token}${secret}`).digest("hex")
    );
  });
});
