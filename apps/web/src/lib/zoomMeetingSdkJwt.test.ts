import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import {
  readZoomMeetingSdkCredentials,
  signZoomMeetingSdkJwt,
  zoomMirrorConfigured,
} from "./zoomMeetingSdkJwt";

describe("signZoomMeetingSdkJwt", () => {
  it("signs HS256 payload with appKey, mn, role, and 30m+ exp", () => {
    const iat = Math.floor(Date.now() / 1000);
    const token = signZoomMeetingSdkJwt({
      clientId: "sdk-client-id",
      clientSecret: "sdk-client-secret",
      meetingNumber: "12345678901",
      role: 0,
      iat,
      ttlSeconds: 1800,
    });

    const decoded = jwt.verify(token, "sdk-client-secret") as Record<string, unknown>;
    expect(decoded.appKey).toBe("sdk-client-id");
    expect(decoded.mn).toBe("12345678901");
    expect(decoded.role).toBe(0);
    expect(decoded.iat).toBe(iat);
    expect(decoded.exp).toBe(iat + 1800);
    expect(decoded.tokenExp).toBe(iat + 1800);
  });
});

describe("readZoomMeetingSdkCredentials", () => {
  it("accepts Client ID/Secret or legacy KEY/SECRET names", () => {
    expect(
      readZoomMeetingSdkCredentials({
        ZOOM_MEETING_SDK_CLIENT_ID: "a",
        ZOOM_MEETING_SDK_CLIENT_SECRET: "b",
      })
    ).toEqual({ clientId: "a", clientSecret: "b" });
    expect(
      readZoomMeetingSdkCredentials({
        ZOOM_MEETING_SDK_KEY: "k",
        ZOOM_MEETING_SDK_SECRET: "s",
      })
    ).toEqual({ clientId: "k", clientSecret: "s" });
    expect(zoomMirrorConfigured({})).toBe(false);
  });
});
