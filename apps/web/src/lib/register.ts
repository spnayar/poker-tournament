export type RegisterInput = {
  email: string;
  displayName: string;
  inviteCode: string;
};

export type RegisterParseResult =
  | { ok: true; data: RegisterInput }
  | { ok: false; error: string; status: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRegisterInput(body: unknown): RegisterParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "All fields are required", status: 400 };
  }

  const raw = body as Record<string, unknown>;
  const email =
    typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const displayName =
    typeof raw.displayName === "string" ? raw.displayName.trim() : "";
  const inviteCode =
    typeof raw.inviteCode === "string" ? raw.inviteCode.trim() : "";

  if (!email || !displayName || !inviteCode) {
    return { ok: false, error: "All fields are required", status: 400 };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email", status: 400 };
  }
  if (displayName.length < 2 || displayName.length > 32) {
    return {
      ok: false,
      error: "Display name must be 2–32 characters",
      status: 400,
    };
  }

  return { ok: true, data: { email, displayName, inviteCode } };
}
