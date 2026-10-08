import { createHash, randomBytes } from "crypto";
import { prisma } from "@poker/db";
import { absoluteAppUrl, appOrigin } from "./emailLayout";
import { emailMaxAgeSec } from "./sendMagicLink";

function authSecret(): string | undefined {
  return process.env["NEXTAUTH_SECRET"] ?? process.env["AUTH_SECRET"];
}

/** Match NextAuth v4 Email provider hashing (`hashToken`). */
export function hashEmailSignInToken(token: string, secret: string): string {
  return createHash("sha256").update(`${token}${secret}`).digest("hex");
}

export async function createEmailCallbackUrl(opts: {
  email: string;
  callbackPath?: string;
}): Promise<string> {
  const secret = authSecret();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is missing");
  }

  const token = randomBytes(32).toString("hex");
  const hashedToken = hashEmailSignInToken(token, secret);
  const expires = new Date(Date.now() + emailMaxAgeSec() * 1000);

  await prisma.verificationToken.create({
    data: {
      identifier: opts.email,
      token: hashedToken,
      expires,
    },
  });

  const callbackUrl = absoluteAppUrl(opts.callbackPath ?? "/dashboard");
  const params = new URLSearchParams({
    callbackUrl,
    token,
    email: opts.email,
  });
  return `${appOrigin()}/api/auth/callback/email?${params.toString()}`;
}
