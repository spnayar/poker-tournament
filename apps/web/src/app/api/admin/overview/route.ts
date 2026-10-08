import { NextResponse } from "next/server";
import { listAdminAccounts } from "@/lib/adminAccounts";
import { loadSiteUsage } from "@/lib/adminUsage";
import { requireAdminApi } from "@/lib/requireAdmin";

export async function GET() {
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;

  const [users, usage] = await Promise.all([
    listAdminAccounts(gate.admin.id),
    loadSiteUsage(),
  ]);

  return NextResponse.json({ users, usage });
}
