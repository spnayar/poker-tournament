import { NextResponse } from "next/server";
import { prisma } from "@poker/db";
import { parseRegisterInput, placeholderDisplayName } from "@/lib/register";

const INVITE_CODE = process.env.INVITE_CODE ?? "friends-only";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = parseRegisterInput(body);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: parsed.status }
      );
    }

    const { email, inviteCode } = parsed.data;

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

    const displayName = placeholderDisplayName(email);

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        displayNameSet: false,
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
