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

  if (body.category_id !== undefined) payload.category_id = body.category_id || null;
  if (body.name !== undefined) payload.name = String(body.name).trim();
  if (body.slug !== undefined || body.name !== undefined) payload.slug = slugify(body.slug || body.name);
  if (body.description !== undefined) payload.description = body.description || null;
  if (body.price !== undefined) payload.price = Number(body.price || 0);
  if (body.image_url !== undefined) payload.image_url = body.image_url || null;
  if (body.badge !== undefined) payload.badge = body.badge || null;
  if (body.is_available !== undefined) payload.is_available = Boolean(body.is_available);
  if (body.sort_order !== undefined) payload.sort_order = Number(body.sort_order || 0);

  const { data, error } = await getSupabaseAdmin().from("products").update(payload).eq("id", id).select("*, category:categories(*)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await context.params;
  const { error } = await getSupabaseAdmin().from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
