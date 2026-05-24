import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, unauthorized } from "@/lib/session";
import { slugify } from "@/lib/format";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("categories").select("*").order("sort_order", { ascending: true }).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data || [] });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nama kategori wajib diisi." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name,
      slug: slugify(body.slug || name),
      emoji: body.emoji || "🍽️",
      sort_order: Number(body.sort_order || 0),
      is_active: body.is_active ?? true
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data }, { status: 201 });
}
