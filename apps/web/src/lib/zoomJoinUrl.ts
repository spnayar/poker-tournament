/**
 * Parse Zoom personal / scheduled join URLs for Poker Table Club.
 * Sample shape (pwd omitted): https://us04web.zoom.us/j/{meetingNumber}?pwd=…
 */

export type ZoomJoinParseOk = {
  ok: true;
  /** Canonical https://{host}/j/{meetingNumber} with ?pwd when known. */
  joinUrl: string;
  meetingNumber: string;
  /** Opaque URL pwd token; not the plain passcode. */
  pwdQuery: string | null;
  host: string;
};

export type ZoomJoinParseFail = {
  ok: false;
  error: string;
  /** Raw trimmed input — Phase 1 may still open-as-pasted. */
  raw: string;
};

export type ZoomJoinParseResult = ZoomJoinParseOk | ZoomJoinParseFail;

const MEETING_PATH =
  /^\/(?:j|wc\/join)\/(\d{9,11})(?:\/|$)/i;

export function isZoomHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "zoom.us" || h === "zoom.com" || h.endsWith(".zoom.us") || h.endsWith(".zoom.com");
}

/** Strip pwd (and similar) from a URL string for safe logs / analytics. */
export function redactZoomUrlForLog(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/pwd|pass|token|secret|key/i.test(key)) {
        parsed.searchParams.set(key, "[redacted]");
      }
    }
    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

export function parseZoomJoinUrl(input: string): ZoomJoinParseResult {
  const raw = input.trim();
  if (!raw) {
    return { ok: false, error: "Paste a Zoom join URL", raw };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "That does not look like a URL", raw };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "Zoom join links must use https", raw };
  }

  if (!isZoomHostname(url.hostname)) {
    return { ok: false, error: "Host must be zoom.us or zoom.com", raw };
  }

  const pathMatch = url.pathname.match(MEETING_PATH);
  if (!pathMatch?.[1]) {
    return {
      ok: false,
      error: "Expected a /j/{meetingNumber} (or /wc/join/) path",
      raw,
    };
  }

  const meetingNumber = pathMatch[1];
  const pwdQuery = url.searchParams.get("pwd");
  const host = url.hostname.toLowerCase();
  const joinUrl =
    pwdQuery && pwdQuery.length > 0
      ? `https://${host}/j/${meetingNumber}?pwd=${encodeURIComponent(pwdQuery)}`
      : `https://${host}/j/${meetingNumber}`;

  return {
    ok: true,
    joinUrl,
    meetingNumber,
    pwdQuery: pwdQuery && pwdQuery.length > 0 ? pwdQuery : null,
    host,
  };
}

/** Digits-only meeting id for Meeting SDK JWT `mn`. */
export function normalizeMeetingNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 11) return null;
  return digits;
}
