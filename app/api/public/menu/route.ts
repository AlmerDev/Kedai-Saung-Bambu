import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const [settings, categories, products, tables] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", 1).single(),
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order", { ascending: true }).order("name"),
    supabase.from("products").select("*, category:categories(*)").eq("is_available", true).order("sort_order", { ascending: true }).order("name"),
    supabase.from("dining_tables").select("*").eq("is_active", true).order("table_number", { ascending: true })
  ]);

  if (settings.error && settings.error.code !== "PGRST116") return NextResponse.json({ error: settings.error.message }, { status: 500 });
  if (categories.error) return NextResponse.json({ error: categories.error.message }, { status: 500 });
  if (products.error) return NextResponse.json({ error: products.error.message }, { status: 500 });
  if (tables.error) return NextResponse.json({ error: tables.error.message }, { status: 500 });

  return NextResponse.json({
    settings: settings.data,
    categories: categories.data || [],
    products: products.data || [],
    tables: tables.data || []
  });
}
