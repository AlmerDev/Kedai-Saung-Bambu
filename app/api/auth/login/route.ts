import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, setAdminCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { password } = await request.json().catch(() => ({ password: "" }));
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: "Password admin salah." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setAdminCookie(response, createAdminSession());
  return response;
}
