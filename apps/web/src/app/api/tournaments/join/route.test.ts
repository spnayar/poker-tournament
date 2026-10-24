import { beforeEach, describe, expect, it, vi } from "vitest";

const { consume, findUnique, getServerSession } = vi.hoisted(() => ({
  consume: vi.fn(),
  findUnique: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  joinCodeLimiter: { consume },
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@poker/db", () => ({
  prisma: {
    tournament: { findUnique },
    game: { findFirst: vi.fn() },
    tournamentPlayer: { create: vi.fn() },
  },
}));

import { GET, POST } from "./route";

const preview = {
  id: "night-1",
  name: "Friday",
  status: "LOBBY",
  inviteCode: "XK7M",
  buyInCents: 2000,
  maxPlayers: 9,
  host: { displayName: "Sanjay" },
  players: [],
};

describe("join routes", () => {
  beforeEach(() => {
    consume.mockReset();
    findUnique.mockReset();
    getServerSession.mockReset();
    consume.mockResolvedValue({ allowed: true, retryAfterSec: 900 });
    findUnique.mockResolvedValue(preview);
    getServerSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("rate-limits join preview before looking up a code", async () => {
    consume.mockResolvedValue({ allowed: false, retryAfterSec: 900 });
    const res = await GET(
      new Request("http://localhost/api/tournaments/join?code=XK7M", {
        headers: { "x-forwarded-for": "8.8.8.8" },
      })
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Too many join attempts. Try again later.",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(consume).toHaveBeenCalledWith("8.8.8.8");
  });

  it("still previews an existing 4-character code", async () => {
    const res = await GET(
      new Request("http://localhost/api/tournaments/join?code=xk7m")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.joinCode).toBe("XK7M");
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { inviteCode: "XK7M" } })
    );
  });

  it("rate-limits join before creating a seat", async () => {
    consume.mockResolvedValue({ allowed: false, retryAfterSec: 60 });
    const res = await POST(
      new Request("http://localhost/api/tournaments/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ joinCode: "AB12CD34" }),
      })
    );
    expect(res.status).toBe(429);
    expect(getServerSession).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("looks up a new 8-character code", async () => {
    findUnique.mockResolvedValue({
      ...preview,
      inviteCode: "AB12CD34",
    });
    const res = await POST(
      new Request("http://localhost/api/tournaments/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ joinCode: "ab12cd34" }),
      })
    );
    expect(res.status).toBe(200);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { inviteCode: "AB12CD34" } })
    );
  });
});
