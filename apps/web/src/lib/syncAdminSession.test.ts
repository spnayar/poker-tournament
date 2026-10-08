import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { updateMany, findUnique, update } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@poker/db", () => ({
  prisma: {
    user: { updateMany, findUnique, update },
  },
}));

import { syncAdminFlagOnToken } from "./syncAdminSession";

describe("syncAdminFlagOnToken", () => {
  const original = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    updateMany.mockReset().mockResolvedValue({ count: 0 });
    findUnique.mockReset();
    update.mockReset();
    delete process.env.ADMIN_EMAILS;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  it("sets isAdmin on refresh for allowlisted email even if token had false", async () => {
    const token = {
      id: "sanjay",
      email: "spnayar@gmail.com",
      isAdmin: false,
    };
    await expect(syncAdminFlagOnToken(token)).resolves.toBe(true);
    expect(token.isAdmin).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "sanjay", role: { not: "ADMIN" } },
      data: { role: "ADMIN" },
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("sets isAdmin for info@ allowlist without requiring prior sign-in flag", async () => {
    const token = { id: "info", email: "Info@PokerTableClub.com" };
    await syncAdminFlagOnToken(token);
    expect(token.isAdmin).toBe(true);
  });

  it("grants isAdmin from DB ADMIN role when email is not allowlisted", async () => {
    findUnique.mockResolvedValue({
      role: "ADMIN",
      email: "host@example.com",
    });
    const token = { id: "host", email: "host@example.com", isAdmin: false };
    await syncAdminFlagOnToken(token);
    expect(token.isAdmin).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("clears isAdmin for non-admin players", async () => {
    findUnique.mockResolvedValue({
      role: "PLAYER",
      email: "pal@example.com",
    });
    const token = { id: "pal", email: "pal@example.com", isAdmin: true };
    await syncAdminFlagOnToken(token);
    expect(token.isAdmin).toBe(false);
  });

  it("promotes when DB email is allowlisted even if token email missing", async () => {
    findUnique.mockResolvedValue({
      role: "PLAYER",
      email: "spnayar@gmail.com",
    });
    update.mockResolvedValue({
      role: "ADMIN",
      email: "spnayar@gmail.com",
    });
    const token: { id: string; email?: string; isAdmin?: boolean } = {
      id: "sanjay",
    };
    await syncAdminFlagOnToken(token);
    expect(update).toHaveBeenCalled();
    expect(token.isAdmin).toBe(true);
  });
});
