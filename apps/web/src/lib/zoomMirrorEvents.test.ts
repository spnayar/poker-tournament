import { describe, expect, it } from "vitest";

/**
 * Mirrors Zoom Meeting SDK Component View's client.on() guard:
 * an internal event-name list is assigned during init(). Calling on()
 * before init throws "Cannot read properties of undefined (reading 'includes')".
 */
function zoomLikeOn(
  eventList: string[] | undefined,
  event: string,
  cb: () => void
): void {
  if (typeof cb !== "function") return;
  if (eventList!.includes(event)) {
    cb();
  }
}

describe("Zoom client.on ordering", () => {
  it("throws includes TypeError when event list is not initialized (pre-init)", () => {
    expect(() => zoomLikeOn(undefined, "active-speaker", () => {})).toThrow(
      /includes/
    );
  });

  it("accepts active-speaker after the init-assigned event list exists", () => {
    const events = ["active-speaker", "user-added"];
    let fired = false;
    expect(() =>
      zoomLikeOn(events, "active-speaker", () => {
        fired = true;
      })
    ).not.toThrow();
    expect(fired).toBe(true);
  });
});
