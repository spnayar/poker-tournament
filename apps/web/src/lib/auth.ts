import { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import jwt from "jsonwebtoken";
import { headers } from "next/headers";
import { prisma } from "@poker/db";
import { createAuthAdapter } from "./auth-adapter";
import { sendAppEmail } from "./mailer";
import { sendLinkLimiter } from "./rateLimit";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";
/** Match NextAuth session length; refresh near expiry so sockets stay valid. */
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 year
const GAME_TOKEN_EXPIRES_IN = "365d";
const GAME_TOKEN_REFRESH_WITHIN_MS = 60 * 60 * 24 * 7; // refresh within last week
const DEFAULT_EMAIL_MAX_AGE_SEC = 900; // 15 minutes

/** Read at request time — bracket access avoids Next.js build-time inlining. */
export function readAuthSecret(): string | undefined {
  return process.env["NEXTAUTH_SECRET"] ?? process.env["AUTH_SECRET"];
}

function emailMaxAgeSec(): number {
  const raw = Number(process.env["AUTH_EMAIL_MAX_AGE"]);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_EMAIL_MAX_AGE_SEC;
}

function signGameToken(
  userId: string,
  email: string,
  displayName: string
): string {
  return jwt.sign(
    { userId, email, displayName },
    JWT_SECRET,
    { expiresIn: GAME_TOKEN_EXPIRES_IN }
  );
}

function gameTokenNeedsRefresh(gameToken: unknown): boolean {
  if (typeof gameToken !== "string" || !gameToken) return true;
  const payload = jwt.decode(gameToken) as { exp?: number } | null;
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now() + GAME_TOKEN_REFRESH_WITHIN_MS;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }
    return h.get("x-real-ip")?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function magicLinkHtml(url: string, minutes: number): string {
  return `<div style="font-family:Helvetica,Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155;">
    <h1 style="color:#f8fafc;font-size:22px;margin:0 0 12px;">Poker Night</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.5;">Use this one-time link to sign in. It expires in ${minutes} minutes.</p>
    <p style="margin:28px 0;"><a href="${url}" style="background:#059669;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block;">Sign in</a></p>
    <p style="color:#64748b;font-size:12px;line-height:1.4;">If you did not request this, you can ignore the email.</p>
  </div>
</div>`;
}

export const authOptions: NextAuthOptions = {
  adapter: createAuthAdapter(),
  secret: readAuthSecret(),
  providers: [
    EmailProvider({
      maxAge: emailMaxAgeSec(),
      async sendVerificationRequest({ identifier, url }) {
        const ip = await clientIp();
        const { allowed } = await sendLinkLimiter.consume(identifier, ip);
        if (!allowed) {
          console.warn("[auth] Magic-link send rate-limited", {
            email: identifier,
          });
          return;
        }

        const existing = await prisma.user.findUnique({
          where: { email: identifier },
          select: { id: true },
        });
        if (!existing) {
          // Same client message either way — do not send or log a link.
          return;
        }

        if (!isProduction()) {
          console.log("[auth] Magic link callback URL (non-prod):", url);
        }

        const minutes = Math.round(emailMaxAgeSec() / 60);
        try {
          await sendAppEmail({
            to: identifier,
            subject: "Your Poker Night login link",
            html: magicLinkHtml(url, minutes),
            text: `Sign in to Poker Night (expires in ${minutes} minutes):\n${url}\n`,
          });
        } catch (err) {
          console.error(
            "[auth] Failed to send magic-link email",
            err instanceof Error ? err.message : err
          );
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SEC },
  pages: {
    signIn: "/login",
    verifyRequest: "/check-email",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, email }) {
      if (!user?.email) return false;
      // Always allow the "send link" step so unknown emails get the same UX.
      if (email?.verificationRequest) return true;
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true },
      });
      return !!existing;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
        token.gameToken = signGameToken(
          user.id,
          user.email ?? "",
          user.name ?? ""
        );
      }
      if (trigger === "update" && session) {
        if (session.image !== undefined) {
          token.picture = session.image;
        }
        if (session.name !== undefined) {
          token.name = session.name;
          token.gameToken = signGameToken(
            token.id as string,
            token.email as string,
            session.name
          );
        }
      }
      // NextAuth sessions outlive the old 24h gameToken — refresh while logged in.
      if (
        token.id &&
        token.email &&
        gameTokenNeedsRefresh(token.gameToken)
      ) {
        token.gameToken = signGameToken(
          token.id as string,
          token.email as string,
          (token.name as string | undefined) ?? ""
        );
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = (token.name as string | undefined) ?? session.user.name;
        session.user.gameToken = token.gameToken as string;
        session.user.image = (token.picture as string | null) ?? null;
      }
      return session;
    },
  },
};
