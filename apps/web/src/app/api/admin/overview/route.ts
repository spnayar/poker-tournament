import { NextRequest, NextResponse } from "next/server";
import { listAdminAccounts } from "@/lib/adminAccounts";
import { loadSiteUsage, parseUsageRangeId } from "@/lib/adminUsage";
import { requireAdminApi } from "@/lib/requireAdmin";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;

  const range = parseUsageRangeId(req.nextUrl.searchParams.get("range"));

  const [users, usage] = await Promise.all([
    listAdminAccounts(gate.admin.id),
    loadSiteUsage(new Date(), range),
  ]);

  return NextResponse.json({ users, usage });
}
