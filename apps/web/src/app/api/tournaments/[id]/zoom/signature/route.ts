import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";
import {
  readZoomMeetingSdkCredentials,
  signZoomMeetingSdkJwt,
} from "@/lib/zoomMeetingSdkJwt";

/**
 * Issues a short-lived Meeting SDK JWT for same-meeting video mirror.
 * Secrets stay server-side. Client must join with in-app audio disabled.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const creds = readZoomMeetingSdkCredentials();
  if (!creds) {
    return NextResponse.json(
      {
        error:
          "Meeting SDK is not configured. Set ZOOM_MEETING_SDK_CLIENT_ID and ZOOM_MEETING_SDK_CLIENT_SECRET on the web service.",
        code: "ZOOM_SDK_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      players: {
        where: { userId: session.user.id },
        select: { userId: true },
      },
      host: { select: { id: true, displayName: true } },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isHost = tournament.hostUserId === session.user.id;
  const isMember = tournament.players.length > 0;
  if (!isHost && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!tournament.zoomMeetingNumber) {
    return NextResponse.json(
      { error: "This night has no Zoom meeting number yet", code: "ZOOM_NOT_LINKED" },
      { status: 400 }
    );
  }

  const password = tournament.zoomPasscodePlain?.trim() ?? "";
  if (!password) {
    return NextResponse.json(
      {
        error:
          "Host must save the plain Zoom passcode for in-app faces (the link’s pwd= token is encrypted and is not the SDK password).",
        code: "ZOOM_PASSCODE_REQUIRED",
      },
      { status: 400 }
    );
  }

  const userName =
    session.user.name?.trim() ||
    (isHost ? tournament.host.displayName : "Player");

  const signature = signZoomMeetingSdkJwt({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    meetingNumber: tournament.zoomMeetingNumber,
    role: 0,
  });

  return NextResponse.json({
    signature,
    meetingNumber: tournament.zoomMeetingNumber,
    password,
    userName,
    /** Client must keep SDK audio off — Zoom app owns the call. */
    audioPolicy: "mirror_video_only",
  });
}
