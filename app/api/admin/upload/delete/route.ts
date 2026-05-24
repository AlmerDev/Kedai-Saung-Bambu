import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, unauthorized } from "@/lib/session";
import { getStoragePathFromUrl, MENU_IMAGES_BUCKET } from "@/lib/storage";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const path = getStoragePathFromUrl(body.path || body.url);

  if (!path) {
    return NextResponse.json({ deleted: false, skipped: true, message: "URL bukan file Supabase Storage, jadi hanya bisa dihapus dari data/form." });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(MENU_IMAGES_BUCKET).remove([path]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true, path });
}
