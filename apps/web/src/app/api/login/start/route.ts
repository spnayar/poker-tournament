import { NextResponse } from "next/server";
import { prisma } from "@poker/db";
import { decideLoginStart, parseLoginStartInput } from "@/lib/loginStart";
import { expectedInviteCode, invitedUserCreateData } from "@/lib/register";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = parseLoginStartInput(body);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: parsed.status }
      );
    }

    const { email, inviteCode } = parsed.data;
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const decision = decideLoginStart({
      userExists: Boolean(existing),
      inviteCode,
      expectedInvite: expectedInviteCode(),
    });

    if (decision.action === "needs_invite") {
      return NextResponse.json({ status: "needs_invite" });
    }

    if (decision.action === "invalid_invite") {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
    }

    if (decision.action === "create_and_send") {
      try {
        await prisma.user.create({ data: invitedUserCreateData(email) });
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
        // Concurrent signup for the same email — treat as already registered.
        if (code !== "P2002") throw error;
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json(
      { error: "Could not start login" },
      { status: 500 }
    );
  }
}
