import { NextResponse } from "next/server";
import {
  listLegacyPasswordEraCandidates,
  purgeLegacyPasswordEraAccounts,
} from "@/lib/adminAccounts";
import { requireAdminApi } from "@/lib/requireAdmin";

/** Dry-run: count and list password-era accounts that would be purged. */
export async function GET() {
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;

  const preview = await listLegacyPasswordEraCandidates();
  return NextResponse.json(preview);
}

/** Execute purge after the admin types the confirm phrase. */
export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const confirm =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).confirm
      : undefined;
  if (typeof confirm !== "string") {
    return NextResponse.json(
      { error: "Confirm phrase is required" },
      { status: 400 }
    );
  }

  const result = await purgeLegacyPasswordEraAccounts({
    actorId: gate.admin.id,
    confirm,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: result.status }
    );
  }
  return NextResponse.json({
    ok: true,
    deleted: result.deleted,
    emails: result.emails,
  });
}
