import { checkHealth } from "@/lib/health";
import { log } from "@/lib/log";
import { requestIdFrom, responseHeaders } from "@/lib/request-id";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness probe.
 *
 * 200 is returned while the application can serve pages (database and uploads
 * reachable). A missing reporting toolchain yields 200 with `degraded`, so a
 * load balancer does not pull an instance that still serves the cash book.
 * Paths and tool versions stay in the logs; the response carries names only.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  let report;
  try {
    report = await checkHealth();
  } catch (error) {
    log.error("health.check_failed", { requestId, err: error });
    return Response.json(
      {
        status: "unavailable",
        checks: {
          database: "unavailable",
          uploads: "unavailable",
          reports: "unavailable",
        },
      },
      {
        status: 503,
        headers: { ...responseHeaders(requestId), "Cache-Control": "no-store" },
      },
    );
  }
  const emit = report.status === "ok" ? log.debug : log.warn;
  emit("health.checked", { requestId, ...report });
  return Response.json(report, {
    status: report.status === "unavailable" ? 503 : 200,
    headers: { ...responseHeaders(requestId), "Cache-Control": "no-store" },
  });
}
