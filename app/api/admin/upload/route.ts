import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File harus gambar." }, { status: 400 });

  const ext = file.name.split(".").pop() || "jpg";
  const rawFolder = form.get("folder");
  const folder = typeof rawFolder === "string" ? rawFolder.replace(/[^a-z0-9-_]/gi, "") || "menu" : "menu";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const supabase = getSupabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from("menu-images").upload(path, buffer, {
    contentType: file.type,
    upsert: false
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
