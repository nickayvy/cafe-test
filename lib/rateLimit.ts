import crypto from "crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase/server";

function getClientIp(req: NextRequest): string {
  // Vercel commonly provides x-forwarded-for: "client, proxy1, proxy2"
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();

  // Fallbacks sometimes present:
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "0.0.0.0";
}

function sha256Base64Url(input: string): string {
  return crypto.createHash("sha256").update(input).digest("base64url");
}

export async function enforceRateLimit(opts: {
  req: NextRequest;
  route: string; // e.g. "GET /api/cafes"
  limit: number; // e.g. 30
  windowSeconds: number; // e.g. 60
}) {
  const ip = getClientIp(opts.req);
  const ipHash = sha256Base64Url(ip);

  const supabase = supabaseAdmin();

  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_route: opts.route,
    p_ip_hash: ipHash,
    p_window_seconds: opts.windowSeconds,
    p_limit: opts.limit,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? (data[0] as any) : (data as any); // supabase sometimes returns array

  return {
    allowed: Boolean(row?.allowed),
    used: Number(row?.used ?? 0),
    limit: Number(row?.limit ?? opts.limit),
    resetAt: row?.reset_at
      ? new Date(row.reset_at)
      : new Date(Date.now() + opts.windowSeconds * 1000),
  };
}


