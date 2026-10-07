import { describe, expect, it } from "vitest";
import type { PastPlayer } from "./gameNightInvite";
import {
  addInvite,
  addInviteFromEmail,
  hasInvite,
  inviteEmails,
  inviteFromPastPlayer,
  isValidInviteEmail,
  removeInvite,
} from "./inviteList";

const pat: PastPlayer = {
  userId: "u1",
  displayName: "Pat",
  email: "Pat@Example.com",
  avatarUrl: "/avatars/man-jack.svg",
};

describe("invite list (compose, then send)", () => {
  it("adds a past player without sending", () => {
    const next = addInvite([], inviteFromPastPlayer(pat));
    expect(next).toEqual([
      {
        email: "pat@example.com",
        displayName: "Pat",
        avatarUrl: "/avatars/man-jack.svg",
      },
    ]);
    expect(hasInvite(next, "PAT@example.com")).toBe(true);
  });

  it("adds a typed email and de-dupes past-player clicks", () => {
    let list = addInviteFromEmail([], "  New@Friend.co ").list;
    list = addInvite(list, inviteFromPastPlayer(pat));
    list = addInvite(list, inviteFromPastPlayer(pat));
    const again = addInviteFromEmail(list, "new@friend.co");
    expect(again.ok).toBe(true);
    expect(inviteEmails(again.list)).toEqual([
      "new@friend.co",
      "pat@example.com",
    ]);
  });

  it("resolves a typed email to a past player's name", () => {
    const { list, ok } = addInviteFromEmail([], "pat@example.com", [pat]);
    expect(ok).toBe(true);
    expect(list[0]?.displayName).toBe("Pat");
  });

  it("rejects invalid email and keeps the list unchanged", () => {
    const start = addInvite([], inviteFromPastPlayer(pat));
    const { list, ok } = addInviteFromEmail(start, "not-an-email");
    expect(ok).toBe(false);
    expect(list).toBe(start);
    expect(isValidInviteEmail("")).toBe(false);
  });

  it("removes from the invite list, not by implying a send", () => {
    let list = addInvite([], inviteFromPastPlayer(pat));
    list = addInviteFromEmail(list, "other@x.co").list;
    list = removeInvite(list, "PAT@example.com");
    expect(inviteEmails(list)).toEqual(["other@x.co"]);
    expect(hasInvite(list, "pat@example.com")).toBe(false);
  });
});
