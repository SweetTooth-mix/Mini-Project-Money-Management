import { logError, log } from "@/lib/log";
import { metrics, normalizeRoute } from "@/lib/metrics";
import { isRequestId } from "@/lib/request-id";

/**
 * Next.js instrumentation hook. `onRequestError` fires for unhandled errors in
 * Server Components, Server Actions and route handlers, so one place records
 * every unexpected server failure with its request ID.
 */
export async function register() {
  log.info("server.started", {
    node: process.version,
    environment: process.env.NODE_ENV,
  });
  // Loaded lazily so the edge runtime never imports node:http.
  if (process.env.NEXT_RUNTIME !== "edge") {
    const { instrumentHttpServer } = await import("@/lib/metrics-http");
    await instrumentHttpServer();
  }
}

type RequestLike = {
  path?: string;
  method?: string;
  headers?: Record<string, string | undefined>;
};

type ErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
};

export async function onRequestError(
  error: unknown,
  request: RequestLike,
  context: ErrorContext,
) {
  metrics.recordError(normalizeRoute(context?.routePath || request.path || ""));
  const headerId = request.headers?.["x-request-id"];
  logError("request.unhandled", error, {
    ...(isRequestId(headerId) ? { requestId: headerId } : {}),
    path: request.path,
    method: request.method,
    routerKind: context?.routerKind,
    routePath: context?.routePath,
    routeType: context?.routeType,
  });
}
