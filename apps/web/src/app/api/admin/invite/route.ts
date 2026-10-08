import { NextResponse } from "next/server";
import { inviteUserFromAdmin, parseAdminInviteEmail } from "@/lib/adminInvite";
import { requireAdminApi } from "@/lib/requireAdmin";
import { requestIp } from "@/lib/requestIp";

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const parsed = parseAdminInviteEmail(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await inviteUserFromAdmin({
      email: parsed.email,
      ip: requestIp(req),
    });
    if (result.status === "rate_limited") {
      return NextResponse.json(
        { error: "Too many invites right now. Try again in a few minutes." },
        { status: 429 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/admin/invite failed:", err);
    return NextResponse.json(
      { error: "Could not send invite" },
      { status: 500 }
    );
  }
}
