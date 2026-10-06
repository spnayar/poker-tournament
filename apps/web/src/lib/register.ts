export type RegisterInput = {
  email: string;
  inviteCode: string;
};

export type RegisterParseResult =
  | { ok: true; data: RegisterInput }
  | { ok: false; error: string; status: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME_MAX = 32;
const DISPLAY_NAME_FALLBACK = "Player";

/**
 * Suggested table name from the email local-part.
 * `spnayar+test1@gmail.com` → `spnayar` (plus-tags stripped).
 */
export function placeholderDisplayName(email: string): string {
  const at = email.indexOf("@");
  const local = (at >= 0 ? email.slice(0, at) : email).trim();
  const withoutPlus = local.split("+")[0]?.trim() ?? "";
  const candidate = withoutPlus || local;
  const clipped = candidate.slice(0, DISPLAY_NAME_MAX);
  if (clipped.length >= 2) return clipped;
  if (local.length >= 2) return local.slice(0, DISPLAY_NAME_MAX);
  return DISPLAY_NAME_FALLBACK;
}

export function parseRegisterInput(body: unknown): RegisterParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Email and invite code are required", status: 400 };
  }

  const raw = body as Record<string, unknown>;
  const email =
    typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const inviteCode =
    typeof raw.inviteCode === "string" ? raw.inviteCode.trim() : "";

  if (!email || !inviteCode) {
    return { ok: false, error: "Email and invite code are required", status: 400 };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email", status: 400 };
  }

  return { ok: true, data: { email, inviteCode } };
}
