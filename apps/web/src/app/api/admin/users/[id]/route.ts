import { NextResponse } from "next/server";
import { prisma } from "@poker/db";
import { deletePlayerAccount } from "@/lib/adminAccounts";
import { parseAccountStatus } from "@/lib/adminAccess";
import { requireAdminApi } from "@/lib/requireAdmin";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const raw =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).accountStatus
      : undefined;
  const accountStatus = parseAccountStatus(raw);
  if (!accountStatus) {
    return NextResponse.json(
      { error: "Status must be free or paid" },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { accountStatus },
      select: { id: true, accountStatus: true },
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const result = await deletePlayerAccount({
    actorId: gate.admin.id,
    targetId: id,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: result.status }
    );
  }
  return NextResponse.json({ ok: true });
}
