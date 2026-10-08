import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@poker/db";
import { authOptions } from "./auth";
import {
  isAdminUser,
  isAllowlistedAdminEmail,
  type AdminActor,
} from "./adminAccess";

export async function loadAdminActor(): Promise<AdminActor | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      accountStatus: true,
    },
  });
  if (!user) return null;

  if (isAllowlistedAdminEmail(user.email) && user.role !== "ADMIN") {
    return prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        accountStatus: true,
      },
    });
  }

  if (!isAdminUser(user)) return null;
  return user;
}

/** 404 for both anonymous and non-admin so /admin is not advertised. */
export async function requireAdminApi(): Promise<
  { admin: AdminActor } | { response: NextResponse }
> {
  const admin = await loadAdminActor();
  if (!admin) {
    return {
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return { admin };
}
