import { createRequire } from "node:module";
import { describe, it, expect } from "vitest";
import { magicLinkSendFailed } from "./magicLinkUi";

const { parseDotEnv, applyBlankEnv } = createRequire(import.meta.url)(
  "../../load-root-env.cjs"
) as {
  parseDotEnv: (contents: string) => Record<string, string>;
  applyBlankEnv: (
    parsed: Record<string, string>,
    env?: Record<string, string | undefined>
  ) => Record<string, string | undefined>;
};

describe("load-root-env", () => {
  it("fills blank RESEND_API_KEY from the root file", () => {
    const parsed = parseDotEnv(
      'RESEND_API_KEY="re_live_example"\nEMAIL_FROM=""\n'
    );
    const env: Record<string, string> = { RESEND_API_KEY: "" };
    applyBlankEnv(parsed, env);
    expect(env.RESEND_API_KEY).toBe("re_live_example");
  });

  it("does not override a non-empty apps/web key", () => {
    const env: Record<string, string> = { RESEND_API_KEY: "re_from_app" };
    applyBlankEnv({ RESEND_API_KEY: "re_from_root" }, env);
    expect(env.RESEND_API_KEY).toBe("re_from_app");
  });
});

describe("magicLinkSendFailed", () => {
  it("treats NextAuth EmailSignin as a failed send", () => {
    expect(magicLinkSendFailed({ error: "EmailSignin", ok: false })).toBe(
      true
    );
    expect(magicLinkSendFailed({ error: null, ok: true })).toBe(false);
    expect(magicLinkSendFailed(undefined)).toBe(false);
  });
});
