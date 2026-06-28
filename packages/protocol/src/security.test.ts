import { describe, it, expect } from "vitest";
import { ServerEvents } from "./index";

/**
 * Documents the security contract: hole cards must only be sent via PLAYER_CARDS,
 * never in public events like TABLE_STATE or ANIM_DEAL.
 */
describe("wire protocol security", () => {
  const publicEvents = [
    ServerEvents.TABLE_STATE,
    ServerEvents.ANIM_DEAL,
    ServerEvents.ANIM_REVEAL,
    ServerEvents.ANIM_CHIPS,
    ServerEvents.HAND_RESULT,
    ServerEvents.TOURNAMENT_FINISHED,
    ServerEvents.GAME_FINISHED,
    ServerEvents.GAME_STARTED,
  ];

  it("reserves player:cards for private hole card delivery only", () => {
    expect(ServerEvents.PLAYER_CARDS).toBe("player:cards");
    expect(publicEvents).not.toContain(ServerEvents.PLAYER_CARDS);
  });

  it("action:required is player-scoped not broadcast", () => {
    expect(publicEvents).not.toContain(ServerEvents.ACTION_REQUIRED);
  });
});
