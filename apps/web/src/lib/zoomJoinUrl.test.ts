import { describe, expect, it } from "vitest";
import {
  normalizeMeetingNumber,
  parseZoomJoinUrl,
  redactZoomUrlForLog,
} from "./zoomJoinUrl";

describe("parseZoomJoinUrl", () => {
  it("parses regional personal-meeting join URLs with pwd", () => {
    const result = parseZoomJoinUrl(
      "https://us04web.zoom.us/j/12345678901?pwd=AbCdEfGhIjKlMnOp"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meetingNumber).toBe("12345678901");
    expect(result.pwdQuery).toBe("AbCdEfGhIjKlMnOp");
    expect(result.host).toBe("us04web.zoom.us");
    expect(result.joinUrl).toContain("/j/12345678901?pwd=");
  });

  it("accepts 9–11 digit meeting numbers without pwd", () => {
    const result = parseZoomJoinUrl("https://zoom.us/j/123456789");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meetingNumber).toBe("123456789");
    expect(result.pwdQuery).toBeNull();
  });

  it("rejects non-https and non-zoom hosts", () => {
    expect(parseZoomJoinUrl("http://zoom.us/j/12345678901").ok).toBe(false);
    expect(parseZoomJoinUrl("https://example.com/j/12345678901").ok).toBe(false);
  });
});

describe("normalizeMeetingNumber", () => {
  it("strips non-digits and validates length", () => {
    expect(normalizeMeetingNumber("123 456 78901")).toBe("12345678901");
    expect(normalizeMeetingNumber("12345")).toBeNull();
  });
});

describe("redactZoomUrlForLog", () => {
  it("redacts pwd query", () => {
    const redacted = redactZoomUrlForLog(
      "https://us04web.zoom.us/j/12345678901?pwd=SuperSecret"
    );
    expect(redacted).not.toContain("SuperSecret");
    expect(redacted).toContain("pwd=");
  });
});
