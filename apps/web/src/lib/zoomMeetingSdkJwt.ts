import jwt from "jsonwebtoken";

export type ZoomMeetingSdkRole = 0 | 1;

export type ZoomMeetingSdkJwtInput = {
  clientId: string;
  clientSecret: string;
  meetingNumber: string;
  /** 0 = join as participant (mirror), 1 = host start. */
  role: ZoomMeetingSdkRole;
  /** Issued-at epoch seconds; defaults to now. */
  iat?: number;
  /** Lifetime seconds; Zoom requires exp ≥ iat + 1800. */
  ttlSeconds?: number;
};

/**
 * Server-side Meeting SDK JWT. Never ship clientSecret to the browser.
 * Payload per https://developers.zoom.us/docs/meeting-sdk/auth/
 */
export function signZoomMeetingSdkJwt(input: ZoomMeetingSdkJwtInput): string {
  const iat = input.iat ?? Math.floor(Date.now() / 1000);
  const ttl = Math.max(input.ttlSeconds ?? 7200, 1800);
  const exp = iat + ttl;

  const payload = {
    appKey: input.clientId,
    mn: input.meetingNumber,
    role: input.role,
    iat,
    exp,
    tokenExp: exp,
  };

  return jwt.sign(payload, input.clientSecret, {
    algorithm: "HS256",
    header: { alg: "HS256", typ: "JWT" },
  });
}

export type ZoomEnv = Record<string, string | undefined>;

export function readZoomMeetingSdkCredentials(env: ZoomEnv = process.env): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId =
    env.ZOOM_MEETING_SDK_CLIENT_ID?.trim() ||
    env.ZOOM_MEETING_SDK_KEY?.trim() ||
    "";
  const clientSecret =
    env.ZOOM_MEETING_SDK_CLIENT_SECRET?.trim() ||
    env.ZOOM_MEETING_SDK_SECRET?.trim() ||
    "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function zoomMirrorConfigured(env: ZoomEnv = process.env): boolean {
  return readZoomMeetingSdkCredentials(env) !== null;
}
