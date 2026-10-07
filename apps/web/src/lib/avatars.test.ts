import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AVATAR_LIBRARY,
  AVATAR_SOURCES,
  findAvatarByUrl,
  isAllowedAvatarUrl,
  resolveAvatarUrl,
} from "./avatars";

const publicAvatars = path.resolve(__dirname, "../../public/avatars");

describe("avatar library", () => {
  it("has unique ids and local /avatars/*.svg URLs", () => {
    const ids = AVATAR_LIBRARY.map((avatar) => avatar.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(AVATAR_LIBRARY.length).toBe(AVATAR_SOURCES.length);
    expect(AVATAR_LIBRARY.length).toBeGreaterThan(50);

    for (const avatar of AVATAR_LIBRARY) {
      expect(avatar.url).toBe(`/avatars/${avatar.id}.svg`);
      expect(isAllowedAvatarUrl(avatar.url)).toBe(true);
    }
  });

  it("ships an SVG file for every picker option", () => {
    for (const avatar of AVATAR_LIBRARY) {
      const file = path.join(publicAvatars, `${avatar.id}.svg`);
      expect(existsSync(file), `missing ${file}`).toBe(true);
      const body = readFileSync(file, "utf8");
      expect(body).toMatch(/<svg[\s>]/i);
    }
  });

  it("maps legacy DiceBear HTTP URLs onto local assets", () => {
    const bunnyRemote =
      "https://api.dicebear.com/7.x/big-ears/svg?seed=Bunny&backgroundColor=ffd5dc";
    expect(isAllowedAvatarUrl(bunnyRemote)).toBe(true);
    expect(resolveAvatarUrl(bunnyRemote)).toBe("/avatars/animal-bunny.svg");
    expect(findAvatarByUrl(bunnyRemote)?.id).toBe("animal-bunny");
    expect(findAvatarByUrl("/avatars/fun-robot-1.svg")?.label).toBe("Robot");
  });

  it("rejects URLs outside the curated set", () => {
    expect(isAllowedAvatarUrl("https://evil.example/x.svg")).toBe(false);
    expect(isAllowedAvatarUrl("/avatars/not-a-real-one.svg")).toBe(false);
  });
});
