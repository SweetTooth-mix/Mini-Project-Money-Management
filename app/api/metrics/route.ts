import { timingSafeEqual } from "node:crypto";
import { metrics } from "@/lib/metrics";

// Prometheus scrape target.
//
// Metrics describe traffic patterns, so the endpoint is not public: without
// METRICS_TOKEN it answers 404 as though it did not exist, and with a token it
// requires that token as a bearer credential.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(header: string | null, token: string): boolean {
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  // timingSafeEqual throws on length mismatch, and the length is not a secret.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const token = process.env.METRICS_TOKEN;
  if (!token) return new Response("Not found", { status: 404 });

  if (!authorized(request.headers.get("authorization"), token))
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="metrics"' },
    });

  return new Response(metrics.render(), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
