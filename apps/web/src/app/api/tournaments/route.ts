import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";
import { generateUniqueJoinCode } from "@/lib/joinCode";
import {
  defaultTournamentName,
  defaultPayoutPercents,
  parsePayoutPercents,
  validatePayoutPercents,
} from "@/lib/tournament";
import {
  listPastPlayers,
  parseInvitePeople,
  sendGameNightInvites,
} from "@/lib/gameNightInvite";
import { requestIp } from "@/lib/requestIp";
import { resolveZoomCreateAttach } from "@/lib/zoomJoinUrl";
import {
  BlindPaceSchema,
  BLIND_LEVEL_MINUTE_OPTIONS,
  buildBlindLevels,
  resolveActionTimerSeconds,
} from "@poker/protocol";
import { loadPlayerDashboardStats } from "@/lib/loadPlayerDashboardStats";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [user, stats, tournaments, lastHosted, playStats] =
      await Promise.all([
        prisma.user.findUnique({ where: { id: session.user.id } }),
        prisma.userStats.findUnique({ where: { userId: session.user.id } }),
        prisma.tournament.findMany({
          where: {
            OR: [
              { hostUserId: session.user.id },
              { players: { some: { userId: session.user.id } } },
            ],
          },
          include: {
            host: { select: { displayName: true } },
            players: {
              include: {
                user: { select: { displayName: true, avatarUrl: true } },
              },
            },
            games: {
              where: { status: "FINISHED" },
              select: { id: true },
            },
            _count: { select: { players: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.tournament.findFirst({
          where: { hostUserId: session.user.id },
          orderBy: { createdAt: "desc" },
          select: {
            buyInCents: true,
            startingChips: true,
            maxPlayers: true,
            blindPace: true,
            blindPreset: true,
            blindLevelMinutes: true,
            actionTimerSeconds: true,
            payoutPercents: true,
            zoomJoinUrl: true,
            zoomPasscodePlain: true,
          },
        }),
        loadPlayerDashboardStats(session.user.id),
      ]);

    const lastHostedDefaults = lastHosted
      ? {
          ...lastHosted,
          payoutPercents: lastHosted.payoutPercents as number[],
        }
      : null;

    const pastPlayers = await listPastPlayers({ userId: session.user.id });

    return NextResponse.json({
      user,
      stats,
      playStats,
      tournaments,
      lastHostedDefaults,
      pastPlayers,
    });
  } catch (err) {
    console.error("GET /api/tournaments failed:", err);
    return NextResponse.json(
      { error: "Failed to load game nights" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    name,
    buyInCents = 2000,
    startingChips = 5000,
    maxPlayers = 9,
    blindPace = "gradual",
    blindLevelMinutes = 12,
    actionTimerSeconds = 60,
    payoutPercents: rawPayouts,
    zoomJoinUrl,
    zoomPasscodePlain,
    invites: rawInvites,
  } = body;

  let invitePeople: { email: string; displayName?: string | null }[] = [];
  if (rawInvites != null) {
    const parsed = parseInvitePeople(rawInvites);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    invitePeople = parsed.people;
  }

  const paceResult = BlindPaceSchema.safeParse(blindPace);
  const resolvedPace = paceResult.success ? paceResult.data : "gradual";
  const resolvedMinutes = BLIND_LEVEL_MINUTE_OPTIONS.includes(blindLevelMinutes)
    ? blindLevelMinutes
    : 12;
  const resolvedActionTimerSeconds =
    resolveActionTimerSeconds(actionTimerSeconds);
  const blindLevels = buildBlindLevels(startingChips, resolvedPace);

  if (Array.isArray(rawPayouts)) {
    const payoutError = validatePayoutPercents(rawPayouts);
    if (payoutError) {
      return NextResponse.json({ error: payoutError }, { status: 400 });
    }
  }

  const payoutPercents = parsePayoutPercents(
    Array.isArray(rawPayouts) ? rawPayouts : defaultPayoutPercents()
  )!;

  const zoomAttach = resolveZoomCreateAttach({
    zoomJoinUrl:
      typeof zoomJoinUrl === "string" ? zoomJoinUrl : null,
    zoomPasscodePlain:
      typeof zoomPasscodePlain === "string" ? zoomPasscodePlain : null,
  });
  if (!zoomAttach.ok) {
    return NextResponse.json({ error: zoomAttach.error }, { status: 400 });
  }

  try {
    const joinCode = await generateUniqueJoinCode(async (code) => {
      const existing = await prisma.tournament.findUnique({
        where: { inviteCode: code },
      });
      return !!existing;
    });

    const tournament = await prisma.tournament.create({
      data: {
        name: name?.trim() || defaultTournamentName(),
        hostUserId: session.user.id,
        buyInCents,
        startingChips,
        maxPlayers,
        blindPreset: resolvedPace,
        blindPace: resolvedPace,
        blindLevelMinutes: resolvedMinutes,
        actionTimerSeconds: resolvedActionTimerSeconds,
        blindLevels,
        payoutPercents,
        inviteCode: joinCode,
        ...(zoomAttach.attach
          ? {
              videoMode: zoomAttach.attach.videoMode,
              zoomJoinUrl: zoomAttach.attach.zoomJoinUrl,
              zoomMeetingNumber: zoomAttach.attach.zoomMeetingNumber,
              zoomPwdQuery: zoomAttach.attach.zoomPwdQuery,
              zoomPasscodePlain: zoomAttach.attach.zoomPasscodePlain,
              videoEnabledAt: zoomAttach.attach.videoEnabledAt,
            }
          : {}),
        players: {
          create: {
            userId: session.user.id,
          },
        },
      },
      include: {
        players: { include: { user: true } },
        host: { select: { displayName: true, email: true } },
      },
    });

    let inviteResults = null;
    if (invitePeople.length > 0) {
      const sent = await sendGameNightInvites({
        people: invitePeople,
        hostEmail: tournament.host.email,
        hostDisplayName: tournament.host.displayName,
        nightName: tournament.name,
        joinCode: tournament.inviteCode,
        buyInCents: tournament.buyInCents,
        ip: requestIp(req),
        zoomJoinUrl: tournament.zoomJoinUrl,
      });
      inviteResults = {
        results: sent.results,
        previewHtml: sent.previewHtml,
        joinUrl: sent.joinUrl,
      };
    }

    return NextResponse.json({ ...tournament, inviteResults });
  } catch (err) {
    console.error("POST /api/tournaments failed:", err);
    return NextResponse.json(
      { error: "Failed to create game night" },
      { status: 500 }
    );
  }
}
