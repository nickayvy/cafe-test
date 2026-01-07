import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase/server"; 
import { searchNearbyPlaces } from "../../../lib/google/places";

function toNumber(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundCoord(n: number, precision: number) {
  const f = Math.pow(10, precision);
  return Math.round(n * f) / f;
}

function cacheKey(lat: number, lng: number, radiusM: number, precision: number) {
  const rLat = roundCoord(lat, precision);
  const rLng = roundCoord(lng, precision);
  return `nearby:${rLat}:${rLng}:r=${radiusM}`;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const lat = toNumber(url.searchParams.get("lat"));
    const lng = toNumber(url.searchParams.get("lng"));
    const radius = toNumber(url.searchParams.get("radius"));

    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "Missing/invalid lat or lng" },
        { status: 400 }
      );
    }

    const radiusM = clamp(radius ?? 1500, 200, 5000);

    const precision = clamp(
      Number(process.env.PLACES_QUERY_LATLNG_PRECISION ?? 3),
      2,
      5
    );

    const ttlSeconds = clamp(
      Number(process.env.PLACES_CACHE_TTL_SECONDS ?? 900),
      60,
      86400
    );

    const key = cacheKey(lat, lng, radiusM, precision);
    const supabase = supabaseAdmin();

    // 1) Cache lookup
    const { data: cacheRow, error: cacheErr } = await supabase
      .from("places_cache")
      .select("cache_key, place_ids, expires_at")
      .eq("cache_key", key)
      .maybeSingle();

    if (cacheErr) throw cacheErr;

    const now = new Date();
    if (cacheRow && new Date(cacheRow.expires_at) > now && cacheRow.place_ids?.length) {
      // Fetch cafe rows by place_id (and join stats if you want)
      const { data: cafes, error: cafesErr } = await supabase
        .from("cafes")
        .select("id, place_id, name, address, lat, lng, google_rating, user_ratings_total, price_level, types")
        .in("place_id", cacheRow.place_ids);

      if (cafesErr) throw cafesErr;

      return NextResponse.json({
        source: "cache",
        cacheKey: key,
        radiusM,
        cafes: cafes ?? [],
      });
    }

    // 2) Cache miss → call Google Places
    const places = await searchNearbyPlaces({ lat, lng, radiusM });

    // Normalize and upsert into cafes
    const cafesToUpsert = places
      .map((p) => {
        const loc = p.location;
        if (!p.id || !loc) return null;

        // priceLevel from v1 might be strings (PRICE_LEVEL_*). Keep as text/int later if desired.
        const priceLevelInt =
          p.priceLevel?.includes("FREE") ? 0 :
          p.priceLevel?.includes("INEXPENSIVE") ? 1 :
          p.priceLevel?.includes("MODERATE") ? 2 :
          p.priceLevel?.includes("EXPENSIVE") ? 3 :
          p.priceLevel?.includes("VERY_EXPENSIVE") ? 4 :
          null;

        return {
          place_id: p.id,
          name: p.displayName?.text ?? "Unknown",
          address: p.formattedAddress ?? null,
          lat: loc.latitude,
          lng: loc.longitude,
          google_rating: p.rating ?? null,
          user_ratings_total: p.userRatingCount ?? null,
          price_level: priceLevelInt,
          types: p.types ?? null,
          last_fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean) as any[];

    if (cafesToUpsert.length) {
      const { error: upsertErr } = await supabase
        .from("cafes")
        .upsert(cafesToUpsert, { onConflict: "place_id" });

      if (upsertErr) throw upsertErr;
    }

    const placeIds = cafesToUpsert.map((c) => c.place_id);

    // Upsert cache row
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const { error: cacheUpsertErr } = await supabase
      .from("places_cache")
      .upsert(
        {
          cache_key: key,
          lat_center: roundCoord(lat, precision),
          lng_center: roundCoord(lng, precision),
          radius_m: radiusM,
          place_ids: placeIds,
          fetched_at: new Date().toISOString(),
          expires_at: expiresAt,
          // raw: { places }, // optionally store raw; can get big
        },
        { onConflict: "cache_key" }
      );

    if (cacheUpsertErr) throw cacheUpsertErr;

    // Return cafes from DB (ensures consistent fields)
    const { data: cafes, error: cafesErr } = await supabase
      .from("cafes")
      .select("id, place_id, name, address, lat, lng, google_rating, user_ratings_total, price_level, types")
      .in("place_id", placeIds);

    if (cafesErr) throw cafesErr;

    return NextResponse.json({
      source: "google",
      cacheKey: key,
      radiusM,
      cafes: cafes ?? [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
