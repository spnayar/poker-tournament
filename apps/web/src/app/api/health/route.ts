import { NextResponse } from "next/server";

/** Safe deploy check — booleans only, never exposes secret values. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      NEXTAUTH_SECRET: Boolean(
        process.env["NEXTAUTH_SECRET"] ?? process.env["AUTH_SECRET"]
      ),
      NEXTAUTH_URL: Boolean(process.env["NEXTAUTH_URL"]),
      DATABASE_URL: Boolean(process.env["DATABASE_URL"]),
      JWT_SECRET: Boolean(process.env["JWT_SECRET"]),
    },
  });
}
