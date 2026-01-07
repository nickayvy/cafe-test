"use client";
import React from "react";
import { useState } from "react";

type Cafe = {
  id: string;
  place_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  google_rating: number | null;
  user_ratings_total: number | null;
  price_level: number | null;
  types: string[] | null;
};

type CafesResponse = {
  source: "google" | "cache";
  cacheKey: string;
  radiusM: number;
  cafes: Cafe[];
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CafesResponse | null>(null);

  async function findCafesNearMe() {
    setError(null);
    setLoading(true);
    setData(null);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const radius = 1500;

      const res = await fetch(
        `/api/cafes?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=${radius}`,
        { cache: "no-store" }
      );

      const json = (await res.json()) as any;

      if (!res.ok) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }

      setData(json as CafesResponse);
    } catch (e: any) {
      const msg =
        e?.message ||
        (typeof e === "string" ? e : "Something went wrong getting cafes.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Quiet Café Finder</h1>
      <p style={{ marginTop: 0, marginBottom: 16, opacity: 0.8 }}>
        Click the button to find cafes near you (powered by your /api/cafes).
      </p>

      <button
        onClick={findCafesNearMe}
        disabled={loading}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #333",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Searching…" : "Find cafes near me"}
      </button>

      {error && (
        <div style={{ marginTop: 16, color: "crimson" }}>
          <strong>Error:</strong> {error}
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Tip: allow location permissions in your browser.
          </div>
        </div>
      )}

      {data && (
        <div style={{ marginTop: 18 }}>
          <div style={{ marginBottom: 10, opacity: 0.85 }}>
            <strong>Source:</strong> {data.source} · <strong>Radius:</strong>{" "}
            {data.radiusM}m · <strong>Cache key:</strong> {data.cacheKey}
          </div>

          {data.cafes.length === 0 ? (
            <div>No cafes found in this radius.</div>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {data.cafes.map((c) => (
                <li key={c.place_id} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ opacity: 0.8 }}>
                    {c.address ?? "No address"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {c.google_rating != null
                      ? `Rating ${c.google_rating}${
                          c.user_ratings_total != null
                            ? ` (${c.user_ratings_total})`
                            : ""
                        }`
                      : "No rating"}{" "}
                    · {c.price_level != null ? `Price ${c.price_level}` : "Price ?"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}

