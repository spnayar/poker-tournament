import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";
import {
  listPastPlayers,
  parseInviteEmails,
  sendGameNightInvites,
} from "@/lib/gameNightInvite";
import { requestIp } from "@/lib/requestIp";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { players: { select: { userId: true } } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (tournament.hostUserId !== session.user.id) {
    return NextResponse.json({ error: "Only the host can invite" }, { status: 403 });
  }

  const suggestions = await listPastPlayers({
    userId: session.user.id,
    excludeUserIds: tournament.players.map((p) => p.userId),
  });

  return NextResponse.json({ suggestions });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      host: { select: { displayName: true, email: true } },
    },
  });
  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (tournament.hostUserId !== session.user.id) {
    return NextResponse.json({ error: "Only the host can invite" }, { status: 403 });
  }
  if (tournament.status === "FINISHED") {
    return NextResponse.json(
      { error: "This game night has ended" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Add at least one email" }, { status: 400 });
  }
  const emailsRaw =
    body && typeof body === "object" && "emails" in body
      ? (body as { emails: unknown }).emails
      : undefined;
  const parsed = parseInviteEmails(emailsRaw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await sendGameNightInvites({
    emails: parsed.emails,
    hostEmail: tournament.host.email,
    hostDisplayName: tournament.host.displayName,
    nightName: tournament.name,
    joinCode: tournament.inviteCode,
    buyInCents: tournament.buyInCents,
    ip: requestIp(req),
  });

  return NextResponse.json({
    ok: true,
    results: result.results,
    previewHtml: result.previewHtml,
    joinUrl: result.joinUrl,
  });
}
