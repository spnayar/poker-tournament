import { EMAIL_RE } from "./register";

export type LoginStartInput = {
  email: string;
  inviteCode: string | null;
};

export type LoginStartParseResult =
  | { ok: true; data: LoginStartInput }
  | { ok: false; error: string; status: number };

export type LoginStartAction =
  | { action: "send_link" }
  | { action: "needs_invite" }
  | { action: "create_and_send" }
  | { action: "invalid_invite" };

export function parseLoginStartInput(body: unknown): LoginStartParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Enter a valid email", status: 400 };
  }

  const raw = body as Record<string, unknown>;
  const email =
    typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const inviteRaw =
    typeof raw.inviteCode === "string" ? raw.inviteCode.trim() : "";
  const inviteCode = inviteRaw.length > 0 ? inviteRaw : null;

  if (!email) {
    return { ok: false, error: "Enter your email", status: 400 };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email", status: 400 };
  }

  return { ok: true, data: { email, inviteCode } };
}

/**
 * Friends-only UX: unknown emails prompt for invite instead of a dead end.
 * Registered emails always send a link and ignore invite (wrong or missing).
 */
export function decideLoginStart(opts: {
  userExists: boolean;
  inviteCode: string | null;
  expectedInvite: string;
}): LoginStartAction {
  if (opts.userExists) return { action: "send_link" };
  if (!opts.inviteCode) return { action: "needs_invite" };
  if (opts.inviteCode !== opts.expectedInvite) return { action: "invalid_invite" };
  return { action: "create_and_send" };
}
