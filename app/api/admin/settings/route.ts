import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const { data, error } = await getSupabaseAdmin().from("store_settings").select("*").eq("id", 1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const body = await request.json();
  const payload = {
    store_name: body.store_name || "KEDAI SAUNG BAMBU",
    tagline: body.tagline || null,
    address: body.address || null,
    whatsapp: body.whatsapp || null,
    service_fee_percent: Number(body.service_fee_percent || 0),
    opening_hours: body.opening_hours || null,
    logo_url: body.logo_url || null,
    hero_image_url: body.hero_image_url || null
  };

  const { data, error } = await getSupabaseAdmin().from("store_settings").upsert({ id: 1, ...payload }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
