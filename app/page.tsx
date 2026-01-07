"use client";

import React from "react";
import { useMemo, useState } from "react";

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

function formatRating(r: number | null, n: number | null) {
  if (r == null) return "No rating";
  if (n == null) return `★ ${r.toFixed(1)}`;
  return `★ ${r.toFixed(1)} (${n.toLocaleString()})`;
}

function priceLabel(level: number | null) {
  if (level == null) return "Price ?";
  return "$".repeat(Math.max(1, Math.min(4, level + 1)));
}

function mapsLink(c: Cafe) {
  // Uses query + coordinates to open reliably
  const q = encodeURIComponent(c.name);
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(
    c.place_id
  )}`;
}

function pillStyle(kind: "ok" | "warn" | "neutral") {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.03)",
  };
  if (kind === "ok") return { ...base, background: "rgba(0, 128, 0, 0.08)" };
  if (kind === "warn") return { ...base, background: "rgba(255, 165, 0, 0.10)" };
  return base;
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CafesResponse | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [checkingIn, setCheckingIn] = useState<Set<string>>(new Set());

  const [radiusM, setRadiusM] = useState(1500);
  const [sort, setSort] = useState<"rating" | "name">("rating");

  const cafes = useMemo(() => {
    const list = data?.cafes ?? [];
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));

    // rating sort (desc), then ratings count
    return [...list].sort((a, b) => {
      const ar = a.google_rating ?? -1;
      const br = b.google_rating ?? -1;
      if (br !== ar) return br - ar;
      const an = a.user_ratings_total ?? -1;
      const bn = b.user_ratings_total ?? -1;
      return bn - an;
    });
  }, [data, sort]);

  async function findCafesNearMe() {
    setError(null);
    setLoading(true);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
        });
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setCoords({ lat, lng });

      const res = await fetch(
        `/api/cafes?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=${radiusM}`,
        { cache: "no-store" }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);

      setData(json as CafesResponse);
    } catch (e: any) {
      // Better geolocation messaging
      if (e?.code === 1) {
        setError("Location permission denied. Please allow location access and try again.");
      } else if (e?.code === 3) {
        setError("Location request timed out. Try again or move to a better signal area.");
      } else {
        setError(e?.message ?? "Something went wrong.");
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn(cafeId: string) {
    setCheckingIn((prev) => new Set(prev).add(cafeId));

    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cafeId }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error ?? `Check-in failed (${res.status})`);
      }

      // Success! You could show a toast notification here
      alert(`Checked in successfully!`);
    } catch (e: any) {
      const msg =
        e?.message ||
        (typeof e === "string" ? e : "Something went wrong checking in.");
      alert(`Error: ${msg}`);
    } finally {
      setCheckingIn((prev) => {
        const next = new Set(prev);
        next.delete(cafeId);
        return next;
      });
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 16px",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(0,0,0,0.06), transparent 60%), radial-gradient(900px 500px at 80% 10%, rgba(0,0,0,0.05), transparent 60%)",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          background: "rgba(255,255,255,0.75)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 18,
          padding: 20,
          backdropFilter: "blur(10px)",
          boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
        }}
      >
        <header style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(0,0,0,0.06)",
              display: "grid",
              placeItems: "center",
              fontSize: 20,
            }}
            aria-hidden
          >
            ☕
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 26, margin: 0, letterSpacing: -0.3 }}>
              Quiet Café Finder
            </h1>
            <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
              Find nearby cafés using your backend. Cached results make it fast and cheap.
            </p>
          </div>

          {data && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span style={pillStyle(data.source === "cache" ? "ok" : "warn")}>
                {data.source === "cache" ? "Cached" : "Google"}
              </span>
              <span style={pillStyle("neutral")}>{data.radiusM}m</span>
            </div>
          )}
        </header>

        <section
          style={{
            marginTop: 16,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, opacity: 0.8 }}>Radius</span>
            <select
              value={radiusM}
              onChange={(e) => setRadiusM(Number(e.target.value))}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
              }}
            >
              <option value={800}>800m</option>
              <option value={1200}>1200m</option>
              <option value={1500}>1500m</option>
              <option value={2000}>2000m</option>
              <option value={3000}>3000m</option>
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, opacity: 0.8 }}>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
              }}
            >
              <option value="rating">Rating</option>
              <option value="name">Name</option>
            </select>
          </label>

          <button
            onClick={findCafesNearMe}
            disabled={loading}
            style={{
              marginLeft: "auto",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.2)",
              background: loading ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.9)",
              color: loading ? "rgba(0,0,0,0.6)" : "white",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Searching…" : "Find cafés near me"}
          </button>
        </section>

        {coords && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Using location: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            {data?.cacheKey ? <> · cache key: {data.cacheKey}</> : null}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(220, 20, 60, 0.25)",
              background: "rgba(220, 20, 60, 0.06)",
              color: "crimson",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        <section style={{ marginTop: 18 }}>
          {data && (
            <div style={{ marginBottom: 10, opacity: 0.75, fontSize: 13 }}>
              Showing <strong>{cafes.length}</strong> cafés
            </div>
          )}

          {!data ? (
            <div
              style={{
                padding: 18,
                borderRadius: 14,
                border: "1px dashed rgba(0,0,0,0.18)",
                background: "rgba(255,255,255,0.6)",
                opacity: 0.8,
              }}
            >
              Click <strong>Find cafés near me</strong> to load results.
            </div>
          ) : cafes.length === 0 ? (
            <div
              style={{
                padding: 18,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "rgba(255,255,255,0.7)",
              }}
            >
              No cafés found in this radius.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              {cafes.map((c) => (
                <article
                  key={c.place_id}
                  style={{
                    borderRadius: 16,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "rgba(255,255,255,0.8)",
                    padding: 14,
                    boxShadow: "0 10px 22px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, letterSpacing: -0.2 }}>{c.name}</div>
                      <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
                        {c.address ?? "No address"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 12, opacity: 0.85 }}>
                      <div>{formatRating(c.google_rating, c.user_ratings_total)}</div>
                      <div style={{ marginTop: 2 }}>{priceLabel(c.price_level)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                    <a
                      href={mapsLink(c)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 13,
                        textDecoration: "none",
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: "rgba(0,0,0,0.03)",
                        color: "rgba(0,0,0,0.85)",
                      }}
                    >
                      Open in Maps ↗
                    </a>

                    <button
                      onClick={() => handleCheckIn(c.id)}
                      disabled={checkingIn.has(c.id)}
                      style={{
                        fontSize: 13,
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: checkingIn.has(c.id)
                          ? "rgba(0,0,0,0.06)"
                          : "rgba(0, 128, 0, 0.1)",
                        color: checkingIn.has(c.id) ? "rgba(0,0,0,0.5)" : "rgba(0, 128, 0, 0.9)",
                        cursor: checkingIn.has(c.id) ? "not-allowed" : "pointer",
                        fontWeight: 500,
                      }}
                    >
                      {checkingIn.has(c.id) ? "Checking in..." : "✓ Check in"}
                    </button>

                    <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.65 }}>
                      {c.types?.includes("cafe") ? "cafe" : ""}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer style={{ maxWidth: 900, margin: "12px auto 0", padding: "0 6px", opacity: 0.6, fontSize: 12 }}>
        Tip: once we add check-ins, we’ll show “quiet score” + confidence next to each café.
      </footer>
    </main>
  );
}
