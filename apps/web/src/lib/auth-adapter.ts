import type { Adapter, AdapterUser } from "next-auth/adapters";
import { prisma, type User } from "@poker/db";

export function toAdapterUser(
  user: Pick<
    User,
    "id" | "email" | "displayName" | "avatarUrl" | "emailVerified"
  >
): AdapterUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.displayName,
    image: user.avatarUrl,
  };
}

/**
 * Thin Prisma adapter: maps NextAuth name/image onto displayName/avatarUrl.
 * JWT sessions — no Session table. createUser is rejected so invite cannot
 * be skipped by the Email provider.
 */
export function createAuthAdapter(): Adapter {
  return {
    async createUser() {
      throw new Error("Accounts must be created via invite registration");
    },
    async getUser(id) {
      const user = await prisma.user.findUnique({ where: { id } });
      return user ? toAdapterUser(user) : null;
    },
    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({ where: { email } });
      return user ? toAdapterUser(user) : null;
    },
    async updateUser(partial) {
      const data: {
        emailVerified?: Date | null;
        displayName?: string;
        avatarUrl?: string | null;
        email?: string;
      } = {};
      if (partial.emailVerified !== undefined) {
        data.emailVerified = partial.emailVerified;
      }
      if (partial.name) data.displayName = partial.name;
      if (partial.image !== undefined) data.avatarUrl = partial.image ?? null;
      if (partial.email) data.email = partial.email;
      const user = await prisma.user.update({
        where: { id: partial.id },
        data,
      });
      return toAdapterUser(user);
    },
    async createVerificationToken({ identifier, token, expires }) {
      return prisma.verificationToken.create({
        data: { identifier, token, expires },
      });
    },
    async useVerificationToken({ identifier, token }) {
      try {
        return await prisma.verificationToken.delete({
          where: { identifier_token: { identifier, token } },
        });
      } catch {
        return null;
      }
    },
  };
}
