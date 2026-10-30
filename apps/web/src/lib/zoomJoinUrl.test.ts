import { describe, expect, it } from "vitest";
import {
  normalizeMeetingNumber,
  parseZoomJoinUrl,
  redactZoomUrlForLog,
  resolveZoomCreateAttach,
  resolveZoomLinkFields,
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

describe("resolveZoomLinkFields", () => {
  it("maps a canonical /j/ URL into DB columns", () => {
    const result = resolveZoomLinkFields(
      "https://us04web.zoom.us/j/12345678901?pwd=AbCd"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.zoomMeetingNumber).toBe("12345678901");
    expect(result.fields.zoomPwdQuery).toBe("AbCd");
    expect(result.fields.zoomJoinUrl).toContain("/j/12345678901?pwd=");
  });

  it("soft-stores vanity zoom paths and rejects non-zoom hosts", () => {
    const soft = resolveZoomLinkFields("https://zoom.us/my/hostroom");
    expect(soft.ok).toBe(true);
    if (soft.ok) {
      expect(soft.fields.zoomJoinUrl).toBe("https://zoom.us/my/hostroom");
      expect(soft.fields.zoomMeetingNumber).toBeNull();
    }
    expect(resolveZoomLinkFields("https://evil.example/j/12345678901").ok).toBe(
      false
    );
  });
});

describe("resolveZoomCreateAttach", () => {
  it("returns null when both fields are empty", () => {
    expect(resolveZoomCreateAttach({}).ok).toBe(true);
    const empty = resolveZoomCreateAttach({
      zoomJoinUrl: "  ",
      zoomPasscodePlain: "",
    });
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.attach).toBeNull();
  });

  it("rejects passcode without a join URL", () => {
    const result = resolveZoomCreateAttach({ zoomPasscodePlain: "secret" });
    expect(result.ok).toBe(false);
  });

  it("sets ZOOM_LINK for URL-only and MEETING_SDK_MIRROR when passcode parses", () => {
    const linkOnly = resolveZoomCreateAttach({
      zoomJoinUrl: "https://zoom.us/j/12345678901",
    });
    expect(linkOnly.ok).toBe(true);
    if (linkOnly.ok) {
      expect(linkOnly.attach?.videoMode).toBe("ZOOM_LINK");
      expect(linkOnly.attach?.zoomPasscodePlain).toBeNull();
    }

    const mirror = resolveZoomCreateAttach({
      zoomJoinUrl: "https://zoom.us/j/12345678901",
      zoomPasscodePlain: "plain-pass",
    });
    expect(mirror.ok).toBe(true);
    if (mirror.ok) {
      expect(mirror.attach?.videoMode).toBe("MEETING_SDK_MIRROR");
      expect(mirror.attach?.zoomPasscodePlain).toBe("plain-pass");
    }
  });
});
