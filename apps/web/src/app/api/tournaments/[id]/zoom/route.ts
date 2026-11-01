import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";
import {
  normalizeMeetingNumber,
  redactZoomUrlForLog,
  resolveZoomLinkFields,
} from "@/lib/zoomJoinUrl";
import { zoomMirrorConfigured } from "@/lib/zoomMeetingSdkJwt";

type ZoomPublic = {
  videoMode: string;
  zoomJoinUrl: string | null;
  zoomMeetingNumber: string | null;
  /** True when URL had a pwd query — never echo the token to clients that only need status. */
  hasPwdQuery: boolean;
  /** True when host stored a plain passcode for Meeting SDK join. */
  hasPasscodePlain: boolean;
  videoEnabledAt: string | null;
  mirrorConfigured: boolean;
  canMirror: boolean;
};

function toPublic(row: {
  videoMode: string;
  zoomJoinUrl: string | null;
  zoomMeetingNumber: string | null;
  zoomPwdQuery: string | null;
  zoomPasscodePlain: string | null;
  videoEnabledAt: Date | null;
}): ZoomPublic {
  const mirrorConfigured = zoomMirrorConfigured();
  const hasMeeting = Boolean(row.zoomMeetingNumber);
  const hasSdkPassword = Boolean(row.zoomPasscodePlain?.trim());
  return {
    videoMode: row.videoMode,
    zoomJoinUrl: row.zoomJoinUrl,
    zoomMeetingNumber: row.zoomMeetingNumber,
    hasPwdQuery: Boolean(row.zoomPwdQuery),
    hasPasscodePlain: hasSdkPassword,
    videoEnabledAt: row.videoEnabledAt?.toISOString() ?? null,
    mirrorConfigured,
    canMirror: mirrorConfigured && hasMeeting && hasSdkPassword,
  };
}

async function loadMemberTournament(id: string, userId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { players: { select: { userId: true } } },
  });
  if (!tournament) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const isHost = tournament.hostUserId === userId;
  const isMember = tournament.players.some((p) => p.userId === userId);
  if (!isHost && !isMember) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { tournament, isHost };
}

/** Public Zoom status for members (no secrets / no pwd echo). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loaded = await loadMemberTournament(id, session.user.id);
  if ("error" in loaded) return loaded.error;

  return NextResponse.json({ zoom: toPublic(loaded.tournament) });
}

/**
 * Host sets / clears Zoom link + optional plain passcode for Meeting SDK mirror.
 * Phase 1 owns lobby paste UX; this API is the shared persistence contract.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loaded = await loadMemberTournament(id, session.user.id);
  if ("error" in loaded) return loaded.error;
  if (!loaded.isHost) {
    return NextResponse.json({ error: "Only the host can attach Zoom" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    clear?: boolean;
    zoomJoinUrl?: string | null;
    zoomPasscodePlain?: string | null;
    enableMirror?: boolean;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.clear === true) {
    const updated = await prisma.tournament.update({
      where: { id },
      data: {
        videoMode: "NONE",
        zoomJoinUrl: null,
        zoomMeetingNumber: null,
        zoomPwdQuery: null,
        zoomPasscodePlain: null,
        videoEnabledAt: null,
      },
    });
    return NextResponse.json({ zoom: toPublic(updated) });
  }

  const data: {
    videoMode?: "ZOOM_LINK" | "MEETING_SDK_MIRROR";
    zoomJoinUrl?: string | null;
    zoomMeetingNumber?: string | null;
    zoomPwdQuery?: string | null;
    zoomPasscodePlain?: string | null;
    videoEnabledAt?: Date | null;
  } = {};

  if (typeof body.zoomJoinUrl === "string" && body.zoomJoinUrl.trim()) {
    const resolved = resolveZoomLinkFields(body.zoomJoinUrl);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    data.zoomJoinUrl = resolved.fields.zoomJoinUrl;
    data.zoomMeetingNumber = resolved.fields.zoomMeetingNumber;
    data.zoomPwdQuery = resolved.fields.zoomPwdQuery;
    data.videoMode = "ZOOM_LINK";
    data.videoEnabledAt = new Date();
    if (process.env.NODE_ENV !== "production") {
      console.log("[zoom] Host set join link (redacted):", {
        tournamentId: id,
        url: redactZoomUrlForLog(data.zoomJoinUrl ?? ""),
        meetingNumber: data.zoomMeetingNumber ?? null,
      });
    }
  } else if (body.zoomJoinUrl === null) {
    data.zoomJoinUrl = null;
    data.zoomMeetingNumber = null;
    data.zoomPwdQuery = null;
  }

  if (typeof body.zoomPasscodePlain === "string") {
    const plain = body.zoomPasscodePlain.trim();
    data.zoomPasscodePlain = plain.length > 0 ? plain : null;
  } else if (body.zoomPasscodePlain === null) {
    data.zoomPasscodePlain = null;
  }

  if (body.enableMirror === true) {
    const meetingNumber =
      data.zoomMeetingNumber ??
      loaded.tournament.zoomMeetingNumber ??
      normalizeMeetingNumber(loaded.tournament.zoomJoinUrl);
    const passcode =
      data.zoomPasscodePlain !== undefined
        ? data.zoomPasscodePlain
        : loaded.tournament.zoomPasscodePlain;
    if (!meetingNumber || !passcode) {
      return NextResponse.json(
        {
          error:
            "Meeting SDK mirror needs a parsed meeting number and a plain passcode (URL pwd is not enough)",
        },
        { status: 400 }
      );
    }
    data.videoMode = "MEETING_SDK_MIRROR";
    if (!data.videoEnabledAt && !loaded.tournament.videoEnabledAt) {
      data.videoEnabledAt = new Date();
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // If only passcode was set and URL already linked, keep ZOOM_LINK unless mirror requested.
  if (
    data.videoMode === undefined &&
    loaded.tournament.videoMode === "NONE" &&
    (data.zoomJoinUrl || loaded.tournament.zoomJoinUrl)
  ) {
    data.videoMode = "ZOOM_LINK";
    data.videoEnabledAt = data.videoEnabledAt ?? new Date();
  }

  const updated = await prisma.tournament.update({
    where: { id },
    data,
  });

  return NextResponse.json({ zoom: toPublic(updated) });
}
