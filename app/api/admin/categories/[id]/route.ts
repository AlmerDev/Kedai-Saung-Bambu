import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, unauthorized } from "@/lib/session";
import { slugify } from "@/lib/format";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await context.params;
  const body = await request.json();
  const payload: Record<string, unknown> = {};
  if (body.name !== undefined) payload.name = String(body.name).trim();
  if (body.slug !== undefined || body.name !== undefined) payload.slug = slugify(body.slug || body.name);
  if (body.emoji !== undefined) payload.emoji = body.emoji || "🍽️";
  if (body.sort_order !== undefined) payload.sort_order = Number(body.sort_order || 0);
  if (body.is_active !== undefined) payload.is_active = Boolean(body.is_active);

  const { data, error } = await getSupabaseAdmin().from("categories").update(payload).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await context.params;
  const { error } = await getSupabaseAdmin().from("categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
