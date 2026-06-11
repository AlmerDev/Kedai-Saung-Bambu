import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, unauthorized } from "@/lib/session";
import { slugify } from "@/lib/format";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const { data, error } = await getSupabaseAdmin()
    .from("products")
    .select("*, category:categories(*)")
    .order("sort_order", { ascending: true })
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data || [] });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const body = await request.json();
  const name = String(body.name || "").trim();
  const price = Number(body.price || 0);
  const stock = Math.max(0, Number(body.stock || 0));
  if (!name) return NextResponse.json({ error: "Nama menu wajib diisi." }, { status: 400 });
  if (price < 0) return NextResponse.json({ error: "Harga tidak valid." }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from("products")
    .insert({
      category_id: body.category_id || null,
      name,
      slug: slugify(body.slug || name),
      description: body.description || null,
      price,
      stock,
      image_url: body.image_url || null,
      badge: body.badge || null,
      is_available: body.is_available ?? true,
      sort_order: Number(body.sort_order || 0)
    })
    .select("*, category:categories(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data }, { status: 201 });
}
