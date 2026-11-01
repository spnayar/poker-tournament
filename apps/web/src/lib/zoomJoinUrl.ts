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

/**
 * Read `pwd` from any URL-shaped string without requiring a canonical /j/ path.
 * Returns null when missing, empty, or the input is not a URL.
 */
export function extractZoomPwdQuery(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const pwd = new URL(trimmed).searchParams.get("pwd");
    return pwd && pwd.length > 0 ? pwd : null;
  } catch {
    return null;
  }
}

/**
 * When the join-URL field changes, sync the passcode input from `pwd=`.
 * Keeps a user-typed passcode unless the URL's pwd value itself changed
 * (or the field still holds the previous auto-filled pwd and that pwd was removed).
 */
export function nextPasscodeAfterJoinUrlChange(opts: {
  previousJoinUrl: string;
  nextJoinUrl: string;
  passcode: string;
}): string {
  const prevPwd = extractZoomPwdQuery(opts.previousJoinUrl);
  const nextPwd = extractZoomPwdQuery(opts.nextJoinUrl);
  if (nextPwd === prevPwd) {
    return opts.passcode;
  }
  if (nextPwd != null) {
    return nextPwd;
  }
  // pwd removed from the URL — clear only if the field still mirrors the old pwd
  if (opts.passcode === prevPwd) {
    return "";
  }
  return opts.passcode;
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

/** DB fields derived from a host-pasted join URL (create form + lobby PATCH). */
export type ZoomLinkFields = {
  zoomJoinUrl: string;
  zoomMeetingNumber: string | null;
  zoomPwdQuery: string | null;
};

/**
 * Resolve a pasted Zoom join URL into tournament columns.
 * Canonical `/j/{id}` parses fully; other `*.zoom.us` / `*.zoom.com` paths soft-store raw
 * so Join still opens (same contract as lobby ZoomNightPanel).
 */
export function resolveZoomLinkFields(
  input: string
): { ok: true; fields: ZoomLinkFields } | { ok: false; error: string } {
  const parsed = parseZoomJoinUrl(input);
  if (parsed.ok) {
    return {
      ok: true,
      fields: {
        zoomJoinUrl: parsed.joinUrl,
        zoomMeetingNumber: parsed.meetingNumber,
        zoomPwdQuery: parsed.pwdQuery,
      },
    };
  }

  let host: string | null = null;
  try {
    host = new URL(parsed.raw).hostname;
  } catch {
    host = null;
  }
  if (!host || !isZoomHostname(host)) {
    return { ok: false, error: parsed.error };
  }

  return {
    ok: true,
    fields: {
      zoomJoinUrl: parsed.raw,
      zoomMeetingNumber: null,
      zoomPwdQuery: null,
    },
  };
}

/** Optional Zoom attach on create Game Night (empty = leave videoMode NONE). */
export type ZoomCreateAttach = {
  videoMode: "ZOOM_LINK" | "MEETING_SDK_MIRROR";
  zoomJoinUrl: string;
  zoomMeetingNumber: string | null;
  zoomPwdQuery: string | null;
  zoomPasscodePlain: string | null;
  videoEnabledAt: Date;
};

/**
 * Build Zoom columns for tournament create. Both fields optional; passcode alone is rejected.
 */
export function resolveZoomCreateAttach(opts: {
  zoomJoinUrl?: string | null;
  zoomPasscodePlain?: string | null;
}):
  | { ok: true; attach: ZoomCreateAttach | null }
  | { ok: false; error: string } {
  const url =
    typeof opts.zoomJoinUrl === "string" ? opts.zoomJoinUrl.trim() : "";
  const pass =
    typeof opts.zoomPasscodePlain === "string"
      ? opts.zoomPasscodePlain.trim()
      : "";

  if (!url && !pass) {
    return { ok: true, attach: null };
  }
  if (!url) {
    return {
      ok: false,
      error: "Paste a Zoom join URL to attach a passcode",
    };
  }

  const resolved = resolveZoomLinkFields(url);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const passcodePlain = pass.length > 0 ? pass : null;
  const canMirror = Boolean(resolved.fields.zoomMeetingNumber && passcodePlain);

  return {
    ok: true,
    attach: {
      videoMode: canMirror ? "MEETING_SDK_MIRROR" : "ZOOM_LINK",
      zoomJoinUrl: resolved.fields.zoomJoinUrl,
      zoomMeetingNumber: resolved.fields.zoomMeetingNumber,
      zoomPwdQuery: resolved.fields.zoomPwdQuery,
      zoomPasscodePlain: passcodePlain,
      videoEnabledAt: new Date(),
    },
  };
}
