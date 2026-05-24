import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await context.params;
  const body = await request.json();
  const payload: Record<string, unknown> = {};
  if (body.table_number !== undefined) payload.table_number = String(body.table_number).trim();
  if (body.label !== undefined) payload.label = body.label || null;
  if (body.is_active !== undefined) payload.is_active = Boolean(body.is_active);
  const { data, error } = await getSupabaseAdmin().from("dining_tables").update(payload).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await context.params;
  const { error } = await getSupabaseAdmin().from("dining_tables").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
