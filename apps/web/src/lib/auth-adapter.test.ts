import { describe, it, expect } from "vitest";
import { toAdapterUser, createAuthAdapter } from "./auth-adapter";

describe("auth adapter mapping", () => {
  it("maps displayName/avatarUrl onto NextAuth name/image", () => {
    expect(
      toAdapterUser({
        id: "user_1",
        email: "host@example.com",
        displayName: "Host",
        avatarUrl: "https://example.com/a.png",
        emailVerified: null,
      })
    ).toEqual({
      id: "user_1",
      email: "host@example.com",
      emailVerified: null,
      name: "Host",
      image: "https://example.com/a.png",
    });
  });

  it("refuses to auto-create users so invite cannot be skipped", async () => {
    const adapter = createAuthAdapter();
    await expect(adapter.createUser!({} as never)).rejects.toThrow(
      /invite registration/i
    );
  });
});
