import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: isAdminRequest(request) });
}
