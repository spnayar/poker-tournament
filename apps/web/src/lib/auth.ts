import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@poker/db";

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

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SEC },
  pages: {
    signIn: "/login",
  },
  callbacks: {
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
