import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@poker/db";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

/** Read at request time — bracket access avoids Next.js build-time inlining. */
export function readAuthSecret(): string | undefined {
  return process.env["NEXTAUTH_SECRET"] ?? process.env["AUTH_SECRET"];
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
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.picture = user.image;
        token.gameToken = jwt.sign(
          {
            userId: user.id,
            email: user.email,
            displayName: user.name,
          },
          JWT_SECRET,
          { expiresIn: "24h" }
        );
      }
      if (trigger === "update" && session?.image) {
        token.picture = session.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.gameToken = token.gameToken as string;
        session.user.image = (token.picture as string | null) ?? null;
      }
      return session;
    },
  },
};
