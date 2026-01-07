import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase/server";
import { enforceRateLimit } from "../../../lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 requests/minute per IP
    const rl = await enforceRateLimit({
      req,
      route: "POST /api/checkins",
      limit: 10,
      windowSeconds: 60,
    });

    if (!rl.allowed) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)
      );

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          used: rl.used,
          limit: rl.limit,
          resetAt: rl.resetAt.toISOString(),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const body = await req.json();
    const cafeId = body.cafeId;

    if (!cafeId || typeof cafeId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid cafeId" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // Verify cafe exists
    const { data: cafe, error: cafeErr } = await supabase
      .from("cafes")
      .select("id")
      .eq("id", cafeId)
      .maybeSingle();

    if (cafeErr) throw cafeErr;
    if (!cafe) {
      return NextResponse.json(
        { error: "Cafe not found" },
        { status: 404 }
      );
    }

    // Insert check-in
    const { data: checkIn, error: checkInErr } = await supabase
      .from("checkins")
      .insert({
        cafe_id: cafeId,
        created_at: new Date().toISOString(),
      })
      .select("id, cafe_id, created_at")
      .single();

    if (checkInErr) throw checkInErr;

    return NextResponse.json({
      success: true,
      checkIn,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

