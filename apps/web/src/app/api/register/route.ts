import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@poker/db";
import { getAvatarUrl } from "@/lib/utils";

const INVITE_CODE = process.env.INVITE_CODE ?? "friends-only";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, displayName, inviteCode } = body;

    if (!email || !password || !displayName || !inviteCode) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (inviteCode !== INVITE_CODE) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const avatarUrl = getAvatarUrl(displayName);

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        avatarUrl,
        stats: { create: {} },
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    });
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
