import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve(__dirname, "../../scripts/assert-boot-secrets.cjs");

function run(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [script], {
    env: { PATH: process.env.PATH, ...env },
    encoding: "utf8",
  });
}

describe("web boot secret check", () => {
  it("does not exit outside production", () => {
    const result = run({ NODE_ENV: "development" });
    expect(result.status).toBe(0);
  });

  it("exits in production when JWT_SECRET is dev-secret", () => {
    const result = run({
      NODE_ENV: "production",
      JWT_SECRET: "dev-secret",
      NEXTAUTH_SECRET: "test-nextauth-secret",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/JWT_SECRET/);
    expect(result.stderr).not.toMatch(/test-nextauth-secret/);
  });

  it("exits 0 in production when both secrets are set", () => {
    const result = run({
      NODE_ENV: "production",
      JWT_SECRET: "test-jwt-secret",
      NEXTAUTH_SECRET: "test-nextauth-secret",
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
