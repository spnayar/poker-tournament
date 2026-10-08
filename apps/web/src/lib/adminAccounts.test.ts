import { describe, it, expect, vi, beforeEach } from "vitest";

const { findMany, findUnique, tournamentFindMany, gameResultFindMany, transaction } =
  vi.hoisted(() => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    tournamentFindMany: vi.fn(),
    gameResultFindMany: vi.fn(),
    transaction: vi.fn(),
  }));

vi.mock("@poker/db", () => ({
  prisma: {
    user: { findMany, findUnique },
    tournament: { findMany: tournamentFindMany },
    gameResult: { findMany: gameResultFindMany },
    $transaction: transaction,
  },
  recomputeUserStats: vi.fn(),
}));

import { listAdminAccounts } from "./adminAccounts";

describe("listAdminAccounts", () => {
  beforeEach(() => {
    findMany.mockReset();
    findUnique.mockReset();
    tournamentFindMany.mockReset();
    gameResultFindMany.mockReset();
    transaction.mockReset();
  });

  it("includes lastLoginAt and omits secrets and hole cards", async () => {
    const lastLoginAt = new Date("2026-10-08T14:25:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "u1",
        email: "pal@example.com",
        displayName: "Pal",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        lastLoginAt,
        loginCount: 3,
        role: "PLAYER",
        accountStatus: "FREE",
        passwordHash: "should-not-be-selected",
        stats: {
          tournamentsPlayed: 2,
          totalBuyInCents: 4000,
          totalPayoutCents: 7000,
        },
        _count: { tournamentPlayers: 4 },
      },
    ]);

    const rows = await listAdminAccounts("admin-1");
    expect(rows).toEqual([
      {
        id: "u1",
        email: "pal@example.com",
        displayName: "Pal",
        createdAt: "2026-09-01T00:00:00.000Z",
        lastLoginAt: "2026-10-08T14:25:00.000Z",
        loginCount: 3,
        role: "PLAYER",
        accountStatus: "FREE",
        gameNights: 4,
        tournamentsPlayed: 2,
        totalBuyInCents: 4000,
        totalPayoutCents: 7000,
        canDelete: true,
      },
    ]);
    const json = JSON.stringify(rows);
    expect(json).not.toContain("passwordHash");
    expect(json).not.toContain("hole");
    expect(json).not.toContain("should-not-be-selected");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          lastLoginAt: true,
          loginCount: true,
        }),
      })
    );
  });

  it("shows null lastLoginAt when they have never signed in", async () => {
    findMany.mockResolvedValue([
      {
        id: "u2",
        email: "new@example.com",
        displayName: "new",
        createdAt: new Date("2026-10-08T00:00:00.000Z"),
        lastLoginAt: null,
        loginCount: 0,
        role: "PLAYER",
        accountStatus: "FREE",
        stats: null,
        _count: { tournamentPlayers: 0 },
      },
    ]);
    const rows = await listAdminAccounts("admin-1");
    expect(rows[0]?.lastLoginAt).toBeNull();
  });
});
