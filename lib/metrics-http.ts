import type { IncomingMessage, ServerResponse } from "node:http";
import { log } from "./log";
import { metrics, normalizeRoute } from "./metrics";

// Request timing for the whole application, not just the API routes.
//
// Next.js does not expose a "request finished" hook, so the Node HTTP server is
// instrumented: every request that reaches it is timed until the response is
// finished. The patch is idempotent, wrapped in try/catch, and disabled with
// METRICS_ENABLED=false; a metrics bug must never take the app down.

let installed = false;

// Static assets would add one time series per file and say nothing about how
// fast the application answers.
const ignored = ["/_next/static", "/_next/image", "/favicon.ico"];

export function shouldInstrument() {
  return (
    process.env.METRICS_ENABLED !== "false" &&
    process.env.NEXT_RUNTIME !== "edge" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  );
}

export async function instrumentHttpServer(): Promise<boolean> {
  if (installed || !shouldInstrument()) return false;
  installed = true;
  try {
    const http = await import("node:http");
    const originalEmit = http.Server.prototype.emit;
    http.Server.prototype.emit = function patchedEmit(
      this: unknown,
      event: string | symbol,
      ...args: unknown[]
    ) {
      if (event !== "request")
        return originalEmit.apply(this as never, [event, ...args] as never);
      try {
        const [request, response] = args as [IncomingMessage, ServerResponse];
        const pathname = request.url ?? "/";
        if (ignored.some((prefix) => pathname.startsWith(prefix)))
          return originalEmit.apply(this as never, [event, ...args] as never);

        const startedAt = performance.now();
        let recorded = false;
        const record = (status: number) => {
          if (recorded) return;
          recorded = true;
          metrics.record({
            method: request.method ?? "GET",
            route: normalizeRoute(pathname),
            status,
            durationMs: performance.now() - startedAt,
          });
        };
        response.once("finish", () => record(response.statusCode ?? 0));
        // A dropped connection still consumed server time.
        response.once("close", () => record(response.statusCode || 499));
      } catch {
        // Fall through to the real handler: metrics are optional.
      }
      return originalEmit.apply(this as never, [event, ...args] as never);
    };
    log.info("metrics.instrumented");
    return true;
  } catch (error) {
    log.warn("metrics.instrument_failed", {
      errName: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}
