import { prisma } from "@poker/db";
import { isAdminUser, isAllowlistedAdminEmail } from "./adminAccess";

export type AdminTokenFields = {
  id?: string | null;
  email?: string | null;
  isAdmin?: boolean;
};

/**
 * Recompute `token.isAdmin` from the hardcoded/env allowlist and DB role on
 * every JWT/session refresh — not only at first magic-link sign-in — so
 * allowlisted emails pick up Admin after deploy without a one-off trick.
 * Also promotes allowlisted users to ADMIN in the DB when needed.
 */
export async function syncAdminFlagOnToken(
  token: AdminTokenFields
): Promise<boolean> {
  const email =
    typeof token.email === "string" ? token.email.trim() : undefined;
  const userId = typeof token.id === "string" ? token.id : undefined;

  if (isAllowlistedAdminEmail(email)) {
    if (userId) {
      try {
        await prisma.user.updateMany({
          where: { id: userId, role: { not: "ADMIN" } },
          data: { role: "ADMIN" },
        });
      } catch (err) {
        console.error("[auth] admin role promote failed", err);
      }
    }
    token.isAdmin = true;
    return true;
  }

  if (!userId) {
    token.isAdmin = false;
    return false;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });
    if (!dbUser) {
      token.isAdmin = false;
      return false;
    }
    // Allowlist may match DB email even if token.email drifted.
    if (isAllowlistedAdminEmail(dbUser.email) && dbUser.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: userId },
        data: { role: "ADMIN" },
      });
      token.isAdmin = true;
      return true;
    }
    token.isAdmin = isAdminUser(dbUser);
    return token.isAdmin;
  } catch (err) {
    console.error("[auth] admin role lookup failed", err);
    token.isAdmin = isAllowlistedAdminEmail(email);
    return Boolean(token.isAdmin);
  }
}
