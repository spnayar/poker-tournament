import { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import jwt from "jsonwebtoken";
import { headers } from "next/headers";
import { prisma, recordUserLogin } from "@poker/db";
import { createAuthAdapter } from "./auth-adapter";
import { deliverMagicLink, emailMaxAgeSec } from "./sendMagicLink";
import { isAdminUser, isAllowlistedAdminEmail } from "./adminAccess";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";
/** Match NextAuth session length; refresh near expiry so sockets stay valid. */
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 year
const GAME_TOKEN_EXPIRES_IN = "365d";
const GAME_TOKEN_REFRESH_WITHIN_MS = 60 * 60 * 24 * 7; // refresh within last week

/** Read at request time — bracket access avoids Next.js build-time inlining. */
export function readAuthSecret(): string | undefined {
  return process.env["NEXTAUTH_SECRET"] ?? process.env["AUTH_SECRET"];
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

export const authOptions: NextAuthOptions = {
  adapter: createAuthAdapter(),
  secret: readAuthSecret(),
  providers: [
    EmailProvider({
      maxAge: emailMaxAgeSec(),
      async sendVerificationRequest({ identifier, url }) {
        const ip = await clientIp();
        await deliverMagicLink({ identifier, url, ip });
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
        if (user.id) {
          try {
            await recordUserLogin(user.id);
          } catch (err) {
            console.error("[auth] recordUserLogin failed", err);
          }
        }
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, email: true },
          });
          if (dbUser && isAllowlistedAdminEmail(dbUser.email) && dbUser.role !== "ADMIN") {
            await prisma.user.update({
              where: { id: user.id },
              data: { role: "ADMIN" },
            });
            token.isAdmin = true;
          } else {
            token.isAdmin = dbUser ? isAdminUser(dbUser) : isAllowlistedAdminEmail(user.email);
          }
        } catch (err) {
          console.error("[auth] admin role lookup failed", err);
          token.isAdmin = isAllowlistedAdminEmail(user.email);
        }
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
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
};
