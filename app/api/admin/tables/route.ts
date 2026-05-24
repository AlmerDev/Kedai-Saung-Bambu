import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const { data, error } = await getSupabaseAdmin().from("dining_tables").select("*").order("table_number", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tables: data || [] });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const body = await request.json();
  const table_number = String(body.table_number || "").trim();
  if (!table_number) return NextResponse.json({ error: "Nomor meja wajib diisi." }, { status: 400 });
  const { data, error } = await getSupabaseAdmin()
    .from("dining_tables")
    .insert({ table_number, label: body.label || `Meja ${table_number}`, is_active: body.is_active ?? true })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data }, { status: 201 });
}
