import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const supabase = supabaseAdmin();

    // Simple, safe query – adjust table name if needed
    const { error } = await supabase.from("cafes").select("*").limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, where: "supabase", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, where: "function", message: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}


